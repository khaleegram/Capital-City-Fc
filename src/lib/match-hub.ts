"use client"

/**
 * The match hub: one finished match, fanned out into everything that should follow from it.
 *
 * ## The problem this solves
 *
 * A result used to have to be entered three separate times — the score in the fixture form, the
 * report in the news editor, the highlight in the media library — and nothing tied the three
 * together. Miss one and the site was inconsistent; do all three and the same facts were typed
 * twice. The app held enough to write two of them itself.
 *
 * So the fixture is treated as the source. `syncMatchArticle` reads the match — score, scorers,
 * assists, timeline, which tour it belonged to, any footage already linked to it — writes the
 * news report, and links the two documents to each other so neither is ever orphaned.
 *
 * ## Drafts, not publications
 *
 * The generated article is written **unpublished**. It appears in the news admin ready to read
 * and publish. Nothing a model wrote reaches the public site without a person looking at it
 * first, which is the whole reason the draft step exists.
 *
 * ## Generation is never allowed to fail the save
 *
 * A model call can be down, rate-limited, or return something that doesn't validate. When any of
 * that happens this falls back to `fallbackArticle`, which writes an accurate report from the
 * facts alone. The fixture is saved either way — see `callers`.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  addDoc,
} from "firebase/firestore"
import { db } from "./firebase"
import { generateMatchArticle, type GenerateMatchArticleInput } from "@/ai/flows/generate-match-article"
import { bodyWithSummary, factsFromMatch, fallbackArticle, type MatchArticleDraft } from "./match-article"
import { getTeamProfile } from "./team"
import { refreshPublic, notifyQuietly } from "./admin-client"

/** Marks an article as machine-written from a fixture, so the hub never overwrites a human's. */
export const MATCH_ARTICLE_SOURCE = "match"

export type SyncMatchArticleResult = {
  articleId: string | null
  created: boolean
  updated: boolean
  /** Which writer produced the text. `existing` means a person's article was left alone. */
  writtenBy: "ai" | "fallback" | "existing"
  headline: string | null
  error?: string
}

type Fixtureish = {
  id: string
  opponent?: string
  competition?: string
  venue?: string
  date?: string | Date | { toDate(): Date } | null
  status?: string
  score?: { home?: number; away?: number } | null
  notes?: string
  articleId?: string
}

/**
 * Finds the journey a fixture belongs to, and the round it was played in.
 *
 * Journey matches and fixtures share an id (a Gothia fixture is `gothia-2026-sun` and the
 * journey references the same string), so the round can be read straight off the journey match
 * rather than guessed from the fixture's competition text.
 */
async function findJourneyContext(fixtureId: string) {
  const snap = await getDocs(query(collection(db, "journeys"), where("fixtureIds", "array-contains", fixtureId)))
  const journeyDoc = snap.docs[0]
  if (!journeyDoc) return { journeyTitle: undefined, journeyMatch: null }
  const journey = journeyDoc.data() as {
    title?: string
    matches?: { id?: string; stage?: string; venue?: string }[]
  }
  const match = (journey.matches ?? []).find((m) => m.id === fixtureId) ?? null
  return { journeyTitle: journey.title, journeyMatch: match ? { stage: match.stage, venue: match.venue } : null }
}

/** The events for a fixture, newest first as stored. */
async function readEvents(fixtureId: string) {
  const snap = await getDocs(collection(db, "fixtures", fixtureId, "liveEvents"))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[]
}

/** A still from footage already linked to this match, so the article isn't image-less. */
async function findPosterFor(fixtureId: string): Promise<string | undefined> {
  const snap = await getDocs(query(collection(db, "mediaAssets"), where("fixtureId", "==", fixtureId)))
  const assets = snap.docs.map((d) => d.data() as { poster?: string; featured?: boolean })
  // Prefer a featured clip's still; otherwise the first one that has any.
  return assets.find((a) => a.featured && a.poster)?.poster ?? assets.find((a) => a.poster)?.poster
}

/** The news article already attached to a fixture, if there is one. */
async function findExistingArticle(fixture: Fixtureish) {
  if (fixture.articleId) {
    const snap = await getDoc(doc(db, "news", fixture.articleId))
    if (snap.exists()) return { id: snap.id, data: snap.data() as Record<string, unknown> }
  }
  const snap = await getDocs(query(collection(db, "news"), where("fixtureId", "==", fixture.id)))
  const first = snap.docs[0]
  return first ? { id: first.id, data: first.data() as Record<string, unknown> } : null
}

/**
 * Writes (or refreshes) the news report for a finished match, and links the two documents.
 *
 * Safe to call repeatedly: with an existing article it does nothing unless `regenerate` is set,
 * and it never touches an article it didn't write unless `regenerate` is set too.
 */
