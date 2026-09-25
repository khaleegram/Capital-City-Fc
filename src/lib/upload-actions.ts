"use server"

import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { v4 as uuidv4 } from "uuid"
import { assertAdmin } from "@/lib/server/verify-admin"
import { r2Storage } from "@/lib/server/r2-storage"

const ALLOWED_PREFIXES = ["media", "galleries", "journeys", "players", "staff", "placements", "news", "team", "fixtures"]

/** Lets the browser pick a backend before uploading, instead of guessing after a failed request. */
export async function storageBackend(): Promise<"r2" | "firebase"> {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
  return R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL
    ? "r2"
    : "firebase"
}

/**
 * Returns a short-lived presigned PUT URL so the browser uploads straight to R2.
 * This keeps large videos off the serverless function (Vercel caps request bodies at 4.5 MB).
 */
export async function createUploadUrl(idToken: string, prefix: string, fileName: string, contentType: string) {
  await assertAdmin(idToken)
  if (!ALLOWED_PREFIXES.includes(prefix.split("/")[0])) throw new Error("Invalid upload location.")
  if (!/^(image|video)\//.test(contentType)) throw new Error("Only images and videos can be uploaded.")

  const { client, bucket, publicUrl } = r2Storage()
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-80)
  const key = `${prefix}/${uuidv4()}-${safeName}`
  const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: 60 * 10,
  })
  return { uploadUrl, publicUrl: `${publicUrl}/${key}` }
}
