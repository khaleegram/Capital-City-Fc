/**
 * Shared constants and helpers for the public /join upload flow.
 *
 * Lives outside `signup-actions.ts` because a "use server" module may only export
 * async functions — constants have to be importable from both the server action
 * and the browser form.
 */

/** Every player gets one gigabyte of club storage for photos and footage. */
export const SIGNUP_STORAGE_LIMIT = 1024 * 1024 * 1024

export type SignupUploadKind = "photo" | "gallery" | "video"

export const SIGNUP_UPLOAD_KINDS: SignupUploadKind[] = ["photo", "gallery", "video"]

/** Object keys are `signups/{sessionId}/{kind}/{uuid}-{name}`, so approval can route by kind. */
export const SIGNUP_ROOT = "signups"

/** Where each kind lands once staff approve the profile. */
export const SIGNUP_DEST_PREFIX: Record<SignupUploadKind, string> = {
  photo: "players",
  gallery: "galleries",
  video: "media",
}

export function signupPrefix(sessionId: string): string {
  return `${SIGNUP_ROOT}/${sessionId}/`
}

/**
 * Guards against path traversal: the session id is used inside an S3 key, so it has to
 * be a plain UUID and nothing else.
 */
export function isSignupSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function signupObjectKey(sessionId: string, kind: SignupUploadKind, fileName: string): string {
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "file"
  return `${signupPrefix(sessionId)}${kind}/${crypto.randomUUID()}-${safeName}`
}

/** Recovers the kind from a stored key so approval can route it to the right prefix. */
export function kindFromKey(key: string): SignupUploadKind | null {
  const segment = key.split("/")[2]
  return segment === "photo" || segment === "gallery" || segment === "video" ? segment : null
}

const UNITS = ["B", "KB", "MB", "GB"] as const

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB"
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  // Bytes/KB read better as whole numbers; MB/GB want one decimal.
  return `${unit <= 1 ? Math.round(value) : value.toFixed(value >= 100 ? 0 : 1)} ${UNITS[unit]}`
}

export function percentUsed(bytes: number, limit = SIGNUP_STORAGE_LIMIT): number {
  if (limit <= 0) return 0
  return Math.max(0, Math.min(100, (bytes / limit) * 100))
}
