"use server"

import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { assertAdmin } from "@/lib/server/verify-admin"
import {
  deleteObject,
  deletePrefix,
  keyFromPublicUrl,
  moveObject,
  prefixUsage,
  publicUrlFor,
  r2Storage,
  sumBytes,
} from "@/lib/server/r2-storage"
import {
  SIGNUP_DEST_PREFIX,
  SIGNUP_STORAGE_LIMIT,
  SIGNUP_UPLOAD_KINDS,
  isSignupSessionId,
  kindFromKey,
  signupObjectKey,
  signupPrefix,
  type SignupUploadKind,
} from "@/lib/signup-limits"

/**
 * Uploads for the public /join form.
 *
 * These are the only storage endpoints a non-staff visitor can reach, so they are
 * deliberately narrow:
 *
 *  - the caller gets a URL for exactly one object, at a key we choose, under a prefix
 *    derived from their own session id — they cannot write anywhere else in the bucket;
 *  - the signed request pins ContentLength, so the bucket rejects any body larger than
 *    the size we just accounted for;
 *  - the quota is measured by listing what is actually in the bucket, not by trusting
 *    a total sent from the browser.
 *
 * Withdrawing a submission never needs staff approval first: a rejected profile has its
 * staged objects deleted outright.
 */

export async function createSignupUploadUrl(
  sessionId: string,
  kind: SignupUploadKind,
  fileName: string,
  contentType: string,
  size: number
) {
  if (!isSignupSessionId(sessionId)) {
    throw new Error("This upload session is no longer valid. Reload the page and try again.")
  }
  if (!SIGNUP_UPLOAD_KINDS.includes(kind)) throw new Error("Unsupported upload type.")
  if (!Number.isInteger(size) || size <= 0) throw new Error("That file could not be read.")
  if (!/^(image|video)\//.test(contentType)) throw new Error("Only photos and videos can be uploaded.")

  // A video can't masquerade as a photo (or the reverse), or the public gallery would
  // end up rendering a broken <Image>.
  if (kind === "video" && !contentType.startsWith("video/")) throw new Error("That file isn't a video.")
  if (kind !== "video" && !contentType.startsWith("image/")) throw new Error("That file isn't a photo.")

  const { client, bucket } = r2Storage()
  const objects = await prefixUsage(signupPrefix(sessionId))
  const used = sumBytes(objects)

  if (used + size > SIGNUP_STORAGE_LIMIT) {
    throw new Error("That would take you over your 1 GB of club storage. Remove a file, or talk to the club.")
  }

  const key = signupObjectKey(sessionId, kind, fileName)
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 60 * 15 }
  )

  return {
    uploadUrl,
    publicUrl: publicUrlFor(key),
    key,
    usedBytes: used + size,
    remainingBytes: Math.max(0, SIGNUP_STORAGE_LIMIT - (used + size)),
  }
}

/** Authoritative storage figure, read from the bucket rather than reported by the browser. */
export async function signupStorageUsage(sessionId: string) {
  if (!isSignupSessionId(sessionId)) throw new Error("Invalid upload session.")
  const objects = await prefixUsage(signupPrefix(sessionId))
  const used = sumBytes(objects)
  return {
    usedBytes: used,
    remainingBytes: Math.max(0, SIGNUP_STORAGE_LIMIT - used),
    limitBytes: SIGNUP_STORAGE_LIMIT,
    files: objects.map((o) => ({ key: o.key, bytes: o.bytes, url: publicUrlFor(o.key), kind: kindFromKey(o.key) })),
  }
}

/**
 * Staff approval: moves the submission's files out of staging into their permanent home.
 *
 * R2 copies server-side, so promoting a 200 MB video costs no bandwidth and cannot time
 * out a serverless function the way streaming the bytes down and back up would.
 */
export async function promoteSignupUploads(idToken: string, sessionId: string, playerId: string) {
  await assertAdmin(idToken)
  if (!isSignupSessionId(sessionId)) throw new Error("Invalid upload session.")

  const safePlayer = playerId.replace(/[^a-z0-9-]+/gi, "-").slice(0, 80) || "player"
  const objects = await prefixUsage(signupPrefix(sessionId))

  const promoted: { kind: SignupUploadKind; url: string; bytes: number }[] = []
  for (const object of objects) {
    const kind = kindFromKey(object.key)
    if (!kind) continue
    const name = object.key.split("/").pop() ?? "file"
    const to = `${SIGNUP_DEST_PREFIX[kind]}/${safePlayer}-${name}`
    await moveObject(object.key, to)
    promoted.push({ kind, url: publicUrlFor(to), bytes: object.bytes })
  }
  return promoted
}

/**
 * Rejection (or a withdrawn submission): delete everything it uploaded and reclaim the space.
 */
export async function discardSignupUploads(idToken: string, sessionId: string) {
  await assertAdmin(idToken)
  if (!isSignupSessionId(sessionId)) throw new Error("Invalid upload session.")
  return { removed: await deletePrefix(signupPrefix(sessionId)) }
}

/**
 * Lets a player undo a mistake before submitting — picking the wrong 400 MB video shouldn't
 * permanently cost them their gigabyte.
 *
 * Accepts no key directly: the URL is resolved back to a key, which must sit inside the
 * caller's own session prefix. Anyone who has not seen the file's URL cannot delete it.
 */
export async function deleteSignupUpload(sessionId: string, url: string) {
  if (!isSignupSessionId(sessionId)) throw new Error("Invalid upload session.")
  const key = keyFromPublicUrl(url)
  if (!key || !key.startsWith(signupPrefix(sessionId))) throw new Error("That file isn't part of this submission.")

  await deleteObject(key)

  const objects = await prefixUsage(signupPrefix(sessionId))
  const used = sumBytes(objects)
  return {
    usedBytes: used,
    remainingBytes: Math.max(0, SIGNUP_STORAGE_LIMIT - used),
    limitBytes: SIGNUP_STORAGE_LIMIT,
  }
}
