"use client"

import { auth } from "@/lib/firebase"
import { revalidatePublic } from "@/lib/revalidate"
import { createUploadUrl, storageBackend } from "@/lib/upload-actions"
import { deleteR2Object } from "@/lib/r2"
import { discardSignupUploads, promoteSignupUploads } from "@/lib/signup-actions"
import { prepareImage } from "@/lib/image-prep"
import { putToUrl } from "@/lib/put-to-url"
import type { CacheTag } from "@/lib/cache-tags"

// Re-exported so existing admin screens keep importing them from here.
export { imageSize, prepareImage } from "@/lib/image-prep"

async function idToken() {
  const user = auth.currentUser
  if (!user) throw new Error("Please sign in again.")
  return user.getIdToken()
}

/** Busts the public cache for the given tags. Never throws: a failed refresh shouldn't fail a save. */
export async function refreshPublic(...tags: CacheTag[]) {
  try {
    await revalidatePublic(await idToken(), tags)
  } catch (err) {
    console.warn("[ccfc] cache refresh failed", err)
  }
}

/**
 * Sends a push notification to every subscribed device.
 *
 * This replaced the Cloud Functions callable. Throws so the admin composer can show why
 * a broadcast failed; use `notifyQuietly` where a failed push shouldn't fail the save.
 */
export async function notifyAll(title: string, body: string, url = "/") {
  const res = await fetch("/api/admin/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await idToken()}` },
    body: JSON.stringify({ title, body, url }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; failed?: number; devices?: number }
  if (!res.ok) throw new Error(data.error || "Could not send notifications.")
  return data
}

/** Same as `notifyAll`, but never throws. Used after a save so a failed push can't undo published content. */
export async function notifyQuietly(title: string, body: string, url = "/") {
  try {
    return await notifyAll(title, body, url)
  } catch (err) {
    console.warn("[ccfc] push notification failed", err)
    return null
  }
}

/** Which backend to use, resolved once. Falls back to Firebase only if the probe itself fails. */
let backend: Promise<"r2" | "firebase"> | undefined
function resolveBackend() {
  backend ??= storageBackend().catch(() => "firebase" as const)
  return backend
}

/**
 * Uploads a file to whichever backend is configured.
 *
 * The backend is chosen before uploading rather than by retrying after a failure.
 * A failed R2 PUT means the bucket is misconfigured (almost always a missing CORS
 * policy), and silently retrying against Firebase Storage hides that behind an
 * unrelated error — e.g. "storage/unauthorized" from a bucket that isn't in use.
 */
export async function uploadFile(file: File, prefix: string, onProgress?: (pct: number) => void): Promise<string> {
  const prepared = await prepareImage(file, prefix.split("/")[0])
  if (!prepared.type) {
    throw new Error(`"${prepared.name}" has no recognised file type. Use JPG, PNG, WebP or MP4.`)
  }
  return (await resolveBackend()) === "r2"
    ? uploadToR2(prepared, prefix, onProgress)
    : uploadToFirebaseStorage(prepared, prefix, onProgress)
}

async function uploadToR2(file: File, prefix: string, onProgress?: (pct: number) => void) {
  const { uploadUrl, publicUrl } = await createUploadUrl(await idToken(), prefix, file.name, file.type)
  await putToUrl(uploadUrl, file, onProgress)
  return publicUrl
}

/**
 * Firebase Storage fallback for when R2 isn't configured. Only used by the staff upload path.
 */
async function uploadToFirebaseStorage(file: File, prefix: string, onProgress?: (pct: number) => void) {
  const { ref, uploadBytesResumable, getDownloadURL } = await import("firebase/storage")
  const { storage } = await import("./firebase")
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-80)
  const path = `${prefix}/${crypto.randomUUID()}-${safe}`
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type || "image/jpeg" })
  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (s) => s.totalBytes && onProgress?.(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      reject,
      () => resolve()
    )
  })
  return getDownloadURL(task.snapshot.ref)
}

/** Removes a previously uploaded file. Never throws. */
export async function deleteFile(url: string | undefined | null) {
  if (!url) return
  try {
    await deleteR2Object(await idToken(), url)
  } catch (err) {
    console.warn("[ccfc] file delete failed", err)
  }
}

/**
 * Staff approval of a self sign-up: moves the player's staged files out of
 * `signups/{sessionId}/` into their permanent prefixes. Returns what moved, so the
 * caller can write the final URLs onto the player document.
 */
export async function approveSignupFiles(sessionId: string, playerId: string) {
  return promoteSignupUploads(await idToken(), sessionId, playerId)
}

/** Rejection of a self sign-up: deletes the files and reclaims the player's storage. */
export async function discardSignupFiles(sessionId: string) {
  return discardSignupUploads(await idToken(), sessionId)
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}
