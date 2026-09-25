"use client"

import { prepareImage } from "./image-prep"
import { putToUrl } from "./put-to-url"
import { createSignupUploadUrl, signupStorageUsage } from "./signup-actions"
import type { SignupUploadKind } from "./signup-limits"

export type UploadedFile = {
  url: string
  key: string
  bytes: number
  name: string
  kind: SignupUploadKind
}

/** Which crop/scale profile each kind is prepared with before upload. */
const PROFILE_KEY: Record<SignupUploadKind, string> = {
  photo: "players",
  gallery: "galleries",
  video: "media",
}

/** A fresh id per form load. Scopes every upload to this one submission. */
export function newSignupSessionId() {
  return crypto.randomUUID()
}

/**
 * Prepares a file, asks the server for a tightly-scoped upload URL, then PUTs it.
 *
 * All three steps matter: the prep keeps a 12 MP phone photo from becoming a 6 MB card
 * image, the server decides both the key and whether the player has room left, and the
 * pinned Content-Length on the signed URL stops anything bigger than it accounted for.
 */
export async function uploadSignupFile(
  sessionId: string,
  file: File,
  kind: SignupUploadKind,
  onProgress?: (pct: number) => void
): Promise<UploadedFile> {
  if (!file.type) {
    throw new Error(`"${file.name}" has no recognised file type. Use JPG, PNG, WebP or MP4.`)
  }

  const prepared = await prepareImage(file, PROFILE_KEY[kind])
  const signed = await createSignupUploadUrl(sessionId, kind, prepared.name, prepared.type, prepared.size)
  await putToUrl(signed.uploadUrl, prepared, onProgress)

  return { url: signed.publicUrl, key: signed.key, bytes: prepared.size, name: file.name, kind }
}

/** Real storage usage, measured from the bucket. */
export async function fetchStorageUsage(sessionId: string) {
  return signupStorageUsage(sessionId)
}
