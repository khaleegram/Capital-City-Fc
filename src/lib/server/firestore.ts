import "server-only"

import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Server-side Firestore access for public pages.
 *
 * Uses firebase-admin when credentials are available (FIREBASE_SERVICE_ACCOUNT,
 * GOOGLE_APPLICATION_CREDENTIALS or local gcloud ADC). Otherwise falls back to
 * the lightweight client SDK, which is bound by firestore.rules, so every public
 * query must only ask for data the rules already expose (e.g. `published == true`).
 */

type Op = "==" | "!=" | "<" | "<=" | ">" | ">=" | "array-contains" | "in"
export type Where = [field: string, op: Op, value: unknown]
export type QueryOpts = { where?: Where[]; limit?: number }

type Backend = {
  list(path: string, opts?: QueryOpts): Promise<Record<string, unknown>[]>
  get(path: string, id: string): Promise<Record<string, unknown> | null>
}

function hasAdminCredentials() {
  if (process.env.CCFC_DATA_BACKEND === "lite") return false
  if (process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS) return true
  if (process.env.VERCEL) return false
  return existsSync(join(homedir(), ".config", "gcloud", "application_default_credentials.json"))
}

/** Converts Firestore Timestamps (admin or client) into ISO strings so data can cross the RSC boundary. */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map((v) => serialize(v)) as T
  if (typeof value === "object") {
    const v = value as Record<string, unknown> & { toDate?: () => Date }
    if (typeof v.toDate === "function") return v.toDate().toISOString() as T
    if (value instanceof Date) return value.toISOString() as T
    // Firestore GeoPoint / DocumentReference → keep it simple.
    if ("latitude" in v && "longitude" in v && Object.keys(v).length <= 2) {
      return { lat: v.latitude, lng: v.longitude } as T
    }
    if ("path" in v && "firestore" in v) return (v as { path: string }).path as T
    const out: Record<string, unknown> = {}
    for (const [k, inner] of Object.entries(v)) out[k] = serialize(inner)
    return out as T
  }
  return value
}

async function createAdminBackend(): Promise<Backend> {
  const { getApps, initializeApp, cert, applicationDefault } = await import("firebase-admin/app")
  const { getFirestore } = await import("firebase-admin/firestore")
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const app =
    getApps().find((a) => a.name === "ccfc-server") ??
    initializeApp(
      {
        credential: process.env.FIREBASE_SERVICE_ACCOUNT
          ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
          : applicationDefault(),
        projectId,
      },
      "ccfc-server"
    )
  const db = getFirestore(app)
  return {
    async list(path, opts = {}) {
      let q: FirebaseFirestore.Query = db.collection(path)
      for (const [f, op, val] of opts.where ?? []) q = q.where(f, op, val)
      if (opts.limit) q = q.limit(opts.limit)
      const snap = await q.get()
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    },
    async get(path, id) {
      const d = await db.collection(path).doc(id).get()
      return d.exists ? { id: d.id, ...d.data() } : null
    },
  }
}

async function createLiteBackend(): Promise<Backend> {
  const { initializeApp, getApps } = await import("firebase/app")
  const lite = await import("firebase/firestore/lite")
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }
  const app = getApps().find((a) => a.name === "ccfc-lite") ?? initializeApp(config, "ccfc-lite")
  const db = lite.getFirestore(app)
  return {
    async list(path, opts = {}) {
      const constraints = [
        ...(opts.where ?? []).map(([f, op, val]) => lite.where(f, op, val)),
        ...(opts.limit ? [lite.limit(opts.limit)] : []),
      ]
      const snap = await lite.getDocs(lite.query(lite.collection(db, path), ...constraints))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    },
    async get(path, id) {
      const d = await lite.getDoc(lite.doc(db, path, id))
      return d.exists() ? { id: d.id, ...d.data() } : null
    },
  }
}

let backendPromise: Promise<Backend> | null = null

function backend(): Promise<Backend> {
  if (!backendPromise) {
    backendPromise = (hasAdminCredentials() ? createAdminBackend() : createLiteBackend()).catch((err) => {
      console.warn("[ccfc] admin Firestore unavailable, using lite client:", err?.message)
      return createLiteBackend()
    })
  }
  return backendPromise
}

/** Lists a collection. Never throws. Public pages should degrade to empty states. */
export async function listDocs<T>(path: string, opts?: QueryOpts): Promise<T[]> {
  try {
    const rows = await (await backend()).list(path, opts)
    return serialize(rows) as T[]
  } catch (err) {
    console.error(`[ccfc] listDocs(${path}) failed:`, (err as Error)?.message)
    return []
  }
}

export async function getDocById<T>(path: string, id: string): Promise<T | null> {
  try {
    const row = await (await backend()).get(path, id)
    return row ? (serialize(row) as T) : null
  } catch (err) {
    console.error(`[ccfc] getDocById(${path}/${id}) failed:`, (err as Error)?.message)
    return null
  }
}
