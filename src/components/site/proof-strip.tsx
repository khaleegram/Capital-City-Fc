import { copy } from "@/lib/copy"
import type { ProofStats } from "@/lib/data"
import { cn } from "@/lib/utils"

const ITEMS: { key: keyof ProofStats; label: string; code: string }[] = [
  { key: "playersAbroad", label: copy.proof.signedAbroad, code: "01" },
  { key: "countries", label: copy.proof.countries, code: "02" },
  { key: "tournaments", label: copy.proof.tournaments, code: "03" },
  { key: "unbeatenRuns", label: copy.proof.unbeaten, code: "04" },
]

export function ProofStrip({ stats, className }: { stats: ProofStats; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 overflow-hidden rounded-2xl border border-line/10 md:grid-cols-4", className)}>
      {ITEMS.map((item, i) => (
        <div
          key={item.key}
          className={cn(
            "relative flex flex-col gap-2 bg-paper p-4 sm:p-5",
            i % 2 === 0 && "border-r border-line/10",
            i < 2 && "border-b border-line/10 md:border-b-0",
            i === 1 && "md:border-r"
          )}
        >
          <span className="font-mono text-[10px] tracking-[0.2em] text-mist/72">{item.code}</span>
          <dd className="font-display text-5xl font-black leading-none tracking-tight tabular-nums font-condensed sm:text-6xl">
            {stats[item.key]}
            {item.key === "playersAbroad" && stats[item.key] > 0 && <span className="text-signal">+</span>}
          </dd>
          <dt className="text-xs font-medium uppercase tracking-[0.14em] text-mist/75">{item.label}</dt>
        </div>
      ))}
    </dl>
  )
}
