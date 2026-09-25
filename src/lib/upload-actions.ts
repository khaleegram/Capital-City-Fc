"use server"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { v4 as uuidv4 } from "uuid"
import { assertAdmin } from "@/lib/server/verify-admin"

const ALLOWED_PREFIXES = ["media", "galleries", "journeys", "players", "staff", "placements", "news", "team", "fixtures"]

/** Lets the browser pick a backend before uploading, instead of guessing after a failed request. */
export async function storageBackend(): Promise<"r2" | "firebase"> {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
  return R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL
    ? "r2"
    : "firebase"
}

function r2() {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error("File storage (Cloudflare R2) isn't configured on the server yet.")
  }
  return {
    client: new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    }),
    bucket: R2_BUCKET_NAME,
    publicUrl: R2_PUBLIC_URL.replace(/\/$/, ""),
  }
}

/**
 * Returns a short-lived presigned PUT URL so the browser uploads straight to R2.
 * This keeps large videos off the serverless function (Vercel caps request bodies at 4.5 MB).
 */
export async function createUploadUrl(idToken: string, prefix: string, fileName: string, contentType: string) {
  await assertAdmin(idToken)
  if (!ALLOWED_PREFIXES.includes(prefix.split("/")[0])) throw new Error("Invalid upload location.")
  if (!/^(image|video)\//.test(contentType)) throw new Error("Only images and videos can be uploaded.")

  const { client, bucket, publicUrl } = r2()
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-80)
  const key = `${prefix}/${uuidv4()}-${safeName}`
  const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: 60 * 10,
  })
  return { uploadUrl, publicUrl: `${publicUrl}/${key}` }
}
