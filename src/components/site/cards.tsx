import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, BadgeCheck, Play, Plane } from "lucide-react"
import type { Journey, MediaAsset, Placement, Player } from "@/lib/data"
import { copy } from "@/lib/copy"
import { cn, formatDate, formatDuration, youtubePoster } from "@/lib/utils"
import { VideoFrame } from "@/components/site/video-thumb"
import { Badge } from "@/components/ui/badge"
import { LiveDot } from "@/components/brand/live-dot"
import { PassportBadge } from "@/components/brand/passport-badge"
import { TEAM_LOGO_URL } from "@/lib/brand"

/* ───────── Journey ───────── */

/**
 * Journey status.
 *
 * A completed journey is the club's actual output — the thing the whole model exists to produce
 * — so it reads green rather than grey. An upcoming one is pending, which is gold. Grey for
 * both, as it was, made "we did this" and "we haven't yet" look identical.
 */
export function JourneyStatusBadge({ status }: { status: Journey["status"] }) {
  if (status === "live") return <Badge variant="live"><LiveDot label={copy.journeys.live} /></Badge>
  if (status === "upcoming") return <Badge variant="gold">{copy.journeys.upcoming}</Badge>
  return <Badge variant="win">{copy.journeys.completed}</Badge>
}

export function JourneyCard({ journey, className }: { journey: Journey; className?: string }) {
  const codes = journey.stops.map((s) => s.code || s.city.slice(0, 3).toUpperCase())
  const r = journey.record
  return (
    <Link
      href={`/journeys/${journey.slug}`}
      className={cn("group relative flex flex-col overflow-hidden rounded-3xl on-dark border border-line/10 bg-navy-deep", className)}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        {journey.coverImageUrl ? (
          <Image
            src={journey.coverImageUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 33vw, 80vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-horizon">
            <div className="absolute inset-0 bg-grid opacity-60" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="absolute left-4 right-4 top-4 flex items-start justify-between">
          <JourneyStatusBadge status={journey.status} />
          {journey.season && <span className="font-mono text-[10px] tracking-[0.2em] text-mist/80">{journey.season}</span>}
        </div>
        <div className="absolute inset-x-4 bottom-4 space-y-3">
          {codes.length > 0 && (
            <p className="font-mono text-[11px] tracking-[0.18em] text-mist/80">
              {codes.map((c, i) => (
                <span key={`${c}-${i}`}>
                  {i > 0 && <span className="mx-1.5 text-signal">→</span>}
                  {c}
                </span>
              ))}
            </p>
          )}
          <h3 className="font-display text-3xl font-black uppercase leading-[0.9] tracking-tight font-condensed">{journey.title}</h3>
          {journey.subtitle && <p className="line-clamp-2 text-sm text-mist/80">{journey.subtitle}</p>}
          <div className="h-1 overflow-hidden rounded-full bg-line/10">
            <div className="h-full rounded-full bg-signal" style={{ width: `${journey.progress}%` }} />
          </div>
          {r && r.played > 0 && (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ivory">
              P{r.played} · <span className="text-win">W{r.won}</span> · <span className="text-draw">D{r.drawn}</span> ·{" "}
              <span className="text-loss">L{r.lost}</span>
              {journey.outcome?.badge && <span className="ml-2 text-signal">{journey.outcome.badge}</span>}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

/* ───────── Player ───────── */

export function PlayerCard({
  player,
  placement,
  className,
}: {
  player: Pick<Player, "id" | "name" | "position" | "imageUrl" | "jerseyNumber" | "readyForNextStep" | "cohort" | "currentClub">
  placement?: Placement | null
  className?: string
}) {
  return (
    <Link href={`/players/${player.id}`} className={cn("group relative block overflow-hidden rounded-3xl on-dark border border-line/10 bg-navy-deep", className)}>
      <div className="relative aspect-[3/4]">
        {player.imageUrl ? (
          <Image
            src={player.imageUrl}
            alt={player.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-horizon">
            <Image src={TEAM_LOGO_URL} alt="" width={64} height={64} className="opacity-30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
        <span className="absolute right-3 top-2 font-display text-5xl font-black leading-none text-ivory/15 font-condensed">
          {player.jerseyNumber}
        </span>
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {placement && <PassportBadge label={placement.club} />}
          {/*
            "Ready for the next step" is good news, so it is green. It used `variant="live"`,
            which put a positive status in the red reserved for a match in progress — the one
            place on the site where red is supposed to mean urgency.
          */}
          {!placement && player.readyForNextStep && <Badge variant="win">{copy.players.readyBadge}</Badge>}
        </div>
        <div className="absolute inset-x-3 bottom-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist/80">
            {player.position}
            {player.cohort && <span className="text-mist/72"> · {player.cohort}</span>}
          </p>
          <h3 className="mt-1 font-display text-xl font-extrabold uppercase leading-none tracking-tight font-condensed sm:text-2xl">{player.name}</h3>
        </div>
      </div>
    </Link>
  )
}

/* ───────── Placement ───────── */

const PLACEMENT_LABEL: Record<Placement["type"], string> = { signed: "Signed", loan: "Loan", trial: "Trial" }

export function PlacementCard({ placement, className }: { placement: Placement; className?: string }) {
  const inner = (
    <div className={cn("group relative flex h-full flex-col overflow-hidden rounded-3xl on-dark border border-line/10 bg-navy-deep", className)}>
      <div className="relative aspect-[4/5]">
        {placement.playerImageUrl ? (
          <Image src={placement.playerImageUrl} alt={placement.playerName} fill sizes="(min-width: 768px) 25vw, 70vw" className="object-cover object-top" />
        ) : (
          <div className="absolute inset-0 bg-horizon" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {/*
            "Signed" is the outcome the whole academy exists to produce, so it is the one that
            reads green. A loan and a trial are both real progress but neither is the finished
            thing, so they stay neutral rather than competing with it.
          */}
          <Badge variant={placement.type === "signed" ? "win" : "outline"}>{PLACEMENT_LABEL[placement.type]}</Badge>
          {placement.verified && (
            /* Verification is a trust mark, not an achievement — blue keeps it distinct from
               the green "Signed" chip sitting right beside it. */
            <Badge variant="info">
              <BadgeCheck className="h-3 w-3" /> Verified
            </Badge>
          )}
        </div>
        <div className="absolute inset-x-4 bottom-4 space-y-2">
          <h3 className="font-display text-2xl font-black uppercase leading-[0.9] tracking-tight font-condensed">{placement.playerName}</h3>
          <div className="flex items-center gap-2 text-sm">
            <Plane className="h-4 w-4 shrink-0 text-signal" />
            <span className="truncate font-semibold">{placement.club}</span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist/70">
            {placement.country}
            {placement.league && ` · ${placement.league}`}
            {placement.date && ` · ${formatDate(placement.date, { month: "short", year: "numeric" })}`}
          </p>
        </div>
      </div>
    </div>
  )
  return placement.playerId ? (
    <Link href={`/players/${placement.playerId}`} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  )
}

/* ───────── Media ───────── */

export function mediaPoster(m: Pick<MediaAsset, "poster" | "url">) {
  return m.poster || youtubePoster(m.url) || null
}

/**
 * Paints a video's own frame in place of a poster.
 *
 * Footage uploaded before stills were captured at upload time has no poster of its own, and
 * these cards used to fall back to an empty gradient. YouTube links already resolve to a real
 * poster through `youtubePoster`, so anything reaching the video branch is a direct file.
 */
export function MediaCard({ asset, className, vertical }: { asset: MediaAsset; className?: string; vertical?: boolean }) {
  const poster = mediaPoster(asset)
  return (
    <Link href={`/media/${asset.id}`} className={cn("group block", className)}>
      <div className={cn("relative overflow-hidden rounded-2xl on-dark border border-line/10 bg-navy-deep", vertical ? "aspect-[9/16]" : "aspect-video")}>
        {poster ? (
          <Image src={poster} alt="" fill sizes="(min-width: 768px) 33vw, 80vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : (
          <>
            <div className="absolute inset-0 bg-horizon" />
            <VideoFrame src={asset.url} className="transition-transform duration-700 group-hover:scale-[1.03]" />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-transparent" />
        <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink transition-transform group-hover:scale-110">
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
        <div className="absolute left-2.5 top-2.5">
          <Badge variant="outline" className="bg-ink/70 backdrop-blur">
            {copy.media.categories[asset.type] ?? asset.type}
          </Badge>
        </div>
        {asset.duration ? (
          <span className="absolute bottom-2.5 right-2.5 rounded bg-ink/80 px-1.5 py-0.5 font-mono text-[10px]">{formatDuration(asset.duration)}</span>
        ) : null}
      </div>
      <p className="mt-2.5 line-clamp-2 font-semibold leading-snug group-hover:text-ivory">{asset.title}</p>
    </Link>
  )
}

/* ───────── Misc ───────── */

export function ViewAllTile({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex aspect-[4/5] w-[42vw] max-w-[14rem] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line/15 text-sm font-semibold text-mist hover:text-ivory"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-signal text-white">
        <ArrowUpRight className="h-5 w-5" />
      </span>
      {label}
    </Link>
  )
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line/15 px-6 py-12 text-center text-sm text-mist/70">{children}</div>
  )
}
