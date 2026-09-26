"use client"

/**
 * Undo for everything the assistant changes.
 *
 * ## The approach: record what was there, then put it back
 *
 * Every mutating tool declares how its work can be reversed, and the reversal is stored **before**
 * the write happens. Undo is not an inference about what probably changed — it is the previous
 * contents of the specific documents that were touched, written back verbatim. There is no
 * guessing, and the assistant's own description of what it did never determines what undo does.
 *
 * ## Derived data is recomputed, not snapshotted
 *
 * Player statistics and match records are *functions* of their source — a fixture and its events.
 * So undo does not store before-images of them. It restores the source and asks the app to
 * re-derive, which produces exactly the state that source implies. Two reasons this beats
 * snapshotting:
 *
 *   - **Correctness.** A snapshot restores a stale copy. Re-derivation computes from the current
 *     source, so it is still right if something else changed the same records in between.
 *   - **Size.** Recording a result can touch a dozen `playerMatches` documents. Restoring one
 *     fixture and re-deriving is one write instead of a dozen, and cannot drift.
 *
 * The exception is restoring a *deleted* fixture: those records are gone and their source is
 * coming back, so they are captured and restored directly.
 *
 * ## Partial reversal is better than none
 *
 * Deleting a fixture also deletes its logo from object storage, which is genuinely unrecoverable.
 * Rather than refusing the whole undo over that, an `irreversible` op is informational: the
 * reversible ops are applied and the outcome says plainly what could not be brought back. A
 * button that restored eleven of twelve things and said so is more useful than no button.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { syncFixtureRecords, syncJourneyRecords } from "@/lib/match-sync"
import { recomputeMany } from "@/lib/player-matches-client"

export const ACTIONS = "agentActions"

/**
 * One reversible step.
 *
 * `restore` with `data: null` means the document did not exist before, so reversing it means
 * deleting it. That single case covers both "put this back" and "remove what I created", which is
 * why creation needs no separate op type.
 */
export type UndoOp =
  | { kind: "restore"; collection: string; id: string; data: Record<string, unknown> | null }
  /** Rebuild a match's derived records from the restored fixture. */
  | { kind: "recompute_fixture"; fixtureId: string }
  /**
   * Rebuild a tour's derived records from the restored journey.
   *
   * A tour is not a match: its squad sheet carries per-player goals and assists for the whole
   * trip, and the appearances are the number of matches it played. Undoing a squad-sheet change
   * therefore restores the journey and re-derives, exactly as a fixture does — but through a
   * different function, because the two sources are shaped differently.
   */
  | { kind: "recompute_journey"; journeyId: string }
  /** Something that cannot be taken back. Recorded so the outcome can say what is missing. */
  | { kind: "irreversible"; why: string }

export type JournalEntry = {
  id: string
  sessionId: string | null
  tool: string
  args: unknown
  summary: string
  at?: unknown
  ops: UndoOp[]
  /** True once reversed, so it can never be applied twice. */
  undone?: boolean
  undoneAt?: unknown
}

/**
 * Handed to every executor so it can describe its own reversal as it works.
 *
 * Executors call these once they know what they are about to touch, which is always after they
 * have read the document to resolve a reference — so capturing usually costs no extra read.
 */
export type Journal = {
  /** Remember a document's current contents, before changing it. */
  capture(collectionName: string, id: string): Promise<void>
  /** Remember a set of documents already in hand, before changing them. */
  captureAll(collectionName: string, docs: { id: string; data: Record<string, unknown> }[]): void
  /** Remember that a document is being created, so undo removes it. */
  created(collectionName: string, id: string | null | undefined): void
  /** Rebuild a match's derived records after restoring it. */
  recomputeFixture(fixtureId: string): void
  /** Rebuild a tour's derived records after restoring it. */
  recomputeJourney(journeyId: string): void
  /** Note something that cannot be restored. Does not block the rest of the undo. */
  irreversible(why: string): void
}

