import { cn } from "@/lib/utils"

/**
 * LIVE indicator. Uses the `live` token rather than `signal`, because `signal` is the
 * navy accent now and navy has no urgency — the red is reserved for genuinely-live state.
 */
export function LiveDot({ className, label = "Live" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-stamp text-live", className)}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-live animate-live-pulse" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
      </span>
      {label}
    </span>
  )
}
