/**
 * A player's participation in a match, and the aggregation that turns those records into the
 * numbers shown on a profile.
 *
 * ## Why this exists
 *
 * `players.stats` used to be the only copy of the truth, and three separate things wrote into
 * it: the live console incremented `stats.appearances` on kick-off, incremented `stats.goals`
 * and `stats.assists` on each goal event, and a human typed whatever else they liked into the
 * admin form. Nothing could be recomputed, so nothing could be corrected — a result edited
 * after the fact left the increment behind for ever, and posting "Match Start" twice
 * double-counted the whole XI.
 *
 * Worse, most matches were never played through the console at all. They were entered as a
 * final score in the fixture form, which touched no statistics whatsoever. That is why three
 * players who played nine tournament matches between them still showed zero appearances.
 *
 * So the direction is reversed. A match write produces one record per player who took part,
 * and `players.stats` becomes a *cache* of the sum of those records plus a manual baseline.
 * Every operation is now idempotent — a record is keyed by the player and the match it came
 * from, so re-saving a fixture overwrites its own record rather than adding another — and
 * `recompute` can rebuild any player's totals from scratch at any time.
 *
 * ## Deliberately dependency-free
 *
 * This module is imported by the browser (admin screens), by the server, and by the one-off
 * backfill script under Node with `firebase-admin`. So it imports nothing at all. Keep it that
 * way: a single import of `firebase/firestore` for a `Timestamp` type would tie all three
 * together.
 */

/** Matches `Player["stats"]`. */
export type PlayerStats = {
  appearances: number
  goals: number
  assists: number
}

/** Where a record came from. Kept so a wrong number can be traced back to what wrote it. */
export type PlayerMatchSource =
  /** The fixture's starting XI. */
  | "lineup"
  /** Counted as part of a tournament squad sheet, across that journey's matches. */
  | "journey"
  /** The live match console — a goal, an assist, or a substitution coming on. */
  | "live"
  /** Tagged on a clip that is linked to a fixture. */
  | "media"
  /** Entered by hand. */
  | "manual"

export type PlayerMatch = {
  id: string
  playerId: string
  /**
   * `match` is one appearance in one fixture. `journey` is a tournament squad sheet, where the
   * goals and assists are known per player but not per match, so the appearances are carried as
   * a count across the journey's played matches rather than invented as individual fixtures.
   */
  scope: "match" | "journey"
  fixtureId?: string | null
  journeyId?: string | null
  /** Opponent for a match, journey title for a tournament. Shown in the breakdown. */
  label: string
  date?: string
  competition?: string
  appearances: number
  goals: number
  assists: number
  source: PlayerMatchSource
  updatedAt?: unknown
}

/** Anything date-ish: an ISO string, a `Date`, or a Firestore Timestamp. */
type DateLike = string | Date | { toDate(): Date } | null | undefined

export function toIso(value: DateLike): string | undefined {
  if (!value) return undefined
  if (typeof value === "string") return value
  if (value instanceof Date) return value.toISOString()
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    try {
      return (value as { toDate(): Date }).toDate().toISOString()
    } catch {
      return undefined
    }
  }
  return undefined
}

/**
 * Record ids are derived, not random.
 *
 * This is the whole idempotency mechanism: re-saving a fixture writes to the same id it wrote
 * to last time, so a corrected result replaces its previous contribution instead of stacking on
 * top of it.
 */
export function matchRecordId(playerId: string, fixtureId: string): string {
  return `${playerId}__m__${fixtureId}`
}

export function journeyRecordId(playerId: string, journeyId: string): string {
  return `${playerId}__j__${journeyId}`
}

export const EMPTY_STATS: PlayerStats = { appearances: 0, goals: 0, assists: 0 }

/** Sum of every record for one player. */
export function aggregate(records: PlayerMatch[]): PlayerStats {
  return records.reduce<PlayerStats>(
    (acc, r) => ({
      appearances: acc.appearances + (r.appearances || 0),
      goals: acc.goals + (r.goals || 0),
      assists: acc.assists + (r.assists || 0),
    }),
    { ...EMPTY_STATS }
  )
}

/**
 * What the profile should show: whatever the player arrived with, plus what the records say.
 *
 * The baseline is the part a human typed and the records do not explain — a career total from
 * before the club started recording matches, or a spell whose fixtures were never entered. It
 * is kept separate so that recomputing never destroys it, and so the admin screen can show
 * where each number came from.
 */
export function totalStats(baseline: PlayerStats | null | undefined, records: PlayerMatch[]): PlayerStats {
  const base = baseline ?? EMPTY_STATS
  const derived = aggregate(records)
  return {
    appearances: (base.appearances || 0) + derived.appearances,
    goals: (base.goals || 0) + derived.goals,
    assists: (base.assists || 0) + derived.assists,
  }
}

