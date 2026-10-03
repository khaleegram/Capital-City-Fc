"use client"

import { useRef } from "react"
import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { DEFAULT_FOCUS, dragToFocus, formatFocus, isCentred, readFocus } from "@/lib/image-position"

/**
 * Drag a photo to choose which part of it shows.
 *
 * Reads as a direct manipulation — the picture follows the pointer — but it is really editing the
 * frame's `object-position`, because the photo itself is never altered. Dragging the image down
 * brings the upper part of it into view, so the stored Y goes *down*; that inversion is the one
 * thing here that is easy to get wrong, and it is why the sum is done in one place.
 *
 * The preview frame takes the same aspect ratio as the frame the photo actually lands in. A
 * picker that previewed in the wrong shape would be worse than none: it would let a writer
 * position a crop they are never shown.
 */

type FocalPointProps = {
  src: string
  /** The frame the photo really lands in, as a CSS ratio — `"16 / 9"`, `"4 / 5"`, `"4 / 3"`. */
  aspect: string
  /** The stored position, absent meaning centred. */
  value?: string
  onChange: (position: string) => void
  /** Shown above the frame, when the field needs naming. */
  label?: string
  className?: string
}

export function FocalPoint({ src, aspect, value, onChange, label, className }: FocalPointProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  /** Where the pointer went down, and the position it started from, so a drag is not cumulative. */
  const drag = useRef<{ id: number; x: number; y: number; from: { x: number; y: number } } | null>(null)

  const beginDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const box = boxRef.current
    if (!box) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: readFocus(value) }
    box.setPointerCapture(e.pointerId)
  }

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    const box = boxRef.current
    const img = imgRef.current
    if (!state || state.id !== e.pointerId || !box || !img) return
    onChange(
      dragToFocus(
        state.from,
        { dx: e.clientX - state.x, dy: e.clientY - state.y },
        { width: box.clientWidth, height: box.clientHeight },
        { width: img.naturalWidth, height: img.naturalHeight }
      )
    )
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    // Already released if the pointer left the document; the guard keeps that from throwing.
    if (boxRef.current?.hasPointerCapture(e.pointerId)) boxRef.current.releasePointerCapture(e.pointerId)
  }

  /** Arrow keys nudge the same value the pointer sets, so the control is reachable by keyboard. */
  const nudge = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2
    const { x, y } = readFocus(value)
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    onChange(formatFocus(x + move[0], y + move[1]))
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label className="text-xs">{label}</Label>}
      <div
        ref={boxRef}
        role="application"
        tabIndex={0}
        aria-label={`Position the photo. ${value ?? DEFAULT_FOCUS}`}
        className="relative w-full cursor-grab touch-none select-none overflow-hidden rounded-lg border-2 border-dashed bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        style={{ aspectRatio: aspect }}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={nudge}
      >
        {/* A plain <img>, not next/image: `naturalWidth` is needed to work out the drag maths,
            and admin previews are not the place to spend an optimised variant. */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-cover"
          style={{ objectPosition: value ?? DEFAULT_FOCUS }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Drag to choose what shows in the frame.</p>
        {!isCentred(value) && (
          <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={() => onChange(DEFAULT_FOCUS)}>
            <RotateCcw className="mr-1.5 h-3 w-3" />
            Centre
          </Button>
        )}
      </div>
    </div>
  )
}
