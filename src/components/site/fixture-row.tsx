import Image from "next/image"
import Link from "next/link"
import type { Fixture } from "@/lib/data"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { cn, formatDate } from "@/lib/utils"
import { LiveDot } from "@/components/brand/live-dot"

type F = Fixture & { date: string }

function Crest({ src, name }: { src?: string; name: string }) {
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-line/5 font-mono text-[10px] font-bold">
      {src ? <Image src={src} alt="" fill sizes="40px" className="object-contain p-1" /> : name.slice(0, 3).toUpperCase()}
    </span>
  )
}

export function FixtureRow({ fixture }: { fixture: F }) {
  const played = fixture.status === "FT" || fixture.status === "LIVE" || fixture.status === "HT"
  const us = fixture.score?.home ?? 0
  const them = fixture.score?.away ?? 0
  const result = fixture.status === "FT" ? (us > them ? "W" : us === them ? "D" : "L") : null
  return (
    <Link href={`/fixtures/${fixture.id}`} className="flex items-center gap-3 rounded-2xl border border-line/10 bg-paper p-3 transition-colors hover:border-line/25 sm:p-4">
      <div className="w-14 shrink-0 text-center">
        <p className="font-display text-2xl font-black leading-none tabular-nums font-condensed">{formatDate(fixture.date, { day: "2-digit" })}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist/75">{formatDate(fixture.date, { month: "short" })}</p>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Image src={TEAM_LOGO_URL} alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
        <span className="font-mono text-[10px] text-mist/72">vs</span>
        <Crest src={fixture.opponentLogoUrl} name={fixture.opponent} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{fixture.opponent}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-mist/75">
            {fixture.competition} · {fixture.venue}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {fixture.status === "LIVE" || fixture.status === "HT" ? (
          <>
            <p className="font-display text-2xl font-black tabular-nums font-condensed">
              {us}–{them}
            </p>
            <LiveDot label={fixture.status === "HT" ? "HT" : "Live"} />
          </>
        ) : played ? (
          <div className="flex items-center gap-2">
            <p className="font-display text-2xl font-black tabular-nums font-condensed">
              {us}–{them}
            </p>
            {result && (
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] font-bold",
                  result === "W" && "bg-signal text-white",
                  result === "D" && "bg-line/15",
                  result === "L" && "border border-line/20 text-mist"
                )}
              >
                {result}
              </span>
            )}
          </div>
        ) : (
          <p className="font-mono text-sm tabular-nums">{formatDate(fixture.date, { hour: "2-digit", minute: "2-digit" })}</p>
        )}
      </div>
    </Link>
  )
}
