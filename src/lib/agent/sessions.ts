"use client"

/**
 * Persistent conversations for the staff assistant.
 *
 * A conversation is a session document plus a `messages` subcollection. The messages are a
 * subcollection rather than an array on the session for one reason: an array has to be rewritten
 * whole on every turn and is capped by Firestore's 1 MB document limit, so a long working session
 * would eventually fail to save with no warning. A subcollection appends and never grows a single
 * document.
 *
 * ## Why the wire transcript, exactly as sent
 *
 * The stored messages are the same `AgentMessage` objects the model is sent — including the
 * assistant's `tool_calls` turns and the `tool` results that answer them. That is not laziness: an
 * OpenAI-shaped conversation is only valid if each tool result is preceded by the assistant turn
 * that requested it, so trimming or reshaping the history on load would produce a transcript the
 * model rejects, or worse, one it misreads. Replaying what was sent is what keeps a resumed
 * session behaving like an unbroken one.
 *
 * That is also why `visible` is stored separately. The wire transcript is not what the person
 * reads — it contains raw JSON tool payloads and duplicated assistant turns — so each session also
 * carries the rendered items the UI shows. Reconstructing the view from the wire format would mean
 * parsing the model's own output back out, which is both fragile and unnecessary.
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { clean } from "@/lib/collections"
import type { AgentMessage } from "./tools"

export const SESSIONS = "agentSessions"

/** One rendered item, as the console shows it. Mirrors the `Item` union in the page. */
export type StoredItem =
  | { kind: "user"; text: string; files?: string[] }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; name: string; label: string; risk: string; summary?: string; ok?: boolean }
  | { kind: "error"; text: string }

export type Session = {
  id: string
  title: string
  /** Owner uid, so a shared staff console doesn't mix two people's conversations. */
  ownerUid?: string
  createdAt?: unknown
  updatedAt?: unknown
  messageCount?: number
}

/**
 * The visible transcript, stored alongside the wire transcript.
 *
 * Batched with the turn rather than written per item: a turn can produce ten items, and ten round
 * trips on every exchange would be felt. Batched writes are also atomic, so a half-saved turn
 * can't leave the view disagreeing with the history.
 *
 * Every document goes through `clean` first. It is the same guard `saveDoc` has always applied, but
 * this writes through a batch rather than `saveDoc`, so it has to be applied by hand — and one
 * unset optional field would otherwise fail the whole batch. See `collections.ts` for the guard.
 */
export async function saveTurn(
  sessionId: string,
  items: StoredItem[],
  wire: AgentMessage[],
  opts: { title?: string } = {}
) {
  const batch = writeBatch(db)
  const messages = collection(db, SESSIONS, sessionId, "messages")

  for (const item of items) {
    batch.set(doc(messages), clean({ ...item, at: serverTimestamp() }) as Record<string, unknown>)
  }
  for (const message of wire) {
    // Tagged so a future change to the wire format can find the transcript it applies to.
    batch.set(doc(messages), clean({ kind: "wire", message, at: serverTimestamp() }) as Record<string, unknown>)
  }

  batch.set(
    doc(db, SESSIONS, sessionId),
    {
      updatedAt: serverTimestamp(),
      // Counted rather than stored as a number the caller has to know, so two turns saved from
      // different places cannot clobber each other's count.
      messageCount: increment(items.length + wire.length),
      // Only set on the first turn, so a conversation keeps the name it was given.
      ...(opts.title ? { title: opts.title } : {}),
    },
    { merge: true }
  )

  await batch.commit()
}

export async function createSession(ownerUid: string | undefined, title: string): Promise<string> {
  const ref = await addDoc(collection(db, SESSIONS), {
    title,
    ownerUid: ownerUid ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    messageCount: 0,
  })
  return ref.id
}

export async function renameSession(sessionId: string, title: string) {
  await updateDoc(doc(db, SESSIONS, sessionId), { title, updatedAt: serverTimestamp() })
}

/**
 * The conversations this staff member can reopen, newest first.
 *
 * Filtered by owner so two people sharing the console don't read each other's conversations, and
 * sorted here rather than in the query: an `orderBy` alongside the `ownerUid` filter needs a
 * composite index, and a missing index would empty this list — the conversations would still
 * exist but the sidebar would look like they had vanished.
 */
export async function listSessions(ownerUid?: string): Promise<Session[]> {
  const base = collection(db, SESSIONS)
  const snap = await getDocs(ownerUid ? query(base, where("ownerUid", "==", ownerUid)) : base)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Session)
    .sort((a, b) => stamp(b.updatedAt) - stamp(a.updatedAt))
}

/** Reads a Firestore Timestamp, a Date or a plain value into a comparable number. */
function stamp(value: unknown): number {
  if (!value) return 0
  if (typeof value === "object" && "seconds" in (value as Record<string, unknown>)) {
    return Number((value as { seconds: number }).seconds)
  }
  if (value instanceof Date) return value.getTime()
  const parsed = Date.parse(String(value))
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Deletes a conversation and its messages.
 *
 * The journal entries are deliberately left alone. They are the record of what was changed in the
 * database, and it still needs to be true after the chat that caused it is gone — otherwise
 * deleting a conversation would quietly make its changes permanent.
 */
export async function deleteSession(sessionId: string) {
  const snap = await getDocs(collection(db, SESSIONS, sessionId, "messages"))
  // 500 per batch, under Firestore's limit of 500 writes.
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = writeBatch(db)
    for (const d of snap.docs.slice(i, i + 450)) batch.delete(d.ref)
    await batch.commit()
  }
  await deleteDoc(doc(db, SESSIONS, sessionId))
}

export type LoadedSession = {
  wire: AgentMessage[]
  items: StoredItem[]
}

/**
 * Reads a conversation back into the two transcripts the console needs.
 *
 * `orderBy("at")` needs an index on the subcollection; without one Firestore still returns the
 * documents, just unordered, so the fallback sorts client-side rather than failing to open a
 * saved conversation at all.
 */
export async function loadSession(sessionId: string): Promise<LoadedSession> {
  let docs: { data: () => Record<string, unknown>; id: string }[] = []
  try {
    const snap = await getDocs(query(collection(db, SESSIONS, sessionId, "messages"), orderBy("at")))
    docs = snap.docs as never
  } catch {
    const snap = await getDocs(collection(db, SESSIONS, sessionId, "messages"))
    docs = snap.docs as never
  }

  const wire: AgentMessage[] = []
  const items: StoredItem[] = []

  for (const d of docs) {
    const data = d.data()
    if (data.kind === "wire") {
      wire.push(data.message as AgentMessage)
    } else if (typeof data.kind === "string") {
      items.push(data as unknown as StoredItem)
    }
  }

  return { wire, items }
}

/** Derives a conversation title from its first message, so the list is readable without naming. */
export function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean || "New conversation"
}
