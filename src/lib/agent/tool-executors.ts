"use client"

/**
 * The half of the admin agent that touches data.
 *
 * ## Why this runs in the browser
 *
 * Every tool here calls the same client helpers the admin screens call — `updateFixture`,
 * `addNewsArticle`, `syncMatchArticle` — with the signed-in admin's own session. That is a
 * deliberate security choice, not a convenience:
 *
 *   - The assistant inherits the operator's permissions exactly. Firestore's rules are evaluated
 *     against the person who asked, so the assistant cannot read or write anything they could not
 *     have done by hand, and there is no privileged path for it to escalate into.
 *   - Every cascade the app already has still applies. Recording a result sets the score, rebuilds
 *     the player records and drafts the report, because it goes through the same function the
 *     fixture form uses. A server-side implementation would have had to re-implement all of that,
 *     and any drift between the two would be silent.
 *
 * Only the model call leaves the browser — see `src/app/api/admin/agent/route.ts` — because the
 * DeepSeek key must not be in the client bundle.
 *
 * ## References are resolved, never trusted
 *
 * Models are unreliable with opaque ids, and a plausible-looking wrong id is the most likely way
 * an agent damages real data. So every tool takes free text and resolves it here against live
 * documents, and an ambiguous reference fails with the candidates listed, which the model can then
 * correct. Nothing is ever written to an id the model produced on its own.
 *
 * ## Errors are messages
 *
 * A `ToolFailure` is an expected outcome — a name that matched nothing, a missing argument — and
 * comes back to the model as readable text so it can fix itself. An unexpected throw is reported
 * the same way but logged, since it means a bug rather than a bad instruction.
 */

import { collection, doc, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { addFixtureAndArticle, deleteFixture, postLiveUpdate, updateFixture } from "@/lib/fixtures"
import { addNewsArticle, deleteNewsArticle, setArticlePublished } from "@/lib/news"
import {
  backfillMatchArticles,
  syncMatchArticle,
} from "@/lib/match-hub"
import { syncAllRecords, syncFixtureRecords, syncJourneyRecords } from "@/lib/match-sync"
import { recomputePlayerStats } from "@/lib/player-matches-client"
import { isUndoable, listActions, undoAction } from "./journal"
import { refreshPublic, notifyAll } from "@/lib/admin-client"
import { generateJourneyEntry } from "@/ai/flows/generate-journey-entry"
import { generateSocialPost } from "@/ai/flows/generate-social-post"
import { getTeamProfile } from "@/lib/team"
import { saveDoc } from "@/lib/collections"
import { toDate } from "@/lib/utils"
import type { Achievement, Fixture, FixtureKind, Journey, JourneySquadMember, NewsArticle, Placement, Player, StaffMember } from "@/lib/data"
import type { ToolOutcome } from "./tools"
import type { Journal } from "./journal"

/** An expected failure: bad arguments, or a reference that matched nothing. Goes to the model as text. */
export class ToolFailure extends Error {}

/** A file the person attached to this turn. Already uploaded; the tools only receive its URL. */
export type Attachment = { name: string; url: string; type: "image" | "video" | "file" }

/**
 * What every tool is given alongside its arguments.
 *
 * `journal` is how a tool describes its own reversal — see `journal.ts`. `attachments` are files
 * the person added to this message, which is the only way a model can refer to a binary it cannot
 * see: it names the file, and the executor swaps in the URL that was already uploaded. `sessionId`
 * lets a tool reach the conversation's own history, which is what undo needs to look back through.
 */
export type ToolContext = { journal: Journal; attachments: Attachment[]; sessionId: string | null }

/* ─────────────────────────────── argument helpers ─────────────────────────────── */

const args = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ToolFailure("Arguments must be an object.")
  return raw as Record<string, unknown>
}

function needString(a: Record<string, unknown>, key: string): string {
  const v = a[key]
  if (typeof v !== "string" || !v.trim()) throw new ToolFailure(`\`${key}\` is required and must be a non-empty string.`)
  return v.trim()
}

function optString(a: Record<string, unknown>, key: string): string | undefined {
  const v = a[key]
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}

function needNumber(a: Record<string, unknown>, key: string): number {
  const v = a[key]
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  if (!Number.isFinite(n)) throw new ToolFailure(`\`${key}\` is required and must be a number.`)
  return n
}

function optNumber(a: Record<string, unknown>, key: string): number | undefined {
  const v = a[key]
  if (v === undefined || v === null || v === "") return undefined
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

function stringList(a: Record<string, unknown>, key: string): string[] {
  const v = a[key]
  if (v === undefined) return []
  if (!Array.isArray(v)) throw new ToolFailure(`\`${key}\` must be an array of strings.`)
  return v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean)
}

/** Whitespace-, case- and accent-insensitive, so "Hjorring FK 2" finds "Hjørring FK 2". */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
/** Ranks candidates so an exact hit beats a substring, and reports the tie rather than guessing. */
function pickOne<T>(
  items: T[],
  ref: string,
  describe: (item: T) => string,
  label: string
): T {
  const exact = items.filter((i) => fold(describe(i)) === fold(ref))
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) {
    throw new ToolFailure(`"${ref}" matches ${exact.length} ${label}s exactly: ${exact.map(describe).join("; ")}. Be specific.`)
  }
  const partial = items.filter((i) => fold(describe(i)).includes(fold(ref)))
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) {
    throw new ToolFailure(
      `"${ref}" is ambiguous — it matches ${partial.length} ${label}s: ${partial.slice(0, 8).map(describe).join("; ")}. ` +
        `Call list_${label}s and use a fuller name or the id.`
    )
  }
  throw new ToolFailure(
    `No ${label} matches "${ref}".${items.length ? ` Known ones include: ${items.slice(0, 8).map(describe).join("; ")}.` : ""}`
  )
}

/* ─────────────────────────────── reference resolvers ─────────────────────────────── */

type FixtureRow = Fixture & { date: string }

async function allFixtures(): Promise<FixtureRow[]> {
  const snap = await getDocs(collection(db, "fixtures"))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FixtureRow)
}

const describeFixture = (f: FixtureRow) =>
  `${f.opponent}${f.score ? ` ${f.score.home}-${f.score.away}` : ""} (${f.status}, ${f.competition}, ${f.id})`

/** By id, then by opponent name. An id the model invented simply won't be found. */
async function resolveFixture(ref: string): Promise<FixtureRow> {
  const fixtures = await allFixtures()
  const byId = fixtures.find((f) => f.id === ref)
  if (byId) return byId
  return pickOne(fixtures, ref, describeFixture, "fixture")
}

/**
 * By id, then by title.
 *
 * A tour is usually referred to by name — "the Dana Cup" — and there can be several in a season, so
 * an ambiguous reference lists the candidates rather than picking one. Published and draft tours
 * are both reachable: most of the work on a tour happens while it is still a draft.
 */
async function resolveJourney(ref: string): Promise<Journey & { id: string }> {
  const snap = await getDocs(collection(db, "journeys"))
  const journeys = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Journey & { id: string })
  const byId = journeys.find((j) => j.id === ref)
  if (byId) return byId
  return pickOne(
    journeys,
    ref,
    (j) => `${j.title}${j.season ? ` ${j.season}` : ""}${j.status ? ` (${j.status})` : ""}`,
    "journey"
  )
}

async function allPlayers(): Promise<(Player & { id: string })[]> {
  const snap = await getDocs(collection(db, "players"))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Player & { id: string })
}

/**
 * By id, then by name.
 *
 * Only the players the site actually publishes are considered — an unpublished sign-up is a draft
 * the club hasn't approved, and putting one in a lineup would credit a person who isn't on the
 * squad list yet.
 */