/** Builds a journal for one tool call. The `ops` array is what gets persisted. */
export function beginJournal(): { journal: Journal; ops: UndoOp[] } {
  const ops: UndoOp[] = []
  const seen = (collectionName: string, id: string) =>
    ops.some((o) => o.kind === "restore" && o.collection === collectionName && o.id === id)

  const journal: Journal = {
    async capture(collectionName, id) {
      // Once per document. A tool that reads and writes the same doc twice must not record the
      // second, already-modified state as the "before" — undo would then restore its own output.
      if (seen(collectionName, id)) return
      const snap = await getDoc(doc(db, collectionName, id))
      ops.push({
        kind: "restore",
        collection: collectionName,
        id,
        data: snap.exists() ? (snap.data() as Record<string, unknown>) : null,
      })
    },
    captureAll(collectionName, docs) {
      for (const d of docs) {
        if (!seen(collectionName, d.id)) ops.push({ kind: "restore", collection: collectionName, id: d.id, data: d.data })
      }
    },
    created(collectionName, id) {
      if (!id || seen(collectionName, id)) return
      ops.push({ kind: "restore", collection: collectionName, id, data: null })
    },
    recomputeFixture(fixtureId) {
      if (ops.some((o) => o.kind === "recompute_fixture" && o.fixtureId === fixtureId)) return
      ops.push({ kind: "recompute_fixture", fixtureId })
    },
    recomputeJourney(journeyId) {
      if (ops.some((o) => o.kind === "recompute_journey" && o.journeyId === journeyId)) return
      ops.push({ kind: "recompute_journey", journeyId })
    },
    irreversible(why) {
      ops.push({ kind: "irreversible", why })
    },
  }
  return { journal, ops }
}

/** Reversible if anything changed and it hasn't been reversed. Unrestorable parts don't block it. */
export function isUndoable(entry: Pick<JournalEntry, "ops" | "undone">): boolean {
  return !entry.undone && entry.ops.some((o) => o.kind !== "irreversible")
}

/** Plain-English explanation for the history panel. */
export function undoNote(entry: Pick<JournalEntry, "ops" | "undone">): string {
  if (entry.undone) return "Already undone."

  const blocked = entry.ops.filter((o): o is Extract<UndoOp, { kind: "irreversible" }> => o.kind === "irreversible")
  const why = blocked.map((o) => o.why).join(" ")
  const hasReversible = entry.ops.some((o) => o.kind !== "irreversible")

  // "Partly reversible" would be a lie when nothing at all can come back, and the distinction is
  // the one thing this line exists to communicate.
  if (blocked.length && !hasReversible) return `Cannot be undone — ${why}`
  if (blocked.length) return `Partly reversible — ${why}`
  if (!entry.ops.length) return "Nothing was changed."
  return "Can be undone."
}

/** Persists one action. Never throws; the tool already succeeded and must not fail over its log. */
export async function recordAction(entry: {
  sessionId: string | null
  tool: string
  args: unknown
  summary: string
  ops: UndoOp[]
}): Promise<string | null> {
  try {
    const ref = await addDoc(collection(db, ACTIONS), {
      sessionId: entry.sessionId,
      tool: entry.tool,
      args: entry.args ?? null,
      summary: entry.summary,
      ops: entry.ops,
      undone: false,
      at: serverTimestamp(),
    })
    return ref.id
  } catch (err) {
    console.warn("[ccfc] could not record the assistant's action:", err)
    return null
  }
}

/** Reads one journal entry by id. Used when undo is triggered from a transcript line. */
export async function getAction(id: string): Promise<JournalEntry | null> {
  const snap = await getDoc(doc(db, ACTIONS, id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as JournalEntry) : null
}

/** Recent actions, newest first. `sessionId` narrows it to one conversation; omit for all. */
export async function listActions(opts: { sessionId?: string; limit?: number } = {}): Promise<JournalEntry[]> {
  const max = Math.min(200, opts.limit ?? 40)
  const base = collection(db, ACTIONS)
  try {
    const q = opts.sessionId
      ? query(base, where("sessionId", "==", opts.sessionId), orderBy("at", "desc"), limit(max))
      : query(base, orderBy("at", "desc"), limit(max))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as JournalEntry)
  } catch {
    // A missing composite index would otherwise make the panel unopenable, which is the one time
    // it is most needed. Falls back to reading the collection and sorting here.
    const snap = await getDocs(base)
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as JournalEntry)
      .filter((e) => !opts.sessionId || e.sessionId === opts.sessionId)
      .sort((a, b) => stampOf(b.at) - stampOf(a.at))
      .slice(0, max)
  }
}

