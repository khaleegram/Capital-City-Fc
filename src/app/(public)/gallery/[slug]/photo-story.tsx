"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import type { GalleryPhoto } from "@/lib/data"

export function PhotoStory({ photos, title }: { photos: GalleryPhoto[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const go = useCallback((i: number) => {
    const el = track.current
    if (!el) return
    const clamped = Math.max(0, Math.min(photos.length - 1, i))
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" })
  }, [photos.length])

  useEffect(() => {
    if (open === null) return
    const el = track.current
    if (el) el.scrollLeft = open * el.clientWidth
    setIndex(open)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null)
      if (e.key === "ArrowRight") go((track.current ? Math.round(track.current.scrollLeft / track.current.clientWidth) : 0) + 1)
      if (e.key === "ArrowLeft") go((track.current ? Math.round(track.current.scrollLeft / track.current.clientWidth) : 0) - 1)
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [open, go])

  return (
    <>
      <div className="columns-2 gap-2 sm:gap-3 md:columns-3">
        {photos.map((p, i) => (
          <button
            key={`${p.url}-${i}`}
            type="button"
            onClick={() => setOpen(i)}
            className="group relative mb-2 block w-full overflow-hidden rounded-xl bg-navy-deep sm:mb-3"
            style={{ aspectRatio: p.w && p.h ? `${p.w} / ${p.h}` : "4 / 5" }}
            aria-label={p.caption ? `Open photo: ${p.caption}` : `Open photo ${i + 1}`}
          >
            <Image src={p.url} alt={p.caption ?? ""} fill sizes="(min-width: 768px) 33vw, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
          </button>
        ))}
      </div>

      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label={title} className="on-dark fixed inset-0 z-[60] flex flex-col bg-black">
          <div className="flex items-center justify-between p-3">
            <span className="font-mono text-xs tracking-[0.2em] text-mist/80">
              {String(index + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
            </span>
            <button type="button" onClick={() => setOpen(null)} className="flex h-11 w-11 items-center justify-center rounded-full bg-line/10" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div
            ref={track}
            onScroll={(e) => {
              const el = e.currentTarget
              setIndex(Math.round(el.scrollLeft / el.clientWidth))
            }}
            className="flex flex-1 snap-x snap-mandatory overflow-x-auto overscroll-contain scrollbar-none"
          >
            {photos.map((p, i) => (
              <figure key={`${p.url}-${i}`} className="relative flex h-full w-full shrink-0 snap-center flex-col">
                <div className="relative flex-1">
                  {Math.abs(i - index) <= 1 && <Image src={p.url} alt={p.caption ?? ""} fill sizes="100vw" className="object-contain" />}
                </div>
                {p.caption && <figcaption className="px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3 text-center text-sm text-mist/90">{p.caption}</figcaption>}
              </figure>
            ))}
          </div>
          <button type="button" onClick={() => go(index - 1)} className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-line/10 md:flex" aria-label="Previous">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" onClick={() => go(index + 1)} className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-line/10 md:flex" aria-label="Next">
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}
    </>
  )
}