/**
 * Works out what a stored total implies about the baseline.
 *
 * Used once, when migrating. A player whose profile says 54 appearances but who has no records
 * needs a baseline of 54; a player whose two goals are already explained by a squad sheet needs
 * a baseline of zero. Taking the surplus — `stored - derived`, never below zero — gets both
 * right.
 *
 * The resulting total is therefore `max(stored, derived)` for each field: a rebuild can only
 * ever *raise* a figure, by exactly the amount of match record that was missing from it, and can
 * never double-count what the stored figure already included. That is the property the migration
 * depends on — see the checks in `.stats-selftest.mts`.
 */
export function inferBaseline(stored: PlayerStats | null | undefined, records: PlayerMatch[]): PlayerStats {
  const s = stored ?? EMPTY_STATS
  const d = aggregate(records)
  return {
    appearances: Math.max(0, (s.appearances || 0) - d.appearances),
    goals: Math.max(0, (s.goals || 0) - d.goals),
    assists: Math.max(0, (s.assists || 0) - d.assists),
  }
}

export function isBaselineEmpty(b: PlayerStats | null | undefined): boolean {
  return !b || (b.appearances === 0 && b.goals === 0 && b.assists === 0)
}

/* ─────────────────────────── derivation from stored data ─────────────────────────── */

/** The shape of a fixture this module cares about. Structural, so both Firestore SDKs fit. */
export type FixtureLike = {
  id: string
  opponent?: string
  competition?: string
  date?: DateLike
  status?: string
  startingXI?: { id?: string }[] | null
  substitutes?: { id?: string }[] | null
}

export type EventLike = {
  type?: string
  text?: string
  minute?: number | null
  /** The scorer, as written by the live console. `scorerPlayer` is the current shape. */
  scorerPlayer?: { id?: string; name?: string } | null
  assistPlayer?: { id?: string; name?: string } | null
  subOnPlayer?: { id?: string; name?: string } | null
  subOffPlayer?: { id?: string; name?: string } | null
  /** Older goal events only stored the name. Matched against the lineup as a fallback. */
  playerName?: string | null
}

/**
 * Everything one fixture contributes, derived from the fixture, its events, and any footage
 * tagged with players.
 *
 * ## One record per player per fixture, built in one pass
 *
 * The obvious alternative — increment a goal count when a goal event is posted — is what the
 * live console used to do, and it is why the numbers couldn't be trusted. Goals and appearances
 * would then land on the same player at different times, and each write had to know what the
 * other had already put there.
 *
 * Deriving the whole fixture at once removes that: every field comes from the same pass, so
 * nothing can clobber anything, and re-deriving after a correction produces the right answer
 * regardless of what was there before. The console now just records the event and asks for a
 * re-derive.
 *
 * ## Tagged footage is an input, not a second record
 *
 * Tagging a player on a clip that belongs to a match is a statement that they played in it. That
 * belongs in this pass alongside the lineup, because a separate record for the same player and
 * fixture would either double-count the appearance or overwrite the goals the events recorded,
 * depending on which was written last. `taggedPlayerIds` is therefore one more source for "who
 * appeared" — and the `source` field still says which of the two put them there.
 *
 * ## Why goals are matched by id, with a name fallback
 *
 * A goal event records who scored. Events written since this model carry `scorerPlayer.id`, so
 * the attribution is exact. Events written before it only carry a name, so the name is matched
 * against the squad — and only the squad, so a stray name can't invent an appearance for someone
 * who wasn't there. A scorer who can't be matched contributes nothing rather than being guessed at.
 */
export function recordsForFixture(
  fixture: FixtureLike,
  events: EventLike[] = [],
  taggedPlayerIds: string[] = []
): PlayerMatch[] {
  const squad = new Map<string, string>()
  for (const p of fixture.startingXI ?? []) if (p?.id) squad.set(p.id, (p as { name?: string }).name ?? "")
  for (const p of fixture.substitutes ?? []) if (p?.id) squad.set(p.id, (p as { name?: string }).name ?? "")

  /** Who took part: the XI, plus any substitute the events say came on, plus anyone tagged. */
  const fromLineup = new Set<string>()
  for (const p of fixture.startingXI ?? []) if (p?.id) fromLineup.add(p.id)

  const byName = new Map<string, string>()
  for (const [id, name] of squad) if (name) byName.set(name.trim().toLowerCase(), id)

  const goals = new Map<string, number>()
  const assists = new Map<string, number>()
  const bump = (map: Map<string, number>, id: string) => map.set(id, (map.get(id) ?? 0) + 1)

  for (const e of events) {
    if (e.type === "Substitution" && e.subOnPlayer?.id) fromLineup.add(e.subOnPlayer.id)

    if (e.type !== "Goal") continue

    // Prefer the stored id; fall back to the name for events written before it existed.
    const scorerId =
      e.scorerPlayer?.id ??
      (e.playerName ? byName.get(e.playerName.trim().toLowerCase()) : undefined)
    if (scorerId) {
      // A scorer who came off the bench is on the pitch by definition.
      fromLineup.add(scorerId)
      bump(goals, scorerId)
    }
    if (e.assistPlayer?.id) {
      fromLineup.add(e.assistPlayer.id)
      bump(assists, e.assistPlayer.id)
    }
  }

  const tagged = new Set(taggedPlayerIds.filter(Boolean))
  const appeared = new Set<string>([...fromLineup, ...tagged])

  const date = toIso(fixture.date)
  return [...appeared].map((playerId) => ({
    id: matchRecordId(playerId, fixture.id),
    playerId,
    scope: "match" as const,
    fixtureId: fixture.id,
    journeyId: null,
    label: fixture.opponent || "Match",
    date,
    competition: fixture.competition,
    appearances: 1,
    goals: goals.get(playerId) ?? 0,
    assists: assists.get(playerId) ?? 0,
    // Which of the two put them in the side, so a wrong appearance can be traced to its cause.
    source: fromLineup.has(playerId) ? ("lineup" as const) : ("media" as const),
  }))
}

