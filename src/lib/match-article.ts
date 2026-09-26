/**
 * The match, reduced to the facts a report is allowed to state — and a writer that turns those
 * facts into an article with no model involved.
 *
 * This is the floor under the AI writer in `src/ai/flows/generate-match-article.ts`. The
 * requirement is that a finished match always produces news; a model being down, rate-limited
 * or simply unavailable cannot be allowed to break that. So the same facts feed either writer,
 * and the fallback is not a stub — it is a plain, accurate, publishable report. It reads like a
 * wire brief rather than a written piece, which is the honest difference between the two.
 *
 * Dependency-free on purpose: imported by the browser, the server, and Node scripts.
 */

import type { EventLike, FixtureLike } from "./player-matches"
import { toIso } from "./player-matches"

export type MatchFacts = {
  teamName: string
  opponent: string
  competition: string
  venue?: string
  /** ISO. Formatted for display by the writer. */
  date?: string
  result: "W" | "D" | "L"
  scoreFor: number
  scoreAgainst: number
  scorers: string[]
  assists: string[]
  /** Pre-formatted "67' Goal — Baba Saidu Audu" lines. */
  timeline: string[]
  notes?: string
  journeyTitle?: string
  stage?: string
}

export type MatchArticleDraft = {
  headline: string
  summary: string
  body: string
  tags: string[]
}

export function resultOf(scoreFor: number, scoreAgainst: number): "W" | "D" | "L" {
  return scoreFor > scoreAgainst ? "W" : scoreFor === scoreAgainst ? "D" : "L"
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/** "18 July 2026", without pulling in a date library. */
export function readableDate(iso?: string): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

const RESULT_VERB = {
  W: "beat",
  D: "drew with",
  L: "lost to",
} as const

/**
 * The facts for a fixture, read from the documents the app already stores.
 *
 * Goals and assists come from the live events when there are any — that is where the console
 * writes them as they happen — and from nothing at all otherwise, which is the common case for
 * a match entered as a bare score. The scorers list is therefore allowed to be empty, and the
 * writers are required to say so rather than invent names.
 */
export function factsFromMatch(args: {
  fixture: FixtureLike & { score?: { home?: number; away?: number } | null }
  events?: (EventLike & { text?: string; minute?: number | null; type?: string })[]
  teamName: string
  journeyTitle?: string
  journeyMatch?: { stage?: string; venue?: string } | null
  notes?: string
}): MatchFacts {
  const { fixture, events = [], teamName, journeyTitle, journeyMatch, notes } = args
  const scoreFor = fixture.score?.home ?? 0
  const scoreAgainst = fixture.score?.away ?? 0

  const scorers: string[] = []
  const assists: string[] = []
  const timeline: string[] = []

  // Events arrive newest-first from Firestore; a report reads oldest-first.
  const ordered = [...events].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
  for (const e of ordered) {
    if (!e.text) continue
    timeline.push(e.minute != null ? `${e.minute}' ${e.type} — ${e.text}` : `${e.type} — ${e.text}`)
    if (e.type === "Goal") {
      const name = (e as { playerName?: string }).playerName
      if (name) scorers.push(name)
      const assist = e.assistPlayer?.id ? (e as { assistPlayer?: { name?: string } }).assistPlayer?.name : null
      if (assist) assists.push(assist)
    }
  }

  return {
    teamName,
    opponent: fixture.opponent || "Opponent",
    competition: fixture.competition || "Friendly",
    venue: journeyMatch?.venue ?? (fixture as { venue?: string }).venue,
    date: toIso(fixture.date),
    result: resultOf(scoreFor, scoreAgainst),
    scoreFor,
    scoreAgainst,
    scorers,
    assists,
    timeline,
    notes,
    journeyTitle,
    stage: journeyMatch?.stage,
  }
}

/**
 * A plain, accurate match report with no model involved.
 *
 * Written to be genuinely publishable: it states the result, the scorers where they are known,
 * and where the match sat in a competition. It never claims more than the facts support — when
 * no scorers were recorded it says the details were not recorded rather than leaving a hole or
 * filling it.
 */
export function fallbackArticle(facts: MatchFacts): MatchArticleDraft {
  const { teamName, opponent, competition, result, scoreFor, scoreAgainst } = facts
  const dateText = readableDate(facts.date)
  const where = [facts.journeyTitle, facts.stage].filter(Boolean).join(" · ") || competition
  const scoreLine = `${scoreFor}–${scoreAgainst}`

  const headline =
    result === "W"
      ? `${teamName} beat ${opponent} ${scoreLine}${facts.stage ? ` in ${facts.stage}` : ""}`
      : result === "D"
        ? `${teamName} held to a ${scoreLine} draw by ${opponent}`
        : `${teamName} lose ${scoreLine} to ${opponent}${facts.stage ? ` in ${facts.stage}` : ""}`

  const summaryParts = [`${teamName} ${RESULT_VERB[result]} ${opponent} ${scoreLine} in ${where}`]
  if (dateText) summaryParts[0] += ` on ${dateText}`
  summaryParts[0] += "."
  if (facts.scorers.length > 0) {
    summaryParts.push(
      result === "L"
        ? `${facts.scorers.join(", ")} scored for ${teamName}.`
        : `${facts.scorers.join(", ")} got the goals.`
    )
  }
  const summary = summaryParts.join(" ")

  const paragraphs: string[] = []
  paragraphs.push(
    `${teamName} ${RESULT_VERB[result]} ${opponent} ${scoreLine} in ${where}${dateText ? ` on ${dateText}` : ""}.`
  )

  if (facts.scorers.length > 0) {
    const goals = facts.scorers.map((s, i) => `${s}${i < facts.assists.length && facts.assists[i] ? ` (assisted by ${facts.assists[i]})` : ""}`)
    paragraphs.push(
      `${result === "L" ? "The goal" : "The goals"} came from ${goals.join(", ")}.`
    )
  } else {
    paragraphs.push(
      "Individual details for this match were not recorded, so the report carries the result and the scoreline only."
    )
  }

  if (facts.timeline.length > 0) {
    paragraphs.push(`How it unfolded: ${facts.timeline.join("; ")}.`)
  }

  if (facts.notes) paragraphs.push(facts.notes.trim())

  paragraphs.push(
    result === "W"
      ? `The result stands as played. Full details are on the fixture page.`
      : result === "D"
        ? `The point stands as played. Full details are on the fixture page.`
        : `The defeat stands as played. Full details are on the fixture page.`
  )

  const tags = [
    opponent,
    facts.stage || competition,
    ...facts.scorers,
    result === "W" ? "Win" : result === "D" ? "Draw" : "Defeat",
  ]
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 6)

  return { headline, summary, body: paragraphs.join("\n\n"), tags }
}

/** What the news feed shows under the headline. The first paragraph is the summary if there isn't one. */
export function bodyWithSummary(draft: MatchArticleDraft): string {
  return draft.summary ? `${draft.summary}\n\n${draft.body}` : draft.body
}
