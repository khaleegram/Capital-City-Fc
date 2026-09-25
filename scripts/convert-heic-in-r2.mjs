#!/usr/bin/env node
/**
 * Converts HEIC/HEIF objects already stored in R2 to JPEG, in place.
 *
 * The object key is left unchanged so any URL already saved in Firestore keeps
 * working; only the bytes and Content-Type change. Requires `ffmpeg` on PATH.
 *
 *   node scripts/convert-heic-in-r2.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3"

const dryRun = process.argv.includes("--dry-run")

const env = {}
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

const client = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})
const bucket = env.R2_BUCKET_NAME

const list = await client.send(new ListObjectsV2Command({ Bucket: bucket }))
const targets = (list.Contents ?? []).filter((o) => /\.(heic|heif)$/i.test(o.Key))

console.log(`bucket  : ${bucket}`)
console.log(`found   : ${targets.length} HEIC object(s)`)
if (!targets.length) process.exit(0)
if (dryRun) {
  for (const t of targets) console.log(`  would convert  ${t.Key}  (${(t.Size / 1024 / 1024).toFixed(2)} MB)`)
  process.exit(0)
}

const work = mkdtempSync(join(tmpdir(), "heic-"))
const kb = (n) => (n / 1024).toFixed(0) + " KB"

for (const obj of targets) {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: obj.Key }))
  const src = join(work, "in.heic")
  const dst = join(work, "out.jpg")
  writeFileSync(src, Buffer.from(await res.Body.transformToByteArray()))

  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-frames:v", "1", "-q:v", "3", dst])
  const jpeg = readFileSync(dst)

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: obj.Key, // same key, so stored URLs stay valid
      Body: jpeg,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    })
  )

  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: obj.Key }))
  console.log(
    `  converted  ${obj.Key}\n             ${kb(obj.Size)} HEIC -> ${kb(jpeg.length)} JPEG  (Content-Type: ${head.ContentType})`
  )
}

console.log("\nDone. Object keys unchanged, so existing URLs still resolve.")
