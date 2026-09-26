import { copy } from "@/lib/copy"
import type { ProofStats } from "@/lib/data"
import { cn } from "@/lib/utils"

/**
 * The four headline numbers, each in the colour its meaning calls for.
 *
 * These used to be four identical navy figures, which made the strip read as a row of the same
 * statistic four times over. They aren't the same statistic: two of them are things the club
 * has won, one is the reach it has built, and one is silverware. Colour is how a reader sorts
 * them before reading a word — green for the outcomes, blue for the reach, gold for trophies.
 *
 * The accent is a rule at the top of each cell rather than a tinted fill, so the strip stays
 * quiet at a glance but resolves into four distinct things as soon as you look at it.
 */
const ITEMS: { key: keyof ProofStats; label: string; code: string; tone: string; rule: string }[] = [
  { key: "playersAbroad", label: copy.proof.signedAbroad, code: "01", tone: "text-win", rule: "bg-win" },
  { key: "countries", label: copy.proof.countries, code: "02", tone: "text-info", rule: "bg-info" },
  { key: "tournaments", label: copy.proof.tournaments, code: "03", tone: "text-gold", rule: "bg-gold" },
  { key: "unbeatenRuns", label: copy.proof.unbeaten, code: "04", tone: "text-win", rule: "bg-win" },
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
          <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", item.rule)} />
          <span className="font-mono text-[10px] tracking-[0.2em] text-mist/72">{item.code}</span>
          <dd className={cn("font-display text-5xl font-black leading-none tracking-tight tabular-nums font-condensed sm:text-6xl", item.tone)}>
            {stats[item.key]}
            {item.key === "playersAbroad" && stats[item.key] > 0 && <span className="text-win">+</span>}
          </dd>
          <dt className="text-xs font-medium uppercase tracking-[0.14em] text-mist/75">{item.label}</dt>
        </div>
      ))}
    </dl>
  )
}
