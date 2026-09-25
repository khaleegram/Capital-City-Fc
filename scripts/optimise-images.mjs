#!/usr/bin/env node
/**
 * Resizes and re-encodes images already stored in R2 so they match the box the
 * site actually renders them in.
 *
 * Player photos are shown in a 3:4 card (`aspect-[3/4]` in components/site/cards.tsx)
 * and a 4:5 hero on the detail page. 3:4 is the narrower of the two, so a 3:4 source
 * fills the card exactly and only trims the bottom of the hero — which is what
 * `object-cover object-top` already does today. Portrait phone photos are natively
 * 3:4, so in the common case this is a pure downscale with no crop.
 *
 *   node scripts/optimise-images.mjs --dry-run
 *   node scripts/optimise-images.mjs --format webp
 *   node scripts/optimise-images.mjs --format png --width 1080 --height 1440
 *   node scripts/optimise-images.mjs --format webp --rename --fix-refs
 *
 * Flags
 *   --prefix <p>     only objects under this key prefix (default: every image)
 *   --width/--height output size in px            (default 1200x1600, i.e. 3:4)
 *   --format <f>     webp | jpeg | png | keep     (default webp)
 *   --quality <n>    1-100 for webp/jpeg          (default 82)
 *   --rename         give the object the extension of its new format
 *   --fix-refs       repoint Firestore imageUrl fields at renamed objects
 *   --dry-run        report what would change, write nothing
 *
 * HEIC/HEIF is decoded with ffmpeg, because sharp's HEIF build has no HEVC decoder.
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, extname } from "node:path"
import { execFileSync } from "node:child_process"
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3"
import sharp from "sharp"

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? def : argv[i + 1]
}
const has = (name) => argv.includes(`--${name}`)

const PREFIX = flag("prefix", "")
const WIDTH = Number(flag("width", 1200))
const HEIGHT = Number(flag("height", 1600))
const FORMAT = flag("format", "webp").toLowerCase()
const QUALITY = Number(flag("quality", 82))
const RENAME = has("rename")
const FIX_REFS = has("fix-refs")
const DRY = has("dry-run")
const ALL = has("all")

if (!["webp", "jpeg", "png", "keep"].includes(FORMAT)) {
  console.error(`Unknown --format "${FORMAT}". Use webp, jpeg, png or keep.`)
  process.exit(1)
}

// Cropping to a target aspect is only correct for artwork shot to that shape.
// Team logos and other brand assets are wide and must be left alone, so refuse to
// run across the whole bucket unless that is stated explicitly.
if (!PREFIX && !ALL) {
  console.error(
    `Refusing to run across the whole bucket.\n\n` +
      `  This crops every image to ${WIDTH}x${HEIGHT}, which would ruin wide artwork\n` +
      `  such as team logos. Scope it with --prefix, or pass --all if you really mean\n` +
      `  the entire bucket.\n\n` +
      `    node scripts/optimise-images.mjs --prefix players/ --format ${FORMAT}\n`
  )
  process.exit(1)
}

const MIME = { webp: "image/webp", jpeg: "image/jpeg", png: "image/png" }
const EXT = { webp: ".webp", jpeg: ".jpg", png: ".png" }

// ── env ─────────────────────────────────────────────────────────────────────
const env = {}
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

const bucket = env.R2_BUCKET_NAME
const publicUrl = (env.R2_PUBLIC_URL || "").replace(/\/$/, "")
const s3 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})

const IMAGE_RE = /\.(heic|heif|jpe?g|png|webp|avif|tiff?)$/i
const kb = (n) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`)

/** HEIC goes through ffmpeg; everything else sharp decodes itself. */
function toDecodable(buf, key) {
  if (!/\.(heic|heif)$/i.test(key)) return buf
  const dir = mkdtempSync(join(tmpdir(), "img-"))
  const src = join(dir, "in.heic")
  const dst = join(dir, "out.png")
  writeFileSync(src, buf)
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-frames:v", "1", dst])
  return readFileSync(dst)
}

async function encode(buf, key) {
  const input = toDecodable(buf, key)
  const meta = await sharp(input).metadata()

  // `cover` + `top` mirrors `object-cover object-top`: fill the box, keep the top
  // of the frame, discard the overflow. A 3:4 source into a 3:4 box crops nothing.
  let pipe = sharp(input).rotate().resize(WIDTH, HEIGHT, {
    fit: "cover",
    position: "top",
    withoutEnlargement: true,
  })

  if (FORMAT === "webp") pipe = pipe.webp({ quality: QUALITY })
  else if (FORMAT === "jpeg") pipe = pipe.jpeg({ quality: QUALITY, mozjpeg: true })
  else if (FORMAT === "png") pipe = pipe.png({ compressionLevel: 9, palette: false })
  else pipe = pipe.toFormat(meta.format === "heif" ? "jpeg" : meta.format)

  const out = await pipe.toBuffer()
  const outMeta = await sharp(out).metadata()
  return { out, inMeta: meta, outMeta }
}

