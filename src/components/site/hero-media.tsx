"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { useLowData } from "@/hooks/use-low-data"
import { ArtImageFromSlots } from "@/components/brand/art-image"
import { ART_MOBILE_MAX, type ArtDirection } from "@/lib/art-direction"

/**
 * Poster-first background. The video only loads when data/motion preferences allow, or on tap.
 *
 * The image slots arrive pre-computed from the server so that art direction is decided there;
 * this component's only job is the video toggle and picking the poster that matches the viewport.
 */
export function HeroMedia({ art, video }: { art?: ArtDirection; video?: string }) {
  const low = useLowData()
  const ref = useRef<HTMLVideoElement>(null)
  const [wantVideo, setWantVideo] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    if (video && !low) setWantVideo(true)
  }, [video, low])

  // `poster` takes a single URL and cannot be media-queried, so the breakpoint is mirrored here.
  // Purely cosmetic: it only decides which still shows before playback starts.
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${ART_MOBILE_MAX}px)`)
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const poster = (narrow ? art?.mobile : undefined)?.src ?? art?.desktop.src

  const toggle = () => {
    if (!wantVideo) {
      setWantVideo(true)
      return
    }
    const v = ref.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }

  return (
    <div className="absolute inset-0">
      {art && (
        <ArtImageFromSlots art={art} alt="" className="absolute inset-0" imgClassName="h-full w-full object-cover opacity-60" />
      )}
      {video && wantVideo && (
        <video
          ref={ref}
          src={video}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
      )}
      {video && (
        <button
          type="button"
          onClick={toggle}
          className="absolute bottom-24 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-line/20 bg-ink/60 text-ivory backdrop-blur md:bottom-8"
          aria-label={playing ? "Pause background video" : "Play background video"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
      )}
    </div>
  )
}
