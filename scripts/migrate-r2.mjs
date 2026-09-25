#!/usr/bin/env node
/**
 * Copies every object from one R2 bucket to another, preserving Content-Type.
 *
 * Usage:
 *   node scripts/migrate-r2.mjs [sourceEnvFile] [destEnvFile]
 *
 * Defaults are .env.local (source) and .env.r2-target (destination).
 * Run with DRY_RUN=1 to preview only.
 *
 *   node scripts/migrate-r2.mjs                          # .env.local -> .env.r2-target
 *   node scripts/migrate-r2.mjs .env.local.bak .env.local # migrate into the live config
 *   DRY_RUN=1 node scripts/migrate-r2.mjs                # preview
 */
import { readFileSync, existsSync } from "node:fs"
import { ListObjectsV2Command, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

function loadEnv(path) {
  if (!existsSync(path)) throw new Error(`Missing env file: ${path}`)
  const out = {}
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
  }
  return out
}

function clientFrom(env, label) {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = env
  for (const k of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]) {
    if (!env[k]) throw new Error(`${label} is missing ${k}`)
  }
  return {
    bucket: R2_BUCKET_NAME,
    client: new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    }),
  }
}

const dryRun = process.env.DRY_RUN === "1"
const src = clientFrom(loadEnv(process.argv[2] ?? ".env.local"), "source")
const dst = clientFrom(loadEnv(process.argv[3] ?? ".env.r2-target"), "destination")

const mb = (b) => (b / 1024 / 1024).toFixed(2) + " MB"

console.log(`source      : ${src.bucket}`)
console.log(`destination : ${dst.bucket}`)
console.log(dryRun ? "mode        : DRY RUN\n" : "mode        : COPY\n")

const keys = []
let token
do {
  const res = await src.client.send(
    new ListObjectsV2Command({ Bucket: src.bucket, ContinuationToken: token, MaxKeys: 1000 })
  )
  for (const o of res.Contents ?? []) keys.push({ key: o.Key, size: o.Size })
  token = res.IsTruncated ? res.NextContinuationToken : undefined
} while (token)

if (!keys.length) {
  console.log("Nothing to migrate.")
  process.exit(0)
}

console.log(`${keys.length} objects, ${mb(keys.reduce((n, k) => n + k.size, 0))} total\n`)
if (dryRun) {
  for (const k of keys) console.log(`  would copy  ${k.key}  (${mb(k.size)})`)
  process.exit(0)
}

let ok = 0
const failed = []
for (const { key, size } of keys) {
  try {
    const obj = await src.client.send(new GetObjectCommand({ Bucket: src.bucket, Key: key }))
    await dst.client.send(
      new PutObjectCommand({
        Bucket: dst.bucket,
        Key: key,
        Body: await obj.Body.transformToByteArray(),
        ContentType: obj.ContentType ?? "application/octet-stream",
        CacheControl: obj.CacheControl,
      })
    )
    ok++
    console.log(`  copied  ${key}  (${mb(size)})`)
  } catch (err) {
    failed.push(key)
    console.error(`  FAILED  ${key}:  ${err.message}`)
  }
}

console.log(`\nDone. ${ok}/${keys.length} copied.`)
if (failed.length) {
  console.error(`Failed keys:\n${failed.map((k) => "  " + k).join("\n")}`)
  process.exit(1)
}
