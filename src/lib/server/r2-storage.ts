import "server-only"

import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3"

/**
 * Single source of truth for talking to Cloudflare R2.
 *
 * Everything that touches the bucket goes through here so the credentials are read in
 * one place, and so quota accounting (which lists real object sizes rather than trusting
 * a number sent by the browser) has one implementation.
 */

type R2 = { client: S3Client; bucket: string; publicUrl: string }

let cached: R2 | null = null

export function r2Storage(): R2 {
  if (cached) return cached
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error("File storage (Cloudflare R2) isn't configured on the server yet.")
  }
  cached = {
    client: new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    } satisfies S3ClientConfig),
    bucket: R2_BUCKET_NAME,
    publicUrl: R2_PUBLIC_URL.replace(/\/$/, ""),
  }
  return cached
}

export function publicUrlFor(key: string): string {
  return `${r2Storage().publicUrl}/${key}`
}

/** Turns a public R2 URL back into its object key. Returns null for anything not in this bucket. */
export function keyFromPublicUrl(url: string | undefined | null): string | null {
  if (!url) return null
  try {
    const base = r2Storage().publicUrl
    if (!url.startsWith(`${base}/`)) return null
    return decodeURIComponent(url.slice(base.length + 1))
  } catch {
    return null
  }
}

export type ObjectRef = { key: string; bytes: number }

/** Lists every object under a prefix with its real stored size. Paginates fully. */
export async function prefixUsage(prefix: string): Promise<ObjectRef[]> {
  const { client, bucket } = r2Storage()
  const objects: ObjectRef[] = []
  let token: string | undefined
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 })
    )
    for (const o of res.Contents ?? []) {
      if (o.Key) objects.push({ key: o.Key, bytes: o.Size ?? 0 })
    }
    token = res.NextContinuationToken
  } while (token)
  return objects
}

export async function totalBytes(prefix: string): Promise<number> {
  const objects = await prefixUsage(prefix)
  return objects.reduce((sum, o) => sum + o.bytes, 0)
}

export function sumBytes(objects: ObjectRef[]): number {
  return objects.reduce((sum, o) => sum + o.bytes, 0)
}

/** Copies an object server-side (no bytes cross the network) and removes the original. */
export async function moveObject(fromKey: string, toKey: string): Promise<void> {
  const { client, bucket } = r2Storage()
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: toKey,
      CopySource: `${bucket}/${encodeURIComponent(fromKey).replace(/%2F/g, "/")}`,
    })
  )
  await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: [{ Key: fromKey }] } }))
}

/** Deletes a single object. Silently ignores missing keys. */
export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = r2Storage()
  await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: [{ Key: key }] } }))
}

/** Deletes every object under a prefix. Used to reclaim a rejected submission's storage. */
export async function deletePrefix(prefix: string): Promise<number> {
  const objects = await prefixUsage(prefix)
  if (objects.length === 0) return 0
  const { client, bucket } = r2Storage()
  // DeleteObjects accepts at most 1000 keys per call.
  for (let i = 0; i < objects.length; i += 1000) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects.slice(i, i + 1000).map((o) => ({ Key: o.key })) },
      })
    )
  }
  return objects.length
}
