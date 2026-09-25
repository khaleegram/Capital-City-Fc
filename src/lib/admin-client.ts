"use client"

import { auth } from "@/lib/firebase"
import { revalidatePublic } from "@/lib/revalidate"
import { createUploadUrl, storageBackend } from "@/lib/upload-actions"
import { deleteR2Object } from "@/lib/r2"
import type { CacheTag } from "@/lib/cache-tags"

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

const HEIC_RE = /\.(heic|heif)$/i
const WEBP_QUALITY = 0.82
const JPEG_QUALITY = 0.85

/**
 * The box an upload is displayed in. Cutting a file to that box at upload time means
 * the browser downloads pixels it will actually show, instead of a 12 MP phone photo
 * being squeezed into a 480 px card.
 *
 * `fit` crop-fills an exact box, anchored to the top to mirror `object-cover object-top`.
 * `max` keeps the original shape and only caps the longest edge.
 * Prefixes with no entry — `team/` and `fixtures/`, which hold wide brand artwork —
 * are uploaded untouched, because cropping those to a portrait box would ruin them.
 */
type ImageProfile = { kind: "fit"; width: number; height: number } | { kind: "max"; max: number }

const IMAGE_PROFILES: Record<string, ImageProfile> = {
  players: { kind: "fit", width: 1200, height: 1600 }, // 3:4 card — components/site/cards.tsx
  staff: { kind: "fit", width: 1000, height: 1250 }, // 4:5 portrait
  placements: { kind: "fit", width: 1000, height: 1250 }, // 4:5 portrait
  galleries: { kind: "max", max: 2048 },
  news: { kind: "max", max: 1600 },
  journeys: { kind: "max", max: 1600 },
  media: { kind: "max", max: 1600 },
}

/**
 * iPhones shoot HEIC/HEIF by default, and no engine except Safari can decode it, so
 * hand the bytes to a WASM decoder first. `heic2any` is ~1.3 MB, hence the lazy import.
 */
async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  let blob: Blob = file
  if (/^image\/(heic|heif)$/i.test(file.type) || HEIC_RE.test(file.name)) {
    const { default: heic2any } = await import("heic2any")
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 })
    blob = Array.isArray(out) ? out[0] : out
  }
  return createImageBitmap(blob)
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Resizes an image to the box its prefix is displayed in, and encodes it for the web. */
async function prepareImage(file: File, prefix: string): Promise<File> {
  if (!file.type.startsWith("image/")) return file // videos go through untouched
  const profile = IMAGE_PROFILES[prefix.split("/")[0]]
  if (!profile) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await decodeToBitmap(file)
  } catch {
    throw new Error(`Could not read "${file.name}". Try converting it to JPG first.`)
  }

  try {
    const { width: sw, height: sh } = bitmap
    let sx = 0
    let sy = 0
    let cw = sw
    let ch = sh

    if (profile.kind === "fit") {
      // Cover-crop the source to the target shape, keeping the top of the frame.
      if (sw / sh > profile.width / profile.height) cw = sh * (profile.width / profile.height)
      else ch = sw / (profile.width / profile.height)
      sx = (sw - cw) / 2
    }

    // Never upscale: a 600 px photo stays 600 px rather than being blown up to 1200.
    const target = profile.kind === "fit" ? profile.width / cw : profile.max / Math.max(cw, ch)
    const scale = Math.min(1, target)
    const outW = Math.round(cw * scale)
    const outH = Math.round(ch * scale)

    const canvas = document.createElement("canvas")
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("This browser could not process the image.")
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(bitmap, sx, sy, cw, ch, 0, 0, outW, outH)

    // WebP first. Safari before 14 silently gives back a PNG, so fall back to JPEG.
    let out = await toBlob(canvas, "image/webp", WEBP_QUALITY)
    if (!out || out.type !== "image/webp") out = await toBlob(canvas, "image/jpeg", JPEG_QUALITY)
    if (!out) throw new Error(`Could not process "${file.name}".`)

    // If re-encoding made the file bigger and the original was already web-friendly, keep it.
    if (out.size >= file.size && /^image\/(webp|jpeg)$/.test(file.type)) return file

    const ext = out.type === "image/webp" ? ".webp" : ".jpg"
    return new File([out], file.name.replace(/\.[^.]+$/, "") + ext, { type: out.type })
  } finally {
    bitmap.close()
  }
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
  const prepared = await prepareImage(file, prefix)
  if (!prepared.type) {
    throw new Error(`"${prepared.name}" has no recognised file type. Use JPG, PNG, WebP or MP4.`)
  }
  return (await resolveBackend()) === "r2"
    ? uploadToR2(prepared, prefix, onProgress)
    : uploadToFirebaseStorage(prepared, prefix, onProgress)
}

async function uploadToR2(file: File, prefix: string, onProgress?: (pct: number) => void) {
  const { uploadUrl, publicUrl } = await createUploadUrl(await idToken(), prefix, file.name, file.type)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl)
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage rejected the upload (HTTP ${xhr.status}).`)))
    xhr.onerror = () =>
      reject(new Error("The upload never reached storage. The R2 bucket needs a CORS policy allowing PUT from this site."))
    xhr.send(file)
  })
  return publicUrl
}

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

/** Reads natural dimensions of an image file (used for gallery layout without CLS). */
export function imageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => resolve({ w: 0, h: 0 })
    img.src = url
  })
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
