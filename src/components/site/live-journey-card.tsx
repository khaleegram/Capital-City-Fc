import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { Journey, JourneyEntry } from "@/lib/data"
import { copy } from "@/lib/copy"
import { routeNodes } from "@/lib/geo"
import { cn, formatDate } from "@/lib/utils"
import { LiveDot } from "@/components/brand/live-dot"
import { RouteLine } from "@/components/brand/route-line"
import { GrainOverlay } from "@/components/brand/grain-overlay"

function daysUntil(date?: string) {
  if (!date) return null
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
  return Number.isFinite(diff) && diff > 0 ? diff : null
}

export function LiveJourneyCard({ journey, latest }: { journey: Journey; latest?: JourneyEntry | null }) {
  const isLive = journey.status === "live"
  const countdown = !isLive ? daysUntil(journey.startDate) : null
  const nodes = routeNodes(journey.stops, { includeOrigin: journey.kind === "international" })
  const current = journey.stops.find((s) => s.current) ?? journey.stops.filter((s) => s.reached).at(-1)

  return (
    <Link
      href={`/journeys/${journey.slug}`}
      className={cn(
        "on-dark group relative block overflow-hidden rounded-3xl border bg-navy-deep",
        isLive ? "border-live/40" : "border-line/10"
      )}
    >
      <div className="absolute inset-0 bg-horizon" />
      <div className="absolute inset-0 bg-grid opacity-50" />
      <GrainOverlay />
      <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_1.1fr] md:items-center">
        <div className="space-y-4">
          {isLive ? <LiveDot label={copy.home.liveEyebrow} /> : <p className="font-mono text-[10px] uppercase tracking-stamp text-mist/70">{copy.journeys.upcoming}</p>}
          <h3 className="font-display text-4xl font-black uppercase leading-[0.9] tracking-tight font-condensed sm:text-5xl">{journey.title}</h3>
          {current && isLive && (
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-ivory">
              Now in <span className="text-signal">{current.city}</span>, {current.country}
            </p>
          )}
          {countdown && (
            <p className="font-display text-6xl font-black leading-none tabular-nums font-condensed">
              {countdown}
              <span className="ml-2 align-middle font-mono text-xs font-normal uppercase tracking-stamp text-mist/70">days to departure</span>
            </p>
          )}
          <div>
            <div className="mb-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-mist/70">
              <span>Progress</span>
              <span>{journey.progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line/10">
              <div className="h-full rounded-full bg-signal" style={{ width: `${journey.progress}%` }} />
            </div>
          </div>
          {latest && (
            <div className="rounded-2xl border border-line/10 bg-ink/50 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist/75">
                {latest.day ? `Day ${latest.day} · ` : ""}
                {formatDate(latest.createdAt, { day: "numeric", month: "short" })}
                {latest.location && ` · ${latest.location}`}
              </p>
              <p className="mt-1 font-semibold">{latest.title}</p>
              {latest.body && <p className="mt-1 line-clamp-2 text-sm text-mist/80">{latest.body}</p>}
            </div>
          )}
          <span className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold">
            {isLive ? "Follow the journey live" : "See the plan"}
            <ArrowUpRight className="h-4 w-4 text-signal transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
        {nodes.length > 1 && (
          <div className="relative aspect-[4/3] w-full md:aspect-square">
            <RouteLine nodes={nodes} />
          </div>
        )}
      </div>
    </Link>
  )
}
