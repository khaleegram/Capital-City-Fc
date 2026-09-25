import { cn } from "@/lib/utils"

export function ChapterNumber({
  n,
  label = "CH",
  className,
}: {
  n: number
  label?: string
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 font-mono text-signal", className)}>
      <span className="text-[10px] tracking-stamp">{label}.</span>
      <span className="text-sm font-bold tabular-nums">{String(n).padStart(2, "0")}</span>
    </span>
  )
}
