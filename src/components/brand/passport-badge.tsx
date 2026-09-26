import { Plane } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Where a player currently is, or has been placed.
 *
 * Informational blue rather than the brand accent: this is a fact about a player's situation,
 * not a brand flourish, and the plane reads as travel when it is blue.
 */
export function PassportBadge({
  country,
  label = "Abroad",
  className,
}: {
  country?: string
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "on-dark inline-flex items-center gap-1.5 rounded-full border border-info/50 bg-ink/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ivory backdrop-blur",
        className
      )}
    >
      <Plane className="h-3 w-3 text-info" aria-hidden />
      {label}
      {country && <span className="text-mist/70">· {country}</span>}
    </span>
  )
}