async function resolvePlayer(ref: string): Promise<Player & { id: string }> {
  const all = await allPlayers()
  /*
   * A published profile is preferred, and a draft is a fallback rather than excluded.
   *
   * Preferring the published one keeps a goal or a lineup attributed to the real squad profile when
   * a name is shared with an unreviewed sign-up. Falling back at all matters because a player the
   * assistant has just created is a draft, and refusing to find it would make `create_player`
   * followed by `update_player` impossible.
   */
  const published = all.filter((p) => p.published !== false)
  const byId = published.find((p) => p.id === ref) ?? all.find((p) => p.id === ref)
  if (byId) return byId
  try {
    return pickOne(published, ref, (p) => p.name, "player")
  } catch (err) {
    if (all.length === published.length) throw err
    return pickOne(all, ref, (p) => `${p.name}${p.published === false ? " (draft)" : ""}`, "player")
  }
}

/** Names that matched nothing, reported back rather than silently dropped. */
async function resolvePlayerNames(names: string[]): Promise<{ matched: Player[]; missing: string[] }> {
  const players = (await allPlayers()).filter((p) => p.published !== false)
  const matched: Player[] = []
  const missing: string[] = []
  for (const name of names) {
    const found =
      players.find((p) => p.id === name) ??
      players.find((p) => fold(p.name) === fold(name)) ??
      players.find((p) => fold(p.name).includes(fold(name)))
    if (found) matched.push(found)
    else missing.push(name)
  }
  return { matched, missing }
}

async function resolveArticle(ref: string): Promise<NewsArticle> {
  const snap = await getDocs(collection(db, "news"))
  const articles = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NewsArticle)
  const byId = articles.find((a) => a.id === ref)
  if (byId) return byId
  return pickOne(articles, ref, (a) => a.headline, "article")
}

/* ─────────────────────────────── the tools ─────────────────────────────── */

export type ToolExecutor = (rawArgs: unknown, ctx: ToolContext) => Promise<ToolOutcome>

/** How much footage is already linked to a match. Drives the "do you have a clip?" question. */
async function countFootage(fixtureId: string): Promise<number> {
  const snap = await getDocs(query(collection(db, "mediaAssets"), where("fixtureId", "==", fixtureId)))
  return snap.size
}

/**
 * Maps a fixture's free-text competition to the fixed set clips are grouped by.
 *
 * `Fixture.competition` is whatever staff typed ("Dana Cup 2026", "NPFL"), and `MediaAsset.fixtureKind`
 * is a small enum the public filters depend on. Anything unrecognised becomes a friendly, which is
 * the safe default: it files the clip under the least specific heading rather than under a wrong one.
 */
function kindFromCompetition(competition?: string): FixtureKind {
  const c = (competition ?? "").toLowerCase()
  if (c.includes("cup")) return "cup"
  if (c.includes("league") || c.includes("npfl") || c.includes("premier")) return "league"
  if (c.includes("tour") || c.includes("dana") || c.includes("gothia")) return "tournament"
  if (c.includes("scout") || c.includes("trial")) return "scouting"
  return "friendly"
}

/**
 * Works out which URL a footage tool should use.
 *
 * Two ways in, because the person may do either: attach a file in the composer (which is already
 * uploaded by the time this runs) or paste a link. The attachment is matched by name, fuzzily and
 * case-insensitively, since the model is repeating a filename it was told rather than choosing one.
 */
function resolveAttachmentSource(a: Record<string, unknown>, ctx: ToolContext): string {
  const direct = optString(a, "url")
  if (direct) return direct

  const wanted = optString(a, "attachment")
  if (!ctx.attachments.length) return ""

  if (!wanted) {
    // One file and no name given: using it is what was meant, and asking would be pedantry.
    return ctx.attachments.length === 1 ? ctx.attachments[0].url : ""
  }

  const needle = wanted.toLowerCase()
  const exact = ctx.attachments.find((x) => x.name.toLowerCase() === needle)
  if (exact) return exact.url
  const partial = ctx.attachments.find(
    (x) => x.name.toLowerCase().includes(needle) || needle.includes(x.name.toLowerCase())
  )
  return partial?.url ?? ""
}

/**
 * Picks the attached photos a gallery should contain, and names the ones that were not there.
 *
 * A gallery is the one tool where several files matter, so unlike a single attachment an unmatched
 * name is not fatal — it is dropped and reported. Including a URL that does not exist would put a
 * broken image on the public site, which is worse than a gallery that is one photo short and says
 * so.
 */
function pickAttachments(
  wanted: string[],
  ctx: ToolContext
): { photos: Attachment[]; missing: string[] } {
  // No names given means "all of them", which is the common case when the person attached three
  // pictures and said "make a gallery from these".
  if (!wanted.length) return { photos: ctx.attachments.filter((a) => a.type === "image"), missing: [] }

  const photos: Attachment[] = []
  const missing: string[] = []
  for (const name of wanted) {
    const needle = name.toLowerCase()
    const hit =
      ctx.attachments.find((a) => a.name.toLowerCase() === needle) ??
      ctx.attachments.find((a) => a.name.toLowerCase().includes(needle) || needle.includes(a.name.toLowerCase()))
    if (hit) photos.push(hit)
    else missing.push(name)
  }
  return { photos, missing }
}

/** Slug for a journey, made unique so a second tour with the same name doesn't collide. */
async function uniqueJourneySlug(title: string): Promise<string> {
  const base = slugify(title)
  const existing = new Set((await getDocs(collection(db, "journeys"))).docs.map((d) => d.data().slug as string))
  if (!existing.has(base)) return base
  for (let i = 2; i < 50; i++) if (!existing.has(`${base}-${i}`)) return `${base}-${i}`
  return `${base}-${Date.now()}`
}

/** Slug for a gallery, unique for the same reason. */
async function uniqueGallerySlug(title: string): Promise<string> {
  const base = slugify(title)
  const existing = new Set((await getDocs(collection(db, "galleries"))).docs.map((d) => d.data().slug as string))
  if (!existing.has(base)) return base
  for (let i = 2; i < 50; i++) if (!existing.has(`${base}-${i}`)) return `${base}-${i}`
  return `${base}-${Date.now()}`
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "untitled"
  )
}

/** Where a new staff member goes in their group: after everyone already in it. */
async function nextStaffRank(group: StaffMember["group"]): Promise<number> {
  const snap = await getDocs(collection(db, "staff"))
  const ranks = snap.docs.map((d) => d.data()).filter((s) => s.group === group).map((s) => Number(s.rank) || 0)
  return ranks.length ? Math.max(...ranks) + 1 : 1
}

