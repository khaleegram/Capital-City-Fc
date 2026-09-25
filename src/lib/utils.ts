import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Accepts a Firestore Timestamp, Date, ISO string or `{seconds}` object. */
export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === "object") {
    const v = value as { toDate?: () => Date; seconds?: number }
    if (typeof v.toDate === "function") return v.toDate()
    if (typeof v.seconds === "number") return new Date(v.seconds * 1000)
  }
  return null
}

export const byNewest = (a: { createdAt?: unknown }, b: { createdAt?: unknown }) =>
  (toDate(b.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (toDate(a.createdAt)?.getTime() ?? Number.MAX_SAFE_INTEGER)

export function formatDate(value: unknown, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  const d = toDate(value)
  return d ? new Intl.DateTimeFormat("en-GB", opts).format(d) : ""
}

export function ageFrom(dob?: string | null) {
  const d = toDate(dob)
  if (!d) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

export function formatDuration(sec?: number) {
  if (!sec || sec <= 0) return ""
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`
}

/** Parses YouTube/Vimeo links into an embeddable URL. Returns null for direct files. */
export function embedUrlFor(url?: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, "")
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?rel=0&playsinline=1`
    if (host === "youtube.com") {
      const id = u.searchParams.get("v") || u.pathname.match(/\/(shorts|embed|live)\/([^/?]+)/)?.[2]
      if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0]
      if (id) return `https://player.vimeo.com/video/${id}?playsinline=1`
    }
  } catch {
    return null
  }
  return null
}

/** Best-effort poster for YouTube links when no poster was uploaded. */
export function youtubePoster(url?: string | null): string | null {
  const embed = embedUrlFor(url)
  const id = embed?.match(/youtube-nocookie\.com\/embed\/([^?]+)/)?.[1]
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}
