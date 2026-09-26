"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore"
import { MapPin, Play } from "lucide-react"
import { db } from "@/lib/firebase"
import type { JourneyEntry, MediaAsset } from "@/lib/data"
import { copy } from "@/lib/copy"
import { formatDate, toDate } from "@/lib/utils"
import { LiveDot } from "@/components/brand/live-dot"
import { mediaPoster } from "@/components/site/cards"

function relative(value: unknown) {
  const d = toDate(value)
  if (!d) return ""
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`
  return formatDate(d, { day: "numeric", month: "short" })
}

export function LiveDiary({
  journeyId,
  initial,
  live,
  media,
}: {
  journeyId: string
  initial: JourneyEntry[]
  live: boolean
  media: MediaAsset[]
}) {
  const [entries, setEntries] = useState(initial)
  const [, tick] = useState(0)

  useEffect(() => {
    if (!live) return
    const unsub = onSnapshot(
      query(collection(db, "journeys", journeyId, "entries"), orderBy("createdAt", "desc"), limit(60)),
      (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, mediaIds: [], ...d.data() }) as unknown as JourneyEntry)),
      () => {}
    )
    const t = setInterval(() => tick((n) => n + 1), 60_000)
    return () => {
      unsub()
      clearInterval(t)
    }
  }, [journeyId, live])

  const byId = new Map(media.map((m) => [m.id, m]))

  if (entries.length === 0) {
    return <p className="rounded-2xl border border-dashed border-line/15 p-6 text-center text-sm text-mist/70">Diary entries will appear here as the journey unfolds.</p>
  }

  return (
    <div>
      {live && (
        <div className="mb-5">
          <LiveDot label="Updating live" />
        </div>
      )}
      <ol className="relative space-y-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line/10">
        {entries.map((e, i) => {
          const linked = (e.mediaIds ?? []).map((id) => byId.get(id)).filter(Boolean) as MediaAsset[]
          return (
            <li key={e.id} className="relative pl-8">
              <span className={`absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 ${i === 0 && live ? "border-signal bg-signal" : "border-line/30 bg-paper"}`} />
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist/75">
                {e.day ? <span className="text-info">Day {e.day}</span> : null}
                {e.day ? " · " : ""}
                {live ? relative(e.createdAt) : formatDate(e.createdAt, { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <h3 className="mt-1 font-display text-xl font-bold leading-tight">{e.title}</h3>
              {e.location && (
                <p className="mt-1 flex items-center gap-1 text-xs text-mist/70">
                  <MapPin className="h-3 w-3" /> {e.location}
                </p>
              )}
              {e.body && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-mist/90">{e.body}</p>}
              {e.imageUrl && (
                <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-2xl border border-line/10">
                  <Image src={e.imageUrl} alt="" fill sizes="(min-width: 768px) 600px, 90vw" className="object-cover" />
                </div>
              )}
              {linked.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none">
                  {linked.map((m) => {
                    const poster = mediaPoster(m)
                    return (
                      <Link key={m.id} href={`/media/${m.id}`} className="on-dark relative aspect-video w-48 shrink-0 overflow-hidden rounded-xl border border-line/10 bg-navy-deep">
                        {poster && <Image src={poster} alt="" fill sizes="192px" className="object-cover" />}
                        <span className="absolute inset-0 flex items-center justify-center bg-ink/30">
                          <Play className="h-6 w-6 fill-ivory text-ivory" />
                        </span>
                        <span className="absolute inset-x-2 bottom-1.5 truncate text-xs font-semibold">{m.title}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="sr-only">{copy.journeys.diary}</p>
    </div>
  )
}