export const EXECUTORS: Record<string, ToolExecutor> = {
  /* ── reading ─────────────────────────────────────────────────────────────── */

  async list_fixtures(raw) {
    const a = args(raw)
    const scope = (optString(a, "scope") ?? "all") as "all" | "unplayed" | "played" | "upcoming"
    const limit = optNumber(a, "limit") ?? 20
    let fixtures = await allFixtures()

    const queryText = optString(a, "query")
    if (queryText) fixtures = fixtures.filter((f) => fold(`${f.opponent} ${f.competition}`).includes(fold(queryText)))

    if (scope === "unplayed") fixtures = fixtures.filter((f) => f.status !== "FT")
    if (scope === "played") fixtures = fixtures.filter((f) => f.status === "FT")
    if (scope === "upcoming") fixtures = fixtures.filter((f) => f.status === "UPCOMING")

    fixtures.sort((x, y) => (toDate(y.date)?.getTime() ?? 0) - (toDate(x.date)?.getTime() ?? 0))
    const rows = fixtures.slice(0, Math.max(1, Math.min(100, limit)))

    return {
      ok: true,
      summary: `${rows.length} fixture${rows.length === 1 ? "" : "s"} (${scope}).`,
      data: rows.map((f) => ({
        id: f.id,
        opponent: f.opponent,
        competition: f.competition,
        status: f.status,
        date: toDate(f.date)?.toISOString() ?? null,
        score: f.score ?? null,
        opponentGoalHeadline: f.articleId ? "has a linked article" : undefined,
      })),
    }
  },

  async list_players(raw) {
    const a = args(raw)
    const queryText = optString(a, "query")
    let players = (await allPlayers()).filter((p) => p.published !== false)
    if (queryText) players = players.filter((p) => fold(p.name).includes(fold(queryText)))
    players.sort((x, y) => (x.jerseyNumber ?? 99) - (y.jerseyNumber ?? 99))

    return {
      ok: true,
      summary: `${players.length} player${players.length === 1 ? "" : "s"}${queryText ? ` matching "${queryText}"` : ""}.`,
      data: players.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        jerseyNumber: p.jerseyNumber,
        stats: p.stats ?? { appearances: 0, goals: 0, assists: 0 },
        baseline: p.statsBaseline ?? { appearances: 0, goals: 0, assists: 0 },
      })),
    }
  },

  async list_news(raw) {
    const a = args(raw)
    const includeDrafts = a.include_drafts === undefined ? true : a.include_drafts === true
    const limit = optNumber(a, "limit") ?? 20

    const snap = await getDocs(collection(db, "news"))
    let articles = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as NewsArticle)
    if (!includeDrafts) articles = articles.filter((x) => x.published !== false)
    articles.sort((x, y) => (toDate(y.date)?.getTime() ?? 0) - (toDate(x.date)?.getTime() ?? 0))
    const rows = articles.slice(0, Math.max(1, Math.min(100, limit)))

    return {
      ok: true,
      summary: `${rows.length} article${rows.length === 1 ? "" : "s"} (${rows.filter((x) => x.published === false).length} unpublished).`,
      data: rows.map((x) => ({
        id: x.id,
        headline: x.headline,
        date: toDate(x.date)?.toISOString() ?? x.date,
        published: x.published !== false,
        from: x.generatedFrom ?? "hand-written",
        linkedFixtureId: x.fixtureId ?? null,
      })),
    }
  },

  async club_summary() {
    const [fixtures, players, newsSnap] = await Promise.all([
      allFixtures(),
      allPlayers(),
      getDocs(collection(db, "news")),
    ])
    const articles = newsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as NewsArticle)

    const played = fixtures.filter((f) => f.status === "FT" && f.score)
    let won = 0
    let drawn = 0
    let lost = 0
    let goalsFor = 0
    let goalsAgainst = 0
    for (const f of played) {
      const h = f.score?.home ?? 0
      const away = f.score?.away ?? 0
      goalsFor += h
      goalsAgainst += away
      if (h > away) won++
      else if (h === away) drawn++
      else lost++
    }
    const unplayed = fixtures.filter((f) => f.status !== "FT").length

    // A finished match with no linked article, and no article pointing back at it.
    const linked = new Set<string>()
    for (const f of fixtures) if (f.articleId) linked.add(f.id)
    for (const x of articles) if (x.fixtureId) linked.add(x.fixtureId)
    const missingReports = played.filter((f) => !linked.has(f.id)).length

    const drafts = articles.filter((x) => x.published === false)

    return {
      ok: true,
      summary:
        `Record: ${won}W ${drawn}D ${lost}L from ${played.length} played, ` +
        `${goalsFor} goals for and ${goalsAgainst} against. ${missingReports} played ` +
        `match${missingReports === 1 ? "" : "es"} with no report. ${drafts.length} draft${drafts.length === 1 ? "" : "s"} waiting.`,
      data: {
        played: played.length,
        won,
        drawn,
        lost,
        goalsFor,
        goalsAgainst,
        unplayed,
        squadSize: players.filter((p) => p.published !== false && (p.role ?? "Player") === "Player").length,
        matchesMissingReports: missingReports,
        draftsAwaitingReview: drafts.map((d) => ({ id: d.id, headline: d.headline })),
      },
    }
  },

  /* ── matchday ────────────────────────────────────────────────────────────── */

  async record_result(raw, ctx) {
    const a = args(raw)
    const fixture = await resolveFixture(needString(a, "fixture"))
    const scoreFor = needNumber(a, "score_for")
    const scoreAgainst = needNumber(a, "score_against")
    if (scoreFor < 0 || scoreAgainst < 0) throw new ToolFailure("Scores cannot be negative.")
    const notes = optString(a, "notes")

    // Captured before the write, so undo restores this match's previous score and status rather
    // than guessing at them. The derived records are rebuilt on undo instead of snapshotted.
    await ctx.journal.capture("fixtures", fixture.id)
    ctx.journal.recomputeFixture(fixture.id)

    // The order matters: the result first, then the records derived from it, then the report
    // derived from both. Each step reads what the previous one wrote.
    await updateFixture(fixture.id, {
      score: { home: scoreFor, away: scoreAgainst },
      status: "FT",
      ...(notes ? { notes } : {}),
    })
    await syncFixtureRecords(fixture.id)
    const report = await syncMatchArticle(fixture.id)
    await refreshPublic("fixtures", "news", "players")

    // A report that did not exist before should not outlive the undo of the result that made it.
    if (report.created) ctx.journal.created("news", report.articleId)

    const reportNote = report.created
      ? ` A match report was drafted: "${report.headline}" — it is in Stories as a draft for review.`
      : report.error
        ? ` No report was drafted (${report.error}).`
        : report.articleId
          ? " The match already had a report, which was left in place."
          : ""

    const footage = await countFootage(fixture.id)

    return {
      ok: true,
      summary:
        `Recorded full time: Capital City ${scoreFor}–${scoreAgainst} ${fixture.opponent}.${reportNote}`,
      data: {
        fixtureId: fixture.id,
        articleId: report.articleId,
        articleCreated: report.created,
        footageLinked: footage,
        /*
         * Fed to the model as a prompt to ask, not as an instruction it can skip.
         *
         * A finished match is meant to end up with both a report and footage, and the app cannot
         * know whether a clip exists — only the person does. So the assistant is told to ask, and
         * the answer decides whether anything is attached. Saying no is a valid outcome.
         */
        askAboutFootage: footage === 0,
      },
    }
  },

  async create_fixture(raw, ctx) {
    const a = args(raw)
    const opponent = needString(a, "opponent")
    const competition = needString(a, "competition")
    const dateText = needString(a, "date")
    const date = new Date(dateText)
    if (Number.isNaN(date.getTime())) {
      throw new ToolFailure(`Could not read "${dateText}" as a date. Use ISO 8601, e.g. 2026-10-12T16:00:00+01:00.`)
    }

    const team = await getTeamProfile()
    const scoreFor = optNumber(a, "score_for")
    const scoreAgainst = optNumber(a, "score_against")
    const played = scoreFor !== undefined && scoreAgainst !== undefined

    const id = await addFixtureAndArticle({
      fixtureData: {
        opponent,
        competition,
        venue: optString(a, "venue") ?? team.homeVenue ?? "Abuja, Nigeria",
        date,
        notes: optString(a, "notes"),
        // No auto-preview article: the report is what matters, and a preview for a match that has
        // already been played would be rewritten as soon as the score is set anyway.
        publishArticle: false,
        ...(played ? { score: { home: scoreFor, away: scoreAgainst }, status: "FT" as const } : {}),
      },
      preview: "",
      tags: [],
    })

    if (played) {
      await syncFixtureRecords(id)
      const report = await syncMatchArticle(id)
      await refreshPublic("fixtures", "news", "players")
      // Undo removes the match and the report it generated; its player records are cleaned up by
      // the undo itself, since a vanished fixture leaves nothing to derive them from.
      ctx.journal.created("fixtures", id)
      if (report.created) ctx.journal.created("news", report.articleId)
      return {
        ok: true,
        summary:
          `Added ${opponent} (${competition}) and recorded it as played ${scoreFor}–${scoreAgainst}.` +
          (report.created ? ` Report drafted: "${report.headline}".` : ""),
        data: { fixtureId: id, articleId: report.articleId, footageLinked: await countFootage(id) },
      }
    }

    await refreshPublic("fixtures")
    ctx.journal.created("fixtures", id)
    return {
      ok: true,
      summary: `Added the fixture against ${opponent} (${competition}) on ${date.toISOString().slice(0, 10)}.`,
      data: { fixtureId: id },
    }
  },

  async set_lineup(raw, ctx) {
    const a = args(raw)
    const fixture = await resolveFixture(needString(a, "fixture"))
    const xiNames = stringList(a, "starting_xi")
    if (xiNames.length === 0) throw new ToolFailure("`starting_xi` must name at least one player.")
    if (xiNames.length > 11) throw new ToolFailure(`A starting XI has 11 players; ${xiNames.length} were given.`)

    const xi = await resolvePlayerNames(xiNames)
    const subs = await resolvePlayerNames(stringList(a, "substitutes"))

    // Who played changes who gets credited, so the records are re-derived on undo rather than
    // snapshotted — restoring the XI and rebuilding gives the right totals either way.
    await ctx.journal.capture("fixtures", fixture.id)
    ctx.journal.recomputeFixture(fixture.id)

    // Written even when some names missed, so a mostly-correct XI is usable — but the misses are
    // reported rather than dropped, because silence there would read as success.
    await updateFixture(fixture.id, {
      startingXI: xi.matched,
      substitutes: subs.matched,
    })
    await refreshPublic("fixtures", "players")

    const missed = [...xi.missing, ...subs.missing]
    return {
      ok: true,
      summary:
        `Set the lineup for ${fixture.opponent}: ${xi.matched.length} starter${xi.matched.length === 1 ? "" : "s"}` +
        `${subs.matched.length ? ` and ${subs.matched.length} substitute${subs.matched.length === 1 ? "" : "s"}` : ""}.` +
        (missed.length ? ` Not found in the squad, so not included: ${missed.join(", ")}.` : ""),
      data: { fixtureId: fixture.id, matched: xi.matched.map((p) => p.name), missing: missed },
    }
  },

  async post_match_event(raw, ctx) {
    const a = args(raw)
    const fixture = await resolveFixture(needString(a, "fixture"))
    const eventType = needString(a, "event_type") as
      | "Goal"
      | "Red Card"
      | "Substitution"
      | "Info"
      | "Match Start"
      | "Half Time"
      | "Second Half Start"
      | "Match End"
    const minute = needNumber(a, "minute")

    const currentHome = fixture.score?.home ?? 0
    const currentAway = fixture.score?.away ?? 0
    const homeScore = optNumber(a, "score_for") ?? currentHome
    const awayScore = optNumber(a, "score_against") ?? currentAway

    // Full time and half time are the only states the event types imply; anything else leaves the
    // match live, which is what a goal or a card means.
    const status: Fixture["status"] =
      eventType === "Match End" ? "FT" : eventType === "Half Time" ? "HT" : "LIVE"

    const playerName = optString(a, "player")
    const assistName = optString(a, "assist")
    const subOn = optString(a, "sub_on")
    const subOff = optString(a, "sub_off")

    const team = await getTeamProfile()

    let goal
    if (eventType === "Goal") {
      if (!playerName) throw new ToolFailure("A Goal needs `player` — the scorer's name.")
      const scorer = await resolvePlayer(playerName)
      goal = { scorer, ...(assistName ? { assist: await resolvePlayer(assistName) } : {}) }
    }

    let substitution
    if (eventType === "Substitution") {
      if (!subOn || !subOff) throw new ToolFailure("A Substitution needs both `sub_on` and `sub_off`.")
      substitution = { subOnPlayer: await resolvePlayer(subOn), subOffPlayer: await resolvePlayer(subOff) }
    }

    const text =
      optString(a, "text") ??
      (eventType === "Goal"
        ? `${playerName} scores`
        : eventType === "Substitution"
          ? `${subOn} replaces ${subOff}`
          : eventType)

    // A live update writes the scoreline onto the match and adds a timeline entry. Both are
    // recorded: the entry is addressable only through its subcollection path, and the score and
    // status are restored from the fixture's before-image.
    await ctx.journal.capture("fixtures", fixture.id)
    ctx.journal.recomputeFixture(fixture.id)

    const posted = await postLiveUpdate(fixture.id, {
      homeScore,
      awayScore,
      status,
      eventText: text,
      eventType,
      teamName: team.name,
      minute,
      ...(playerName && !goal ? { playerName } : {}),
      ...(goal ? { goal } : {}),
      ...(substitution ? { substitution } : {}),
    })
    await refreshPublic("fixtures", "players")

    // The timeline entry itself, so undoing a goal removes the goal rather than leaving the
    // scoreline rolled back with the event still on the page.
    if (posted?.eventId) ctx.journal.created(`fixtures/${fixture.id}/liveEvents`, posted.eventId)
    // A final whistle drafts the report; that draft should not outlive the undo of the whistle.
    if (posted?.articleCreated) ctx.journal.created("news", posted.articleId)

    const footage = await countFootage(fixture.id)

    return {
      ok: true,
      summary: `Posted "${text}" at ${minute}' for ${fixture.opponent} — now ${homeScore}–${awayScore} (${status}).`,
      data: {
        fixtureId: fixture.id,
        homeScore,
        awayScore,
        status,
        // Same prompt as recording a result: a finished match should end up with footage, and only
        // the person knows whether a clip exists.
        footageLinked: footage,
        askAboutFootage: eventType === "Match End" && footage === 0,
      },
    }
  },

  async rebuild_player_stats(_raw, ctx) {
    /*
     * The one action whose reversal is a snapshot rather than a re-derivation.
     *
     * A rebuild recomputes every player's totals from every source at once, so there is no single
     * upstream document to restore — the "before" state *is* the collection. Both collections are
     * small (a squad, and one record per appearance), so capturing them whole is affordable and is
     * the only exact reversal available.
     */
    const players = await getDocs(collection(db, "players"))
    const records = await getDocs(collection(db, "playerMatches"))
    ctx.journal.captureAll(
      "players",
      players.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
    )
    ctx.journal.captureAll(
      "playerMatches",
      records.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
    )

    const result = await syncAllRecords()
    return {
      ok: true,
      summary:
        `Rebuilt statistics from ${result.fixtures} fixtures and ${result.journeys} tours — ` +
        `${result.records} records across ${result.playersUpdated} players.`,
      data: result,
    }
  },

  async write_missing_reports(_raw, ctx) {
    const result = await backfillMatchArticles()
    // Each drafted report is recorded so undo removes exactly the ones this run produced, and not
    // a report that was already there beforehand.
    for (const made of result.made) ctx.journal.created("news", made.articleId)
    return {
      ok: true,
      summary:
        `Drafted ${result.created} report${result.created === 1 ? "" : "s"}` +
        `${result.skipped ? `, ${result.skipped} already had one` : ""}` +
        `${result.failed ? `, ${result.failed} failed` : ""}. They are drafts awaiting review.`,
      data: result,
    }
  },

  /* ── news ───────────────────────────────────────────────────────────────── */

  async create_article(raw, ctx) {
    const a = args(raw)
    const headline = needString(a, "headline")
    const content = needString(a, "content")
    const tags = stringList(a, "tags")
    const shouldPublish = a.publish === true

    if (shouldPublish) {
      /*
       * Publishing goes through the same helper the news editor uses, so the article it creates is
       * not addressable for undo afterwards. Rather than log a reversal that cannot be applied,
       * the publication is recorded as genuinely irreversible and the history says so.
       */
      await addNewsArticle({ headline, content, tags })
      ctx.journal.irreversible("The published article now exists on the site; its id was not returned.")
      await refreshPublic("news")
      return { ok: true, summary: `Published "${headline}" to the site.`, data: { published: true } }
    }

    /*
     * A draft, written directly rather than through `addNewsArticle`.
     *
     * That helper publishes unconditionally — it backs the news editor, where saving *is* the
     * approval. The assistant needs the opposite default: it writes into the same drafts queue
     * match reports land in, so anything it writes goes past a person before the club sees it.
     */
    const ref = await addDoc(collection(db, "news"), {
      headline,
      content,
      tags,
      imageUrl: "",
      date: new Date().toISOString(),
      published: false,
      generatedFrom: "assistant",
      createdAt: serverTimestamp(),
    })
    ctx.journal.created("news", ref.id)
    await refreshPublic("news")
    return {
      ok: true,
      summary: `Saved "${headline}" as a draft. It is in Stories waiting to be published.`,
      data: { articleId: ref.id, published: false },
    }
  },

  async publish_article(raw, ctx) {
    const article = await resolveArticle(needString(args(raw), "article"))
    // Captured so undo returns it to whatever it was, which is a draft in the normal case.
    await ctx.journal.capture("news", article.id)
    await setArticlePublished(article.id, true)
    await refreshPublic("news")
    return { ok: true, summary: `"${article.headline}" is now live on the site.`, data: { articleId: article.id } }
  },

  async unpublish_article(raw, ctx) {
    const article = await resolveArticle(needString(args(raw), "article"))
    await ctx.journal.capture("news", article.id)
    await setArticlePublished(article.id, false)
    await refreshPublic("news")
    return { ok: true, summary: `Pulled "${article.headline}" off the site. It remains as a draft.`, data: { articleId: article.id } }
  },

  async link_article_to_match(raw, ctx) {
    const a = args(raw)
    const article = await resolveArticle(needString(a, "article"))
    const fixture = await resolveFixture(needString(a, "fixture"))

    // Both sides, because each is read by something: the match hub finds the article by
    // `fixtureId`, and the fixture page follows `articleId`. Both are captured, since undo has to
    // detach whichever link existed before — and an article may already have been linked to a
    // different match, which un-linking must restore rather than clear.
    await ctx.journal.capture("news", article.id)
    await ctx.journal.capture("fixtures", fixture.id)

    await updateFixture(fixture.id, { articleId: article.id })
    await saveDoc("news", article.id, { fixtureId: fixture.id })
    await refreshPublic("news", "fixtures")

    return {
      ok: true,
      summary: `Linked "${article.headline}" to the match against ${fixture.opponent}.`,
      data: { articleId: article.id, fixtureId: fixture.id },
    }
  },

  /* ── players ────────────────────────────────────────────────────────────── */

  async set_player_baseline(raw, ctx) {
    const a = args(raw)
    const player = await resolvePlayer(needString(a, "player"))
    const before = player.statsBaseline ?? { appearances: 0, goals: 0, assists: 0 }
    const baseline = {
      appearances: optNumber(a, "appearances") ?? before.appearances ?? 0,
      goals: optNumber(a, "goals") ?? before.goals ?? 0,
      assists: optNumber(a, "assists") ?? before.assists ?? 0,
    }

    await ctx.journal.capture("players", player.id)
    await saveDoc("players", player.id, { statsBaseline: baseline })
    // The displayed total is baseline + records, so it has to be recomputed for the change to show.
    // On undo the same recompute runs again from the restored baseline, so the total follows.
    const total = await recomputePlayerStats(player.id)
    await refreshPublic("players")

    return {
      ok: true,
      summary:
        `${player.name}'s baseline is now ${baseline.appearances}/${baseline.goals}/${baseline.assists} ` +
        `(appearances/goals/assists), giving a total of ${total.appearances}/${total.goals}/${total.assists} ` +
        `once match records are added.`,
      data: { playerId: player.id, baseline, total },
    }
  },

  /* ── comms ──────────────────────────────────────────────────────────────── */

  async send_announcement(raw, ctx) {
    const a = args(raw)
    const title = needString(a, "title")
    const body = needString(a, "body")
    /*
     * Recorded as irreversible rather than omitted.
     *
     * A push that has reached a phone cannot be recalled, and a history entry that silently offers
     * no undo is worse than one that explains why — the second tells the operator to be careful
     * *before* sending.
     */
    ctx.journal.irreversible("A notification that has already been delivered cannot be recalled.")
    const result = await notifyAll(title, body, optString(a, "url") ?? "/")
    return {
      ok: true,
      summary: `Sent "${title}" to ${result.sent ?? 0} device${result.sent === 1 ? "" : "s"}${result.failed ? ` (${result.failed} failed)` : ""}.`,
      data: result,
    }
  },

  /* ── destructive ────────────────────────────────────────────────────────── */

  async delete_article(raw, ctx) {
    const article = await resolveArticle(needString(args(raw), "article"))
    // The whole document, so undo re-creates it exactly — same id, same content, same publication
    // state — instead of rewriting it from the summary.
    await ctx.journal.capture("news", article.id)
    await deleteNewsArticle(article)
    await refreshPublic("news")
    return { ok: true, summary: `Deleted the article "${article.headline}".`, data: { articleId: article.id } }
  },

  async delete_fixture(raw, ctx) {
    const fixture = await resolveFixture(needString(args(raw), "fixture"))

    /*
     * A match deletion is the widest-reaching action here, so the match itself and its report are
     * captured — they are gone afterwards and only a copy can bring them back.
     *
     * The player records are deliberately *not* captured. They are derived from the match, so undo
     * restores the match and then rebuilds them, which is both cheaper than storing every record and
     * more correct: the rebuild also recomputes the affected players' totals, which deleting the
     * records had just reduced. A snapshot of the records alone would leave those totals wrong.
     */
    await ctx.journal.capture("fixtures", fixture.id)
    if (fixture.articleId) await ctx.journal.capture("news", fixture.articleId)
    ctx.journal.recomputeFixture(fixture.id)

    // The crest is removed from object storage, which no undo can bring back. Stated up front so
    // the outcome can say a match came back without its badge.
    if (fixture.opponentLogoUrl) ctx.journal.irreversible("The opponent's crest file was deleted from storage.")

    await deleteFixture(fixture)
    await refreshPublic("fixtures", "news", "players")
    return {
      ok: true,
      summary: `Deleted the match against ${fixture.opponent}, with its report and player records.`,
      data: { fixtureId: fixture.id },
    }
  },

  /* ── footage ────────────────────────────────────────────────────────────── */

  async attach_footage(raw, ctx) {
    const a = args(raw)
    const fixture = await resolveFixture(needString(a, "fixture"))
    const title = needString(a, "title")

    /*
     * The file was uploaded by the composer before this turn began, so the tool only ever handles
     * a URL. That is not a limitation to work around — a model cannot transmit a binary here, and
     * pretending otherwise would mean base64 blobs in the transcript, charged per token.
     */
    const url = resolveAttachmentSource(a, ctx)
    if (!url) {
      throw new ToolFailure(
        "No file was attached to this message and no `url` was given. Ask the person to attach the clip, " +
          "then call this again with the file's name."
      )
    }

    const type = optString(a, "type") ?? "highlight"
    const tagged = await resolvePlayerNames(stringList(a, "players"))

    // Footage feeds the match rather than sitting beside it: tags credit appearances, and a match
    // with a clip but no report gets one. Both mirror what the media screen does on save.
    const data: Record<string, unknown> = {
      type,
      title,
      description: optString(a, "description") ?? "",
      url,
      poster: "",
      fixtureId: fixture.id,
      opponent: fixture.opponent,
      fixtureKind: kindFromCompetition(fixture.competition),
      scoreFor: fixture.score?.home,
      scoreAgainst: fixture.score?.away,
      playerIds: tagged.matched.map((p) => p.id),
      taggedPlayers: tagged.matched.map((p) => ({ id: p.id, name: p.name })),
      year: new Date(toDate(fixture.date) ?? Date.now()).getFullYear(),
      vertical: false,
      featured: false,
      published: a.publish === true,
      journeyId: null,
      createdAt: serverTimestamp(),
    }

    const ref = await addDoc(collection(db, "mediaAssets"), data)
    // Recorded so undo removes the clip; the records it credited are rebuilt by the recompute.
    ctx.journal.created("mediaAssets", ref.id)
    ctx.journal.recomputeFixture(fixture.id)

    await syncFixtureRecords(fixture.id)
    const report = await syncMatchArticle(fixture.id)
    if (report.created) ctx.journal.created("news", report.articleId)
    await refreshPublic("media", "fixtures", "news", "players")

    return {
      ok: true,
      summary:
        `Attached "${title}" to the match against ${fixture.opponent}` +
        (tagged.matched.length
          ? `, tagging ${tagged.matched.length} player${tagged.matched.length === 1 ? "" : "s"}.`
          : ", with nobody tagged.") +
        (tagged.missing.length ? ` Not found in the squad: ${tagged.missing.join(", ")}.` : "") +
        (a.publish === true ? " It is live on the site." : " It is saved as a draft.") +
        (report.created ? ` A match report was drafted: "${report.headline}".` : ""),
      data: { mediaId: ref.id, fixtureId: fixture.id, articleId: report.articleId, tagged: tagged.matched.map((p) => p.name) },
    }
  },

  /* ── tours and journeys ─────────────────────────────────────────────────── */

  async list_journeys(raw) {
    const a = args(raw)
    const q = optString(a, "query")?.toLowerCase()
    const status = optString(a, "status")

    const snap = await getDocs(collection(db, "journeys"))
    let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Journey)
    if (q) rows = rows.filter((j) => `${j.title} ${j.slug ?? ""}`.toLowerCase().includes(q))
    if (status) rows = rows.filter((j) => j.status === status)
    rows.sort((x, y) => String(y.startDate ?? "").localeCompare(String(x.startDate ?? "")))

    if (!rows.length) throw new ToolFailure("No journey matched that. Check the name with a broader search.")

    return {
      ok: true,
      summary: rows
        .slice(0, 12)
        .map(
          (j) =>
            `${j.title} — ${j.kind}, ${j.status}, ${j.startDate ?? "no date"}${j.published ? "" : " (draft)"}, ` +
            `${(j.squad ?? []).length} on the sheet`
        )
        .join("\n"),
      data: rows.slice(0, 12).map((j) => ({
        id: j.id,
        title: j.title,
        kind: j.kind,
        status: j.status,
        season: j.season ?? null,
        startDate: j.startDate ?? null,
        endDate: j.endDate ?? null,
        published: j.published,
        squadSize: (j.squad ?? []).length,
        // Reported because an unlinked name counts for nothing, which is the usual reason a tour's
        // statistics look wrong.
        squadUnlinked: (j.squad ?? []).filter((m) => !m.playerId).length,
        record: j.record ?? null,
        matches: (j.matches ?? []).length,
      })),
    }
  },

  async create_journey(raw, ctx) {
    const a = args(raw)
    const title = needString(a, "title")
    const kind = needString(a, "kind") as Journey["kind"]
    const slug = await uniqueJourneySlug(title)

    const id = await saveDoc("journeys", null, {
      slug,
      title,
      subtitle: "",
      kind,
      status: "upcoming",
      season: optString(a, "season") ?? "",
      startDate: optString(a, "start_date") ?? "",
      endDate: optString(a, "end_date") ?? "",
      summary: optString(a, "summary") ?? "",
      stops: [],
      progress: 0,
      playerIds: [],
      fixtureIds: [],
      matches: [],
      quotes: [],
      // A draft, like everything else the assistant creates: a tour page is public-facing and goes
      // past a person before it appears.
      published: false,
    })
    ctx.journal.created("journeys", id)
    await refreshPublic("journeys")

    return {
      ok: true,
      summary: `Created "${title}" (${kind}) as a draft. Add its squad with \`set_journey_squad\`.`,
      data: { journeyId: id, slug, published: false },
    }
  },

  async set_journey_squad(raw, ctx) {
    const a = args(raw)
    const journey = await resolveJourney(needString(a, "journey"))
    const rows = Array.isArray(a.members) ? (a.members as Record<string, unknown>[]) : []
    if (!rows.length) throw new ToolFailure("`members` must list the squad sheet, and it was empty.")

    const players = await allPlayers()
    const byName = new Map(players.map((p) => [p.name.trim().toLowerCase(), p.id]))

    /*
     * Names are linked to profiles by exact name only.
     *
     * Deliberately not fuzzy here. On a squad sheet two players can share a name, and a wrong link
     * misattributes an entire career rather than one match — so anything short of an exact match is
     * left unlinked and reported, for a person to settle.
     */
    const squad: JourneySquadMember[] = rows.map((m, i) => {
      const name = String(m.name ?? "").trim()
      return {
        number: Number(m.number) || i + 1,
        name,
        position: (m.position as JourneySquadMember["position"]) ?? "Midfielder",
        ...(m.goals === undefined ? {} : { goals: Number(m.goals) }),
        ...(m.assists === undefined ? {} : { assists: Number(m.assists) }),
        playerId: byName.get(name.toLowerCase()) ?? null,
      }
    })

    // Captured before the write; the rebuild on undo restores the tour's contributions from the
    // squad sheet that was there before.
    await ctx.journal.capture("journeys", journey.id)
    ctx.journal.recomputeJourney(journey.id)

    const previous = new Set((journey.squad ?? []).map((m) => (m.playerId ?? "").trim()).filter(Boolean))
    await saveDoc("journeys", journey.id, { squad })
    const result = await syncJourneyRecords(journey.id)
    await refreshPublic("journeys", "players")

    const unlinked = squad.filter((m) => !m.playerId)
    const newlyLinked = squad.filter((m) => m.playerId && !previous.has(m.playerId))
    const dropped = [...previous].filter((id) => !squad.some((m) => m.playerId === id))

    return {
      ok: true,
      summary:
        `Set ${journey.title}'s squad sheet: ${squad.length} name${squad.length === 1 ? "" : "s"}, ` +
        `${squad.length - unlinked.length} linked to a profile. ` +
        `Statistics rebuilt — ${result.records} records across ${result.playersUpdated} player${result.playersUpdated === 1 ? "" : "s"}.` +
        (newlyLinked.length ? ` Now credited: ${newlyLinked.map((m) => m.name).join(", ")}.` : "") +
        (unlinked.length
          ? ` Not linked to a profile, so they credit nothing: ${unlinked.map((m) => m.name).join(", ")}.`
          : "") +
        (dropped.length ? ` ${dropped.length} player(s) came off the sheet and lost their tour appearances.` : ""),
      data: {
        journeyId: journey.id,
        linked: squad.filter((m) => m.playerId).length,
        unlinked: unlinked.map((m) => m.name),
        playersUpdated: result.playersUpdated,
      },
    }
  },

  async post_journey_entry(raw, ctx) {
    const a = args(raw)
    const journey = await resolveJourney(needString(a, "journey"))
    const location = optString(a, "location") ?? journey.stops?.at(-1)?.city ?? ""
    const day = optNumber(a, "day")
    let title = optString(a, "title")
    let body = optString(a, "body")
    const notes = optString(a, "notes")

    // Written up only when there is nothing to post but notes — the same contract as the diary
    // screen, where the notes field is what the writer is given.
    let writtenUp = false
    if (!body && notes) {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new ToolFailure("Not signed in, so the entry cannot be written up.")
      const out = await generateJourneyEntry(token, {
        journeyTitle: journey.title,
        ...(location ? { location } : {}),
        ...(day === undefined ? {} : { day }),
        notes,
      })
      body = out.body
      title = title ?? out.title
      writtenUp = true
    }

    if (!title && !body) throw new ToolFailure("Give either `body` or `notes` for the diary entry.")
    if (!body) body = ""

    const url = resolveAttachmentSource(a, ctx)
    const entryId = await saveDoc(`journeys/${journey.id}/entries`, null, {
      day,
      title: title ?? `Day ${day ?? ""}`.trim(),
      body,
      location,
      mediaIds: [],
      imageUrl: url,
    })
    ctx.journal.created(`journeys/${journey.id}/entries`, entryId)
    await refreshPublic("journeys")

    return {
      ok: true,
      summary:
        `Posted "${title}" to ${journey.title}'s diary${day === undefined ? "" : ` as day ${day}`}` +
        (writtenUp ? ", written up from your notes." : ".") +
        (url ? " With a photo." : "") +
        (journey.published ? " It is live on the journey page." : " The journey is still a draft, so it is not public yet."),
      data: { journeyId: journey.id, entryId, writtenUp },
    }
  },

  async set_journey_status(raw, ctx) {
    const a = args(raw)
    const journey = await resolveJourney(needString(a, "journey"))
    const status = needString(a, "status") as Journey["status"]
    const endDate = optString(a, "end_date")

    await ctx.journal.capture("journeys", journey.id)
    await saveDoc("journeys", journey.id, { status, ...(endDate ? { endDate } : {}) })
    await refreshPublic("journeys")

    return {
      ok: true,
      summary: `${journey.title} is now ${status}.${endDate ? ` End date set to ${endDate}.` : ""}`,
      data: { journeyId: journey.id, status },
    }
  },

  /* ── players, placements and club records ───────────────────────────────── */

  async create_player(raw, ctx) {
    const a = args(raw)
    const name = needString(a, "name")
    const position = needString(a, "position") as Player["position"]
    const jerseyNumber = needNumber(a, "jersey_number")

    const existing = await allPlayers()
    if (existing.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      throw new ToolFailure(`There is already a player called ${name}. Use \`update_player\` to change that profile.`)
    }

    const imageUrl = resolveAttachmentSource(a, ctx)
    const id = await saveDoc("players", null, {
      name,
      nickname: optString(a, "nickname") ?? "",
      position,
      // Everyone created here is a player; coaches and staff have their own screen and tool.
      role: "Player" as const,
      jerseyNumber,
      imageUrl,
      bio: optString(a, "bio") ?? "",
      // Zeroed rather than absent: the totals are `statsBaseline + records`, so a missing object
      // would read as undefined in the maths rather than as nothing recorded yet.
      stats: { appearances: 0, goals: 0, assists: 0 },
      statsBaseline: { appearances: 0, goals: 0, assists: 0 },
      status: "Active" as const,
      careerHighlights: [],
      ...(optString(a, "dob") ? { dob: optString(a, "dob") } : {}),
      ...(optString(a, "nationality") ? { nationality: optString(a, "nationality") } : {}),
      published: false,
    })
    ctx.journal.created("players", id)
    await refreshPublic("players", "journeys")

    return {
      ok: true,
      summary: `Added ${name} (#${jerseyNumber}, ${position}) as a draft profile. Publish it with \`update_player\` when the details are right.`,
      data: { playerId: id, published: false },
    }
  },

  async update_player(raw, ctx) {
    const a = args(raw)
    const player = await resolvePlayer(needString(a, "player"))

    /*
     * Only the fields that were passed, built up explicitly.
     *
     * Spreading the model's arguments would let it write any field on the document, including
     * `statsBaseline` or `source` — the first would corrupt the statistics the whole design is
     * built on, and the second would mark a hand-made profile as a self sign-up. The tool takes the
     * fields a person could set on the profile form and nothing else.
     */
    const patch: Record<string, unknown> = {}
    const put = (key: string, value: unknown) => {
      if (value !== undefined) patch[key] = value
    }
    put("name", optString(a, "name"))
    put("nickname", optString(a, "nickname"))
    put("position", optString(a, "position"))
    put("jerseyNumber", optNumber(a, "jersey_number"))
    put("status", optString(a, "status"))
    put("strongFoot", optString(a, "strong_foot"))
    put("heightCm", optNumber(a, "height_cm"))
    put("nationality", optString(a, "nationality"))
    put("bio", optString(a, "bio"))
    put("currentClub", optString(a, "current_club"))
    put("squadStatus", optString(a, "squad_status"))
    if (typeof a.publish === "boolean") put("published", a.publish)

    const image = resolveAttachmentSource(a, ctx)
    if (image) put("imageUrl", image)

    if (!Object.keys(patch).length) throw new ToolFailure("No changes were given, so nothing was updated.")

    await ctx.journal.capture("players", player.id)
    await saveDoc("players", player.id, patch)
    // `published` is not part of the derived statistics, but a changed name or position is
    // denormalised onto records and the public pages, so everything downstream is refreshed.
    await refreshPublic("players", "journeys", "proof")

    return {
      ok: true,
      summary: `Updated ${player.name}: ${Object.keys(patch)
        .map((k) => k.replace(/([A-Z])/g, " $1").toLowerCase())
        .join(", ")}.`,
      data: { playerId: player.id, changed: Object.keys(patch) },
    }
  },

  async add_placement(raw, ctx) {
    const a = args(raw)
    const player = await resolvePlayer(needString(a, "player"))
    const club = needString(a, "club")
    const country = needString(a, "country")
    const type = needString(a, "type") as Placement["type"]

    const id = await saveDoc("placements", null, {
      playerId: player.id,
      playerName: player.name,
      playerImageUrl: player.imageUrl ?? "",
      position: player.position ?? "",
      club,
      country,
      league: optString(a, "league") ?? "",
      type,
      date: optString(a, "date") ?? "",
      verified: a.verified === true,
      published: false,
      sourceUrl: optString(a, "source_url") ?? "",
    })
    ctx.journal.created("placements", id)
    await refreshPublic("placements", "proof")

    return {
      ok: true,
      summary:
        `Recorded ${player.name} — ${type} at ${club} (${country}) as an unverified draft. ` +
        `Someone needs to check it against a source and publish it.`,
      data: { placementId: id, published: false },
    }
  },

  async add_achievement(raw, ctx) {
    const a = args(raw)
    const title = needString(a, "title")
    const year = needNumber(a, "year")
    const kind = needString(a, "kind") as Achievement["kind"]
    const journeyRef = optString(a, "journey")
    const journey = journeyRef ? await resolveJourney(journeyRef) : null

    const id = await saveDoc("achievements", null, {
      title,
      year,
      kind,
      competition: optString(a, "competition") ?? "",
      detail: optString(a, "detail") ?? "",
      journeyId: journey?.id ?? null,
      published: false,
    })
    ctx.journal.created("achievements", id)
    await refreshPublic("achievements", "proof", "journeys")

    return {
      ok: true,
      summary: `Added "${title}" (${year}, ${kind})${journey ? ` to ${journey.title}` : ""} as an unpublished draft.`,
      data: { achievementId: id },
    }
  },

  async add_staff_member(raw, ctx) {
    const a = args(raw)
    const name = needString(a, "name")
    const role = needString(a, "role")
    const group = needString(a, "group") as StaffMember["group"]

    const id = await saveDoc("staff", null, {
      name,
      role,
      group,
      // Appended within the group rather than inserted at the top, so adding someone does not
      // silently reorder a page that was already arranged.
      rank: optNumber(a, "rank") ?? (await nextStaffRank(group)),
      imageUrl: "",
      bio: optString(a, "bio") ?? "",
      quote: optString(a, "quote") ?? "",
      licences: stringList(a, "licences"),
      published: false,
    })
    ctx.journal.created("staff", id)
    await refreshPublic("staff")

    return {
      ok: true,
      summary: `Added ${name} — ${role} (${group}) as an unpublished draft.`,
      data: { staffId: id },
    }
  },

  /* ── galleries ──────────────────────────────────────────────────────────── */

  async create_gallery(raw, ctx) {
    const a = args(raw)
    const title = needString(a, "title")
    const journeyRef = optString(a, "journey")
    const journey = journeyRef ? await resolveJourney(journeyRef) : null

    /*
     * Photos come from the attachments, matched by the names the model was told.
     *
     * Only the ones actually attached can be included, so a name that matches nothing is dropped
     * and reported instead of becoming a broken image on the public site.
     */
    const wanted = stringList(a, "attachments")
    const { photos, missing } = pickAttachments(wanted, ctx)
    if (!photos.length) {
      throw new ToolFailure(
        "No attached photos matched, so there is nothing to put in the gallery. Ask the person to attach the " +
          "photos, then call this again with their names."
      )
    }

    const caption = optString(a, "caption")
    const id = await saveDoc("galleries", null, {
      slug: await uniqueGallerySlug(title),
      title,
      story: optString(a, "story") ?? "",
      location: optString(a, "location") ?? journey?.stops?.at(-1)?.city ?? "",
      date: optString(a, "date") ?? "",
      journeyId: journey?.id ?? null,
      photos: photos.map((p) => ({ url: p.url, ...(caption ? { caption } : {}), playerIds: [] })),
      published: false,
    })
    ctx.journal.created("galleries", id)
    await refreshPublic("galleries", "journeys")

    return {
      ok: true,
      summary:
        `Created the gallery "${title}" with ${photos.length} photo${photos.length === 1 ? "" : "s"}` +
        `${journey ? ` from ${journey.title}` : ""} as a draft.` +
        (missing.length ? ` These were named but not attached, so they are not in it: ${missing.join(", ")}.` : ""),
      data: { galleryId: id, photos: photos.length, missing },
    }
  },

  /* ── writing help ───────────────────────────────────────────────────────── */

  async write_social_posts(raw) {
    const a = args(raw)
    const articleRef = optString(a, "article")
    const given = optString(a, "text")

    let content = given
    let tags = stringList(a, "tags")
    if (!content && articleRef) {
      const article = await resolveArticle(articleRef)
      content = `${article.headline}\n${article.content}`
      tags = (article.tags ?? []) as string[]
    }
    if (!content) throw new ToolFailure("Give either an `article` to write about or the `text` to work from.")

    const out = await generateSocialPost({ articleContent: content, tags })
    return {
      ok: true,
      summary: `Twitter:\n${out.twitterPost}\n\nInstagram:\n${out.instagramPost}`,
      // Not written anywhere. The news screen shows these posts for copying, and putting them in
      // the article record would invent a home for them that nothing reads.
      data: { twitterPost: out.twitterPost, instagramPost: out.instagramPost },
    }
  },

  /* ── undo ───────────────────────────────────────────────────────────────── */

  async undo_last_change(raw, ctx) {
    const a = args(raw)
    const about = optString(a, "about")

    const recent = await listActions({ sessionId: ctx.sessionId ?? undefined, limit: 25 })
    if (!recent.length) throw new ToolFailure("There is nothing recorded in this conversation to undo.")

    /*
     * Targeting by words, not a menu.
     *
     * The person says "undo the lineup", and the model passes that through. Searching the tool name
     * and the outcome's summary — the same sentence the person read in the activity feed — means
     * the description they actually have in front of them is what finds the entry.
     */
    const candidates = recent.filter(isUndoable)
    if (!candidates.length) {
      throw new ToolFailure(
        "Nothing here can be undone — the recent changes were either already reversed or cannot be " +
          "reversed at all."
      )
    }

    let target = candidates[0]
    if (about) {
      const needle = about.toLowerCase()
      const words = needle.split(/[^a-z0-9]+/).filter((w) => w.length > 2)
      const scored = candidates
        .map((entry) => {
          const haystack = `${entry.tool} ${entry.summary}`.toLowerCase()
          const score = words.reduce((n, w) => n + (haystack.includes(w) ? 1 : 0), 0)
          return { entry, score }
        })
        .sort((x, y) => y.score - x.score)
      if (scored[0]?.score > 0) target = scored[0].entry
    }

    const outcome = await undoAction(target)
    if (!outcome.ok) throw new ToolFailure(outcome.message)

    /*
     * Deliberately journals nothing, so reversing an undo is not offered as a redo. A single-step
     * history is what the ledger supports honestly; a redo built on top of "the entry is marked
     * undone" would be a second, unproven mechanism.
     */
    return {
      ok: true,
      summary: `${outcome.message} The change reversed was: ${target.summary}`,
      data: { undoneActionId: target.id, tool: target.tool, missing: outcome.missing },
    }
  },

  /* ── looking things up ──────────────────────────────────────────────────── */

  async lookup_club(raw) {
    const query = needString(args(raw), "query")

    /*
     * The request is proxied rather than made here.
     *
     * It goes to a third party and carries this deployment's identity, and the answer is cached
     * where the cache lives — both reasons it does not belong in the operator's browser. This is
     * the only tool that leaves the club's own systems.
     */
    const res = await fetch("/api/admin/agent/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
      },
      body: JSON.stringify({ query }),
    })

    const data = (await res.json().catch(() => ({}))) as {
      found?: boolean
      title?: string
      description?: string
      extract?: string
      url?: string
      error?: string
    }

    if (!res.ok) throw new ToolFailure(data.error ?? "The lookup failed.")
    if (!data.found) {
      throw new ToolFailure(
        `Nothing on Wikipedia matched "${query}". Try the club's full name with its country, or ask the person.`
      )
    }

    return {
      ok: true,
      summary:
        `${data.title}${data.description ? ` — ${data.description}` : ""}\n\n${data.extract}\n\n` +
        `Source: Wikipedia (${data.url})`,
      data: {
        title: data.title,
        description: data.description,
        extract: data.extract,
        url: data.url,
        source: "Wikipedia",
      },
    }
  },
}
