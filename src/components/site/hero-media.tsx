"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Pause, Play } from "lucide-react"
import { useLowData } from "@/hooks/use-low-data"

/** Poster-first background. The video only loads when data/motion preferences allow, or on tap. */
export function HeroMedia({ image, video }: { image?: string; video?: string }) {
  const low = useLowData()
  const ref = useRef<HTMLVideoElement>(null)
  const [wantVideo, setWantVideo] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (video && !low) setWantVideo(true)
  }, [video, low])

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
      {image && <Image src={image} alt="" fill priority sizes="100vw" className="object-cover opacity-60" />}
      {video && wantVideo && (
        <video
          ref={ref}
          src={video}
          poster={image}
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
