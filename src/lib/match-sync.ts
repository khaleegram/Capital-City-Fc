"use client"

/**
 * Keeping `playerMatches` in step with the fixtures and journeys it is derived from.
 *
 * Every function here follows the same shape: **read the source, derive the records, replace
 * what that source previously wrote, recompute the players it touched.** Nothing increments, so
 * nothing can drift, and running any of these twice produces the same numbers as running it
 * once. That is what makes it safe to call them from every write path — a corrected result, a
 * changed lineup, a re-tagged clip and a full backfill all go through the same door.
 */

import { collection, getDoc, getDocs, doc, query, where } from "firebase/firestore"
import { db } from "./firebase"
import {
  recordsForFixture,
  recordsForJourney,
  type EventLike,
  type FixtureLike,
  type JourneyLike,
  type PlayerMatch,
} from "./player-matches"
import { saveMatchRecords, recomputeMany } from "./player-matches-client"
import { refreshPublic } from "./admin-client"

export type SyncRecordsResult = {
  records: number
  playersUpdated: number
}

const EMPTY: SyncRecordsResult = { records: 0, playersUpdated: 0 }

async function readEvents(fixtureId: string): Promise<EventLike[]> {
  const snap = await getDocs(collection(db, "fixtures", fixtureId, "liveEvents"))
  return snap.docs.map((d) => d.data() as EventLike)
}

/**
 * Players tagged on footage that belongs to this fixture.
 *
 * A clip of a match linked to it, with a player tagged, is evidence that player was in the
 * match — so the tags are one of the inputs the records are derived from, alongside the lineup.
 * See `recordsForFixture`.
 */
async function readTaggedPlayerIds(fixtureId: string): Promise<string[]> {
  const snap = await getDocs(query(collection(db, "mediaAssets"), where("fixtureId", "==", fixtureId)))
  const ids = new Set<string>()
  for (const d of snap.docs) {
    for (const id of ((d.data().playerIds ?? []) as string[])) if (id) ids.add(id)
  }
  return [...ids]
}

/**
 * Rebuilds one fixture's records from its lineup and its live events, then recomputes everyone
 * involved.
 *
 * Called after anything that changes who played or what happened: saving a fixture with a
 * lineup and a result, posting a goal, a substitution, or the final whistle.
 */
export async function syncFixtureRecords(fixtureId: string): Promise<SyncRecordsResult> {
  const snap = await getDoc(doc(db, "fixtures", fixtureId))
  if (!snap.exists()) return EMPTY

  const fixture = { id: snap.id, ...snap.data() } as FixtureLike & { score?: unknown }
  const [events, tagged] = await Promise.all([readEvents(fixtureId), readTaggedPlayerIds(fixtureId)])
  const records = recordsForFixture(fixture, events, tagged)

  const touched = await saveMatchRecords(records, { fixtureId })
  const totals = await recomputeMany(touched)

  await refreshPublic("players")
  return { records: records.length, playersUpdated: Object.keys(totals).length }
}

/**
 * Rebuilds one journey's records from its squad sheet and played matches.
 *
 * A journey is a tournament, not a fixture: the squad sheet gives per-player goals and assists
 * for the whole tour, and the appearances are the number of matches it played. See
 * `recordsForJourney` for why those aren't split per match.
 */
export async function syncJourneyRecords(journeyId: string): Promise<SyncRecordsResult> {
  const snap = await getDoc(doc(db, "journeys", journeyId))
  if (!snap.exists()) return EMPTY

  const journey = { id: snap.id, ...snap.data() } as JourneyLike
  const records = recordsForJourney(journey)

  const touched = await saveMatchRecords(records, { journeyId })
  const totals = await recomputeMany(touched)

  await refreshPublic("players")
  return { records: records.length, playersUpdated: Object.keys(totals).length }
}

/**
 * Removes everything a journey contributed, and recomputes the players it affected.
 *
 * Called when a journey is deleted, and also when its squad is cleared: without this, a player
 * dropped from a tour would keep the appearances it credited them, because nothing else would
 * ever overwrite that record.
 */
