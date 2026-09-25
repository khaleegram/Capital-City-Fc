"use server"

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { assertAdmin } from "@/lib/server/verify-admin"

/** Deletes an uploaded file by its public URL. Staff only; silently skips non-R2 URLs. */
export async function deleteR2Object(idToken: string, url: string | undefined | null) {
  await assertAdmin(idToken)
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
  if (!url || !R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) return
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) return

  const client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  })
  const key = url.slice(R2_PUBLIC_URL.replace(/\/$/, "").length + 1)
  try {
    await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
  } catch (error) {
    console.warn(`[r2] could not delete ${key}:`, (error as Error).message)
  }
}