export type JourneyLike = {
  id: string
  title?: string
  kind?: string
  status?: string
  startDate?: string
  endDate?: string
  playerIds?: string[] | null
  matches?: { status?: string }[] | null
  squad?: { name?: string; goals?: number; assists?: number; playerId?: string | null }[] | null
}

/**
 * Who took part in a tournament, and how much.
 *
 * A squad sheet lists the touring party and their goals and assists for the whole tournament —
 * it does not say who played which game, and no per-match lineup was ever recorded for these
 * tours. So each participating player is credited the number of matches the journey actually
 * played, as a single record with `appearances: N`. That is the honest reading of the data:
 * "nine appearances across two tournaments" is a claim the sheet supports, whereas nine
 * individual match records would be inventing detail nobody recorded.
 *
 * The participating set is the union of `playerIds` (the linked profiles) and every squad
 * member with a `playerId`. Names on the sheet with no linked profile are counted for nothing —
 * there is no player document to write to, and inventing one would put an unlisted person on the
 * website.
 *
 * A journey that never played a match produces nothing, so an upcoming tour can't hand out
 * appearances in advance.
 */
export function recordsForJourney(journey: JourneyLike): PlayerMatch[] {
  const played = (journey.matches ?? []).filter((m) => m.status === "played").length
  if (played === 0) return []

  const appearancesByPlayer = new Map<string, number>()
  for (const id of journey.playerIds ?? []) if (id) appearancesByPlayer.set(id, played)

  const squad = journey.squad ?? []
  const goalsByPlayer = new Map<string, number>()
  const assistsByPlayer = new Map<string, number>()
  for (const member of squad) {
    if (!member.playerId) continue
    if (!appearancesByPlayer.has(member.playerId)) appearancesByPlayer.set(member.playerId, played)
    goalsByPlayer.set(member.playerId, (goalsByPlayer.get(member.playerId) ?? 0) + (member.goals ?? 0))
    assistsByPlayer.set(member.playerId, (assistsByPlayer.get(member.playerId) ?? 0) + (member.assists ?? 0))
  }

  const date = journey.endDate || journey.startDate
  return [...appearancesByPlayer.entries()].map(([playerId, appearances]) => ({
    id: journeyRecordId(playerId, journey.id),
    playerId,
    scope: "journey" as const,
    fixtureId: null,
    journeyId: journey.id,
    label: journey.title || "Tournament",
    date,
    competition: journey.kind === "international" ? "International" : undefined,
    appearances,
    goals: goalsByPlayer.get(playerId) ?? 0,
    assists: assistsByPlayer.get(playerId) ?? 0,
    source: "journey" as const,
  }))
}

/**
 * The squad a journey should be seeded with, when it has none.
 *
 * Dana Cup 2026 was played by the same touring party as Gothia Cup a fortnight earlier, but no
 * squad sheet was ever entered for it, so its four matches could not be credited to anybody.
 * Deriving one squad from another is a guess about who travelled, so this stays a one-off for
 * the backfill rather than something the app does on its own — and it deliberately drops each
 * member's tournament goals, because those belong to the tournament they were scored in.
 */
export function seedSquadFrom(source: JourneyLike) {
  return (source.squad ?? []).map((m) => ({
    number: (m as { number?: number; name?: string }).number ?? 0,
    name: m.name ?? "",
    position: (m as { position?: string }).position ?? "Midfielder",
    playerId: m.playerId ?? null,
  }))
}

/* ─────────────────────────── presentation helpers ─────────────────────────── */

/** One line of the breakdown shown in the admin: where a chunk of the total came from. */
export type StatLine = { label: string; appearances: number; goals: number; assists: number }

export function summarize(records: PlayerMatch[]): StatLine[] {
  const byLabel = new Map<string, StatLine>()
  for (const r of records) {
    const key = r.scope === "journey" ? `Tournament · ${r.label}` : r.label
    const line = byLabel.get(key) ?? { label: key, appearances: 0, goals: 0, assists: 0 }
    line.appearances += r.appearances || 0
    line.goals += r.goals || 0
    line.assists += r.assists || 0
    byLabel.set(key, line)
  }
  return [...byLabel.values()].sort((a, b) => b.appearances - a.appearances || a.label.localeCompare(b.label))
}