export async function deleteJourneyRecords(journeyId: string): Promise<number> {
  const snap = await getDocs(query(collection(db, "playerMatches"), where("journeyId", "==", journeyId)))
  if (snap.empty) return 0

  const affected = new Set<string>()
  const { writeBatch } = await import("firebase/firestore")
  const batch = writeBatch(db)
  for (const d of snap.docs) {
    const playerId = d.data().playerId as string | undefined
    if (playerId) affected.add(playerId)
    batch.delete(d.ref)
  }
  await batch.commit()

  if (affected.size > 0) await recomputeMany([...affected])
  await refreshPublic("players")
  return affected.size
}

/**
 * Rebuilds everything, from both sources.
 *
 * This is the button that makes the numbers trustworthy again: it wipes and re-derives every
 * record, so whatever the old increment-based code left behind is replaced rather than added to.
 *
 * Matches and journeys are reconciled into a single set first, because a fixture that belongs to
 * a journey would otherwise be written twice — once as a match and once as part of the tour's
 * squad sheet — and counted twice. A player on a tournament squad therefore gets their
 * appearances from the tour, not from the individual fixtures of that tour.
 */
export async function syncAllRecords(
  onProgress?: (done: number, total: number, label: string) => void
): Promise<SyncRecordsResult & { fixtures: number; journeys: number }> {
  const [fixtureSnap, journeySnap] = await Promise.all([
    getDocs(collection(db, "fixtures")),
    getDocs(collection(db, "journeys")),
  ])

  // Fixtures that belong to a journey are credited through that journey's squad sheet instead.
  const journeyFixtureIds = new Set<string>()
  for (const d of journeySnap.docs) {
    for (const id of ((d.data() as { fixtureIds?: string[] }).fixtureIds ?? [])) journeyFixtureIds.add(id)
  }

  const fixtures = fixtureSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as FixtureLike & { status?: string })
    .filter((f) => !journeyFixtureIds.has(f.id))
  const journeys = journeySnap.docs.map((d) => ({ id: d.id, ...d.data() }) as JourneyLike)

  const total = fixtures.length + journeys.length
  const allRecords: PlayerMatch[] = []
  let done = 0

  for (const fixture of fixtures) {
    onProgress?.(done++, total, `Fixture · ${fixture.opponent ?? fixture.id}`)
    const [events, tagged] = await Promise.all([readEvents(fixture.id), readTaggedPlayerIds(fixture.id)])
    allRecords.push(...recordsForFixture(fixture, events, tagged))
  }
  for (const journey of journeys) {
    onProgress?.(done++, total, `Journey · ${journey.title ?? journey.id}`)
    allRecords.push(...recordsForJourney(journey))
  }

  // One replacement for the whole collection, so a player dropped from a squad sheet loses
  // their records rather than keeping them for ever.
  const existing = await getDocs(collection(db, "playerMatches"))
  const playerIds = new Set(allRecords.map((r) => r.playerId))
  for (const d of existing.docs) {
    const id = d.data().playerId as string | undefined
    if (id) playerIds.add(id)
  }

  const cleared = await saveMatchRecords(allRecords, {})
  // `saveMatchRecords` only clears by fixture or journey; a full rebuild needs the stale rows
  // that belong to neither, so they are deleted here.
  const keep = new Set(allRecords.map((r) => r.id))
  const stale = existing.docs.filter((d) => !keep.has(d.id))
  if (stale.length) {
    const { writeBatch } = await import("firebase/firestore")
    for (let i = 0; i < stale.length; i += 400) {
      const batch = writeBatch(db)
      for (const d of stale.slice(i, i + 400)) batch.delete(d.ref)
      await batch.commit()
    }
  }

  const totals = await recomputeMany([...playerIds, ...cleared])
  onProgress?.(total, total, "")
  await refreshPublic("players")

  return {
    records: allRecords.length,
    playersUpdated: Object.keys(totals).length,
    fixtures: fixtures.length,
    journeys: journeys.length,
  }
}
