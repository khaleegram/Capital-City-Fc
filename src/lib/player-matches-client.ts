"use client"

/**
 * Firestore side of the match-record model.
 *
 * `src/lib/player-matches.ts` holds the shapes and the arithmetic and imports nothing; this
 * holds the reads and writes, so the browser admin and the Node backfill script can share the
 * former without dragging the Firebase client SDK into a script that uses `firebase-admin`.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "./firebase"
import {
  aggregate,
  totalStats,
  type PlayerMatch,
  type PlayerStats,
} from "./player-matches"

export const PLAYER_MATCHES = "playerMatches"

/**
 * Writes a set of records for one match or one journey, replacing whatever that match wrote
 * before.
 *
 * Delete-then-set, in one batch, rather than a merge. The record ids are derived from the match
 * (see `matchRecordId`), so a re-save overwrites its own contribution — but a player who has
 * been *removed* from a lineup would otherwise keep their old record for ever, since nothing
 * would ever write over it. Clearing the match's records first is what makes removing someone
 * actually remove them.
 */
export async function saveMatchRecords(
  records: PlayerMatch[],
  clear: { fixtureId?: string; journeyId?: string }
): Promise<string[]> {
  const batch = writeBatch(db)
  const touched = new Set<string>(records.map((r) => r.playerId))

  if (clear.fixtureId) {
    const existing = await getDocs(
      query(collection(db, PLAYER_MATCHES), where("fixtureId", "==", clear.fixtureId))
    )
    for (const d of existing.docs) {
      const playerId = d.data().playerId as string | undefined
      if (playerId) touched.add(playerId)
      batch.delete(d.ref)
    }
  }

  if (clear.journeyId) {
    const existing = await getDocs(
      query(collection(db, PLAYER_MATCHES), where("journeyId", "==", clear.journeyId))
    )
    for (const d of existing.docs) {
      const playerId = d.data().playerId as string | undefined
      if (playerId) touched.add(playerId)
      batch.delete(d.ref)
    }
  }

  for (const r of records) {
    batch.set(doc(db, PLAYER_MATCHES, r.id), { ...r, updatedAt: serverTimestamp() })
  }

  await batch.commit()
  return [...touched]
}

export async function getPlayerRecords(playerId: string): Promise<PlayerMatch[]> {
  const snap = await getDocs(query(collection(db, PLAYER_MATCHES), where("playerId", "==", playerId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PlayerMatch)
}

/**
 * Rebuilds `players/{id}.stats` from that player's records plus their baseline.
 *
 * This is the only thing that should ever write a total, so there is exactly one place where
 * the stored number can go wrong, and re-running it always converges on the same answer.
 */
export async function recomputePlayerStats(playerId: string): Promise<PlayerStats> {
  const playerRef = doc(db, "players", playerId)
  const [playerSnap, records] = await Promise.all([getDoc(playerRef), getPlayerRecords(playerId)])
  const data = playerSnap.data() ?? {}

  const baseline = (data.statsBaseline as PlayerStats | undefined) ?? null
  const total = totalStats(baseline, records)

  // Nothing to do when the number is already right, which is the common case on a re-save.
  const current = data.stats as PlayerStats | undefined
  const same =
    current &&
    current.appearances === total.appearances &&
    current.goals === total.goals &&
    current.assists === total.assists

  if (!same) {
    const batch = writeBatch(db)
    batch.update(playerRef, {
      stats: total,
      // Stamped so the admin can show when the figure was last rebuilt from the records
      // rather than typed.
      statsComputedAt: serverTimestamp(),
    })
    await batch.commit()
  }

  return total
}

/** Recomputes several players in sequence. Returns the new totals keyed by player. */
export async function recomputeMany(playerIds: string[]): Promise<Record<string, PlayerStats>> {
  const out: Record<string, PlayerStats> = {}
  for (const id of [...new Set(playerIds.filter(Boolean))]) {
    out[id] = await recomputePlayerStats(id)
  }
  return out
}

/** Everything the records say for a batch of players, for a breakdown view. */
export async function getRecordsForPlayers(playerIds: string[]): Promise<Record<string, PlayerMatch[]>> {
  const out: Record<string, PlayerMatch[]> = {}
  for (const id of playerIds) out[id] = []
  if (playerIds.length === 0) return out

  // Firestore `in` caps at 30, and a squad can be larger, so this is chunked rather than
  // queried per player.
  const chunkSize = 30
  for (let i = 0; i < playerIds.length; i += chunkSize) {
    const chunk = playerIds.slice(i, i + chunkSize)
    const snap = await getDocs(query(collection(db, PLAYER_MATCHES), where("playerId", "in", chunk)))
    for (const d of snap.docs) {
      const r = { id: d.id, ...d.data() } as PlayerMatch
      ;(out[r.playerId] ??= []).push(r)
    }
  }
  return out
}

export { aggregate, totalStats }
