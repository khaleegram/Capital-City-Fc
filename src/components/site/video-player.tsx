"use client"

import Image from "next/image"
import { useState } from "react"
import { Play } from "lucide-react"
import { cn, embedUrlFor } from "@/lib/utils"

/** Poster-first player: nothing heavy loads until the visitor taps play. */
export function VideoPlayer({
  url,
  poster,
  title,
  vertical,
  className,
  autoStart = false,
}: {
  url: string
  poster?: string | null
  title: string
  vertical?: boolean
  className?: string
  autoStart?: boolean
}) {
  const [started, setStarted] = useState(autoStart)
  const embed = embedUrlFor(url)

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-line/10 bg-black", vertical ? "aspect-[9/16]" : "aspect-video", className)}>
      {started ? (
        embed ? (
          <iframe
            src={`${embed}${embed.includes("?") ? "&" : "?"}autoplay=1`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <video src={url} poster={poster ?? undefined} controls autoPlay playsInline className="absolute inset-0 h-full w-full object-contain" />
        )
      ) : (
        <button type="button" onClick={() => setStarted(true)} className="group absolute inset-0" aria-label={`Play ${title}`}>
          {poster ? (
            <Image src={poster} alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" priority />
          ) : (
            <div className="absolute inset-0 bg-horizon" />
          )}
          <span className="absolute inset-0 bg-ink/30 transition-colors group-hover:bg-ink/10" />
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-signal text-white shadow-[0_0_0_10px_rgba(227,38,47,0.2)] transition-transform group-hover:scale-110">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </button>
      )}
    </div>
  )
}
