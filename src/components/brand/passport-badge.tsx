import { Plane } from "lucide-react"
import { cn } from "@/lib/utils"

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
        "on-dark inline-flex items-center gap-1.5 rounded-full border border-signal/40 bg-ink/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ivory backdrop-blur",
        className
      )}
    >
      <Plane className="h-3 w-3 text-signal" aria-hidden />
      {label}
      {country && <span className="text-mist/70">· {country}</span>}
    </span>
  )
}
