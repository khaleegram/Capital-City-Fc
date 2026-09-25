"use client"

import { useEffect, useState } from "react"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore"
import { db } from "./firebase"

export type WithId<T> = T & { id: string }

/** Live list of a collection (or subcollection path) for admin screens. */
export function useCollection<T>(path: string | null, sort?: (a: WithId<T>, b: WithId<T>) => number) {
  const [items, setItems] = useState<WithId<T>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!path) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    return onSnapshot(
      collection(db, path),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WithId<T>)
        setItems(sort ? rows.sort(sort) : rows)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  return { items, loading, error }
}

/** Live single document. */
export function useDocument<T>(path: string | null, id: string | null) {
  const [data, setData] = useState<WithId<T> | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!path || !id) {
      setData(null)
      setLoading(false)
      return
    }
    return onSnapshot(
      doc(db, path, id),
      (snap) => {
        setData(snap.exists() ? ({ id: snap.id, ...snap.data() } as WithId<T>) : null)
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [path, id])
  return { data, loading }
}

/** Firestore rejects `undefined`; strip it (deeply) before writing. */
export function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clean) as T
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = clean(v)
    return out as T
  }
  return value
}

/** Creates (id = null) or merges a document, stamping createdAt / updatedAt. Returns the id. */
export async function saveDoc(path: string, id: string | null, data: DocumentData): Promise<string> {
  const { id: _ignored, ...rest } = data
  const payload = clean(rest)
  if (id) {
    await setDoc(doc(db, path, id), { ...payload, updatedAt: serverTimestamp() }, { merge: true })
    return id
  }
  const ref = await addDoc(collection(db, path), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

export async function removeDoc(path: string, id: string) {
  await deleteDoc(doc(db, path, id))
}