// ── run ─────────────────────────────────────────────────────────────────────
const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX }))
const objects = (list.Contents ?? []).filter((o) => IMAGE_RE.test(o.Key))

console.log(`bucket : ${bucket}`)
console.log(`target : ${WIDTH}x${HEIGHT} (${(WIDTH / HEIGHT).toFixed(3)}) · ${FORMAT}${FORMAT !== "png" ? ` q${QUALITY}` : ""}`)
console.log(`mode   : ${DRY ? "DRY RUN" : "WRITE"}${RENAME ? " · rename" : ""}${FIX_REFS ? " · fix Firestore refs" : ""}`)
console.log(`found  : ${objects.length} image(s)\n`)

const renames = [] // [oldKey, newKey]

for (const obj of objects) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: obj.Key }))
  const src = Buffer.from(await res.Body.transformToByteArray())

  let encoded
  try {
    encoded = await encode(src, obj.Key)
  } catch (err) {
    console.log(`  SKIP   ${obj.Key}\n         ${(err.message || err).split("\n")[0]}`)
    continue
  }

  const { out, inMeta, outMeta } = encoded
  const newKey = RENAME && FORMAT !== "keep" ? obj.Key.replace(extname(obj.Key), EXT[FORMAT]) : obj.Key
  const saving = src.length ? Math.round((1 - out.length / src.length) * 100) : 0

  console.log(
    `  ${newKey}\n` +
      `         ${inMeta.width}x${inMeta.height} ${inMeta.format} ${kb(src.length)}` +
      `  ->  ${outMeta.width}x${outMeta.height} ${outMeta.format} ${kb(out.length)}` +
      `  (${saving >= 0 ? "-" : "+"}${Math.abs(saving)}%)`
  )

  if (newKey !== obj.Key) renames.push([obj.Key, newKey])

  if (!DRY) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: newKey,
        Body: out,
        ContentType: MIME[FORMAT] ?? (FORMAT === "keep" ? `image/${outMeta.format}` : "application/octet-stream"),
        CacheControl: "public, max-age=31536000, immutable",
      })
    )
  }
}

// ── repoint Firestore at renamed objects ────────────────────────────────────
if (RENAME && renames.length && !DRY) {
  if (!FIX_REFS) {
    console.log(`\n${renames.length} object(s) renamed. Re-run with --fix-refs to update Firestore,`)
    console.log(`or any stored ${publicUrl}/... URL will 404.`)
  } else {
    const { initializeApp, applicationDefault } = await import("firebase-admin/app")
    const { getFirestore } = await import("firebase-admin/firestore")
    const app = initializeApp({ credential: applicationDefault(), projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID })
    const db = getFirestore(app)

    // Collections holding image URLs, and the fields to scan inside each doc.
    const collections = [
      ["players", ["imageUrl"]],
      ["galleries", ["coverImageUrl", "photos"]],
      ["mediaAssets", ["posterUrl", "thumbnailUrl"]],
      ["journeys", ["coverImageUrl"]],
      ["placements", ["playerImageUrl"]],
      ["achievements", ["imageUrl"]],
      ["staff", ["imageUrl"]],
    ]

    const hits = renames.map(([oldKey, newKey]) => [`${publicUrl}/${oldKey}`, `${publicUrl}/${newKey}`])
    const holdsUrl = (v) => {
      if (typeof v === "string") return hits.some(([from]) => v.includes(from))
      if (Array.isArray(v)) return v.some(holdsUrl)
      if (v && typeof v === "object") return Object.values(v).some(holdsUrl)
      return false
    }
    // Only rebuild subtrees that actually contain a stale URL, so untouched nested
    // values (Firestore Timestamps, refs) keep their prototypes and stay valid.
    const rewrite = (v) => {
      if (typeof v === "string") return hits.reduce((acc, [from, to]) => acc.split(from).join(to), v)
      if (Array.isArray(v)) return holdsUrl(v) ? v.map(rewrite) : v
      if (v && typeof v === "object") {
        if (!holdsUrl(v)) return v
        const clone = Object.create(Object.getPrototypeOf(v))
        Object.assign(clone, v)
        for (const k of Object.keys(clone)) clone[k] = rewrite(clone[k])
        return clone
      }
      return v
    }

    console.log("\nUpdating Firestore references:")
    let touched = 0
    for (const [name, fields] of collections) {
      const snap = await db.collection(name).get()
      for (const doc of snap.docs) {
        const data = doc.data()
        const patch = {}
        for (const field of fields) {
          if (data[field] === undefined) continue
          const updated = rewrite(data[field])
          if (JSON.stringify(updated) !== JSON.stringify(data[field])) patch[field] = updated
        }
        if (Object.keys(patch).length) {
          await doc.ref.update(patch)
          touched++
          console.log(`  ${name}/${doc.id}  -> ${Object.keys(patch).join(", ")}`)
        }
      }
    }
    console.log(touched ? `  ${touched} doc(s) updated.` : "  nothing referenced the renamed objects.")
  }
}

console.log(DRY ? "\nDry run complete. Nothing was written." : "\nDone.")
