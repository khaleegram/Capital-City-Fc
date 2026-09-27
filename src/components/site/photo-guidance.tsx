"use client"

import Image from "next/image"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Example = { src: string; alt: string; label: string; points: string[]; good: boolean }

const EXAMPLES: Example[] = [
  {
    src: "/join/good-example.jpg",
    alt: "Baba Saidu Audu, a Capital City FC forward, photographed looking at the camera — the standard for a profile photo",
    label: "Like this",
    points: ["Club kit on", "Head and shoulders, clearly visible", "Plain background, good light"],
    good: true,
  },
  {
    src: "/join/bad-example.jpg",
    alt: "A photo that is unsuitable for a player profile: not in football kit, in a busy outdoor setting",
    label: "Not like this",
    points: ["Not in football kit", "Busy background", "No clear, straight-on view of the face"],
    good: false,
  },
]

/**
 * Shown once, the first time a player goes to pick their profile photo.
 *
 * A profile photo is the first thing a scout sees, and it is the one asset we cannot fix
 * for them later — so the standard is stated up front, in pictures, before the file picker
 * ever opens.
 */
export function PhotoGuidance({ onContinue, onCancel }: { onContinue: () => void; onCancel: () => void }) {
  return (
    <div className="rounded-2xl border border-signal/40 bg-signal/5 p-4 sm:p-5">
      <p className="font-mono text-[10px] uppercase tracking-stamp text-signal">Before you upload</p>
      <h3 className="mt-1 font-display text-xl font-black uppercase tracking-tight font-condensed">
        What makes a good profile photo
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-mist/80">
        Your photo goes on your public profile. It is the first thing a scout or a club sees, so it is worth getting
        right the first time.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {EXAMPLES.map((example) => (
          <figure
            key={example.src}
            className={cn(
              "overflow-hidden rounded-xl border",
              // A red ring on the bad example, so the verdict reads from the frame itself and not
              // only from the corner badge — the badge is small on a phone.
              example.good ? "border-line/15" : "border-loss/60 ring-1 ring-loss/40"
            )}
          >
            <div className="relative aspect-[4/5] bg-ink/40">
              <Image
                src={example.src}
                alt={example.alt}
                fill
                sizes="(min-width: 640px) 22rem, 100vw"
                className={cn(
                  "object-cover object-top",
                  // Slightly drained colour on the bad example. It is the one visual cue that
                  // survives a glance, and it leaves the photo readable rather than covering it.
                  !example.good && "grayscale-[45%]"
                )}
              />
              <span
                className={cn(
                  "absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white",
                  example.good ? "bg-signal" : "bg-loss"
                )}
              >
                {example.good ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {example.label}
              </span>
              {/*
                The bad sign itself. Deliberately large and centred: the corner badge alone was
                easy to miss next to a photo whose whole point is that it looks fine at a glance.
              */}
              {!example.good && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-loss/90 shadow-lg ring-4 ring-white/70">
                    <X className="h-9 w-9 text-white" strokeWidth={3.5} />
                  </span>
                </span>
              )}
            </div>
            <figcaption className="p-3">
              <ul className="space-y-1 text-xs text-mist/80">
                {example.points.map((point) => (
                  <li key={point} className="flex gap-1.5">
                    <span aria-hidden className={example.good ? "text-signal" : "text-mist/50"}>
                      {example.good ? "•" : "•"}
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={onContinue}>
          <Check className="mr-2 h-4 w-4" />
          Got it, choose my photo
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
