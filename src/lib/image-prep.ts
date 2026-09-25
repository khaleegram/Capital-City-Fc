/**
 * Client-side image preparation, shared by the admin uploader and the public /join form.
 *
 * Kept free of server imports so the public form can pull it in without dragging the
 * staff-side upload plumbing along with it.
 */

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
 */
type ImageProfile = { kind: "fit"; width: number; height: number } | { kind: "max"; max: number }

export const IMAGE_PROFILES: Record<string, ImageProfile> = {
  players: { kind: "fit", width: 1200, height: 1600 }, // 3:4 card — components/site/cards.tsx
  staff: { kind: "fit", width: 1000, height: 1250 }, // 4:5 portrait
  placements: { kind: "fit", width: 1000, height: 1250 }, // 4:5 portrait
  galleries: { kind: "max", max: 2048 },
  news: { kind: "max", max: 1600 },
  journeys: { kind: "max", max: 1600 },
  media: { kind: "max", max: 1600 },
  // Homepage hero. Absent until now, which meant the club's hero upload bypassed
  // preparation entirely and a full-size phone photo went to the bucket untouched.
  // Capped taller than the card profiles because it is drawn full-bleed.
  team: { kind: "max", max: 2400 },
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

/**
 * Resizes an image to the box its profile is displayed in, and encodes it for the web.
 *
 * Videos (and images with no matching profile) pass through untouched — so the caller
 * can rely on one function for every kind of upload.
 */
export async function prepareImage(file: File, profileKey: string): Promise<File> {
  if (!file.type.startsWith("image/")) return file
  const profile = IMAGE_PROFILES[profileKey]
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
