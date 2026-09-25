import { cn, embedUrlFor } from "@/lib/utils"

/**
 * Paints a video's own frame in place of a poster.
 *
 * Footage uploaded before stills were captured at upload time has no poster of its own, and
 * these surfaces used to fall back to an empty gradient — a blank card with a play button on
 * it. `#t=1` makes the browser seek a second in and paint that frame as the still; frame zero
 * is very often black, so seeking past it matters. YouTube links already resolve to a real
 * poster through `youtubePoster`, so anything reaching the video branch is a direct file.
 *
 * Renders nothing for embeds, letting the caller keep its own placeholder.
 */
export function VideoFrame({ src, className }: { src: string; className?: string }) {
  if (embedUrlFor(src)) return null
  return (
    <video
      src={`${src}#t=1`}
      muted
      playsInline
      preload="metadata"
      tabIndex={-1}
      aria-hidden
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
    />
  )
}