export async function syncMatchArticle(
  fixtureId: string,
  opts: { regenerate?: boolean; publish?: boolean } = {}
): Promise<SyncMatchArticleResult> {
  const idle: SyncMatchArticleResult = {
    articleId: null,
    created: false,
    updated: false,
    writtenBy: "existing",
    headline: null,
  }

  try {
    const fixtureSnap = await getDoc(doc(db, "fixtures", fixtureId))
    if (!fixtureSnap.exists()) return { ...idle, error: "Fixture not found." }
    const fixture = { id: fixtureSnap.id, ...fixtureSnap.data() } as Fixtureish

    // Only a match with a result has anything to report.
    if (fixture.score?.home == null || fixture.score?.away == null) {
      return { ...idle, error: "This fixture has no result yet." }
    }

    const [events, team, journey, poster, existing] = await Promise.all([
      readEvents(fixtureId),
      getTeamProfile(),
      findJourneyContext(fixtureId),
      findPosterFor(fixtureId),
      findExistingArticle(fixture),
    ])

    /*
     * An article a person wrote is not ours to overwrite.
     *
     * Machine-written ones are: an auto preview ("Upcoming Match: …") describes a fixture that
     * has since been played, and leaving it in place would put a stale preview on the news page
     * next to the result. So a preview is rewritten into the report without being asked, while a
     * hand-written article is left alone unless `regenerate` is passed explicitly.
     */
    const generatedFrom = existing?.data?.generatedFrom as string | undefined
    const ours = generatedFrom === MATCH_ARTICLE_SOURCE || generatedFrom === "preview"

    if (existing && !opts.regenerate && !(generatedFrom === "preview")) {
      // Still make sure the fixture points back at it — the link is the whole point, and the
      // one article already on the site had a dangling `fixtureId` and no back-reference.
      if (fixture.articleId !== existing.id) {
        await updateDoc(doc(db, "fixtures", fixtureId), { articleId: existing.id })
      }
      return { ...idle, articleId: existing.id, headline: (existing.data.headline as string) ?? null }
    }
    if (existing && opts.regenerate && !ours) {
      return { ...idle, articleId: existing.id, error: "That match already has a hand-written article." }
    }

    const facts = factsFromMatch({
      fixture,
      events,
      teamName: team.name,
      journeyTitle: journey.journeyTitle,
      journeyMatch: journey.journeyMatch,
      notes: fixture.notes,
    })

    // AI first, deterministic fallback second. Either way an article comes out.
    let draft: MatchArticleDraft
    let writtenBy: "ai" | "fallback" = "ai"
    try {
      const input: GenerateMatchArticleInput = {
        teamName: facts.teamName,
        opponent: facts.opponent,
        competition: facts.competition,
        venue: facts.venue,
        date: facts.date,
        result: facts.result,
        scoreFor: facts.scoreFor,
        scoreAgainst: facts.scoreAgainst,
        scorers: facts.scorers,
        assists: facts.assists,
        timeline: facts.timeline,
        notes: facts.notes,
        journeyTitle: facts.journeyTitle,
        stage: facts.stage,
      }
      const out = await generateMatchArticle(input)
      // A model that returns an empty body has not written anything usable.
      if (!out?.body?.trim() || !out?.headline?.trim()) throw new Error("Model returned an empty article.")
      draft = { headline: out.headline, summary: out.summary ?? "", body: out.body, tags: out.tags ?? [] }
    } catch (err) {
      console.warn("[ccfc] match article generation fell back to the template:", err)
      draft = fallbackArticle(facts)
      writtenBy = "fallback"
    }

    const payload = {
      headline: draft.headline,
      content: bodyWithSummary(draft),
      tags: draft.tags,
      imageUrl: poster ?? "",
      date: (facts.date ?? new Date().toISOString()).toString(),
      fixtureId,
      generatedFrom: MATCH_ARTICLE_SOURCE,
      published: opts.publish ?? false,
      updatedAt: serverTimestamp(),
    }

    let articleId: string
    let created = false
    if (existing) {
      await updateDoc(doc(db, "news", existing.id), payload)
      articleId = existing.id
    } else {
      const ref = await addDoc(collection(db, "news"), { ...payload, createdAt: serverTimestamp() })
      articleId = ref.id
      created = true
    }

    if (fixture.articleId !== articleId) {
      await updateDoc(doc(db, "fixtures", fixtureId), { articleId })
    }

    await refreshPublic("news", "fixtures")
    // No push for a draft: it isn't public yet, and the notification would link to a 404.
    if (opts.publish) await notifyQuietly("📰 Match report", draft.headline, `/news/${articleId}`)

    return { articleId, created, updated: !created, writtenBy, headline: draft.headline }
  } catch (err) {
    // Never throw: the caller has already saved the match and must not be told the save failed
    // because a report couldn't be written.
    const message = err instanceof Error ? err.message : String(err)
    console.error("[ccfc] syncMatchArticle failed:", message)
    return { ...idle, error: message }
  }
}

/**
 * Writes the news report for every finished match that doesn't have one.
 *
 * This is the catch-up for the fourteen results already on the site, all of which were entered
 * as bare scores and none of which produced any news. Sequential on purpose — it makes one model
 * call per match, and firing fourteen at once would invite a rate limit.
 */
export async function backfillMatchArticles(
  onProgress?: (done: number, total: number, label: string) => void
): Promise<{ created: number; skipped: number; failed: number }> {
  const snap = await getDocs(collection(db, "fixtures"))
  const finished = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((f: any) => f.status === "FT" && f.score?.home != null && f.score?.away != null) as Fixtureish[]

  let created = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < finished.length; i++) {
    const f = finished[i]
    onProgress?.(i, finished.length, f.opponent ?? f.id)
    const result = await syncMatchArticle(f.id)
    if (result.created) created++
    else if (result.error) failed++
    else skipped++
  }
  onProgress?.(finished.length, finished.length, "")

  return { created, skipped, failed }
}