/** Reads a Firestore Timestamp, a Date or a plain value into a comparable number. */
function stampOf(value: unknown): number {
  if (!value) return 0
  if (typeof value === "object" && "seconds" in (value as Record<string, unknown>)) {
    return Number((value as { seconds: number }).seconds)
  }
  if (value instanceof Date) return value.getTime()
  const parsed = Date.parse(String(value))
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Reverses one action.
 *
 * Ops are applied **in reverse** order, because a tool may have created a document and then
 * written to a second one that refers to it — undoing forwards could delete something a later op
 * expects to exist.
 *
 * Marked undone only after every reversible op succeeds, so a failure part-way through leaves the
 * entry available to try again rather than falsely recording a reversal that did not happen.
 */
export async function undoAction(entry: JournalEntry): Promise<{ ok: boolean; message: string; missing?: string[] }> {
  if (entry.undone) return { ok: false, message: "That has already been undone." }

  const reversible = entry.ops.filter((o) => o.kind !== "irreversible")
  if (!reversible.length) {
    return { ok: false, message: "There is nothing here that can be restored." }
  }

  const missing = entry.ops
    .filter((o): o is Extract<UndoOp, { kind: "irreversible" }> => o.kind === "irreversible")
    .map((o) => o.why)

  /*
   * Restores first, then rebuilds — not the journal's order reversed.
   *
   * A rebuild reads the fixture to decide what the records should be, so it has to see the fixture
   * as it was *before* the action. Running the ops in reverse order would rebuild from the
   * post-action state and only then restore the fixture, leaving records that describe a match that
   * no longer exists in that form.
   */
  const restores = reversible.filter((o): o is Extract<UndoOp, { kind: "restore" }> => o.kind === "restore").reverse()
  const rebuilds = reversible.filter(
    (o): o is Extract<UndoOp, { kind: "recompute_fixture" | "recompute_journey" }> =>
      o.kind === "recompute_fixture" || o.kind === "recompute_journey"
  )

  let restored = 0
  try {
    for (const op of restores) {
      const ref = doc(db, op.collection, op.id)
      if (op.data === null) await deleteDoc(ref)
      else await setDoc(ref, op.data)

      /*
       * A deleted match takes its player records with it, and they are not derived from anything
       * that still exists — so nothing would ever remove them, and they would keep crediting
       * appearances for a match that isn't there. `syncFixtureRecords` cannot help: it returns
       * early when the fixture is gone, precisely so it can't wipe a match mid-creation.
       */
      if (op.collection === "fixtures" && op.data === null) await dropRecordsFor("fixtureId", op.id)
      if (op.collection === "journeys" && op.data === null) await dropRecordsFor("journeyId", op.id)
      restored++
    }

    for (const op of rebuilds) {
      if (op.kind === "recompute_fixture") await syncFixtureRecords(op.fixtureId)
      else await syncJourneyRecords(op.journeyId)
    }

    await updateDoc(doc(db, ACTIONS, entry.id), { undone: true, undoneAt: serverTimestamp() })

    return {
      ok: true,
      missing: missing.length ? missing : undefined,
      message: missing.length
        ? `Reversed ${restored} change${restored === 1 ? "" : "s"} — but not everything could be: ${missing.join(" ")}`
        : `Reversed ${restored} change${restored === 1 ? "" : "s"}.`,
    }
  } catch (err) {
    return { ok: false, message: `Could not undo: ${(err as Error).message}` }
  }
}

/**
 * Removes the player records a vanished source wrote, and recomputes who they credited.
 *
 * A record is only meaningful while its fixture or journey is, so an orphan is not merely untidy —
 * it keeps crediting an appearance for a match or tour that no longer exists.
 */
async function dropRecordsFor(field: "fixtureId" | "journeyId", id: string) {
  const snap = await getDocs(query(collection(db, "playerMatches"), where(field, "==", id)))
  const affected = new Set<string>()
  for (const d of snap.docs) {
    const playerId = d.data().playerId as string | undefined
    if (playerId) affected.add(playerId)
    await deleteDoc(d.ref)
  }
  /*
   * The players have to be recomputed, or they keep the appearance.
   *
   * A player's displayed totals are their records summed, so removing the records is half the job —
   * the other half is that nothing else will ever look at these players again. Their totals would
   * go on counting a match that has been deleted, which is precisely the drift the record-based
   * design exists to prevent.
   */
  if (affected.size) await recomputeMany([...affected])
}
