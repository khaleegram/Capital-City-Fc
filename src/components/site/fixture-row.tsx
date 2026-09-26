import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { Fixture } from "@/lib/data"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { cn, formatDate } from "@/lib/utils"
import { LiveDot } from "@/components/brand/live-dot"

type F = Fixture & { date: string }

const TEAM_NAME = "Capital City FC"

type Result = "W" | "D" | "L"

/** Only a finished match has a result letter; a live one is still being decided. */
function resultOf(f: F): Result | null {
  if (f.status !== "FT") return null
  const us = f.score?.home ?? 0
  const them = f.score?.away ?? 0
  return us > them ? "W" : us === them ? "D" : "L"
}

/**
 * The left edge doubles as a form guide.
 *
 * A column of these cards is read as a shape before it is read as text: green rules march down
 * the wins, red records the losses, the neutrals recede. It says "W/D/L" without printing a
 * chip on every card, which keeps the row quiet enough for the opponent name to be the loudest
 * thing on it.
 *
 * These are result colours, not accents — see the token block in globals.css. A win is green
 * whatever the theme, which is why they don't follow `signal`.
 *
 * `live` stays the brighter red: a match in progress is urgent, a match already lost is not.
 */
const SPINE: Record<Result | "upcoming" | "live", string> = {
  W: "bg-win",
  D: "bg-draw/45",
  L: "bg-loss",
  upcoming: "bg-line/12",
  live: "bg-live",
}

/**
 * Fallback mark for a club with no published crest.
 *
 * Not simply the first three letters: those are "THE" for "The City Pride Football Club",
 * which reads as a word sitting in a crest circle rather than a club. A leading "The" is
 * dropped; longer names give their initials; two-word names keep the first word whole unless
 * that word is itself an acronym, so "Våg FK" stays "VÅG" while "SG Findorff" becomes "SGF".
 *
 * Accented letters survive — stripping to [a-z0-9] would turn "Lørenskog" into "Lre".
 */
export function monogram(name: string) {
  const words = name
    .replace(/^the\s+/i, "")
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9\u00C0-\u024F]/g, ""))
    .filter(Boolean)
  if (words.length === 0) return "?"
  const initials = (ws: string[]) => ws.map((w) => w[0]).join("").toUpperCase()
  if (words.length >= 3) return initials(words.slice(0, 3))
  if (words.length === 2 && /^[A-Z]{1,3}$/.test(words[0])) return (words[0] + words[1][0]).slice(0, 3).toUpperCase()
  return words[0].slice(0, 3).toUpperCase()
}

/**
 * Opponent crest, falling back to the monogram.
 *
 * Most clubs at this level have no crest published anywhere, so the fallback is a normal
 * state rather than an error — three tracked letters read as a deliberate mark, where a grey
 * placeholder square would read as a broken image. The hairline ring matters for the crests
 * that are mostly white, which would otherwise vanish into the card.
 */
function Crest({ src, name, className }: { src?: string; name: string; className?: string }) {
  return (
    <span
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line/10 bg-line/[0.04] font-mono text-[10px] font-bold text-mist",
        className
      )}
    >
      {src ? <Image src={src} alt="" fill sizes="36px" className="object-contain p-1" /> : monogram(name)}
    </span>
  )
}

/** The status end of the card: a live pulse, full time, or the kick-off time. */
function Status({ fixture }: { fixture: F }) {
  if (fixture.status === "LIVE") return <LiveDot label="Live" />
  if (fixture.status === "HT") return <LiveDot label="Half time" />
  if (fixture.status === "FT") {
    return <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist/70">Full time</span>
  }
  return (
    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory">
      {formatDate(fixture.date, { hour: "2-digit", minute: "2-digit" })}
    </span>
  )
}

/** Win / draw / loss mark, in the result colours. */
function ResultChip({ result }: { result: Result }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold",
        result === "W" && "border-win/40 bg-win/15 text-win",
        result === "D" && "border-draw/40 bg-draw/15 text-draw",
        result === "L" && "border-loss/40 bg-loss/15 text-loss"
      )}
    >
      {result}
    </span>
  )
}

/** One side of the phone scorecard. */
function TeamLine({ logo, name, score }: { logo?: string; name: string; score: number | null }) {
  return (
    <div className="flex items-center gap-2.5">
      <Crest src={logo} name={name} className="h-8 w-8" />
      <span className="min-w-0 flex-1 truncate font-display text-sm font-extrabold uppercase leading-tight font-condensed">{name}</span>
      {score !== null && (
        <span className="font-display text-2xl font-black leading-none tabular-nums font-condensed">{score}</span>
      )}
    </div>
  )
}

export function FixtureRow({ fixture }: { fixture: F }) {
  const result = resultOf(fixture)
  const live = fixture.status === "LIVE" || fixture.status === "HT"
  const played = live || fixture.status === "FT"
  const us = fixture.score?.home ?? 0
  const them = fixture.score?.away ?? 0
  const spine = live ? SPINE.live : result ? SPINE[result] : SPINE.upcoming
  const day = formatDate(fixture.date, { day: "2-digit" })
  const month = formatDate(fixture.date, { month: "short" })
  const meta = [fixture.competition, fixture.venue].filter(Boolean).join(" · ")

  return (
    <Link
      href={`/fixtures/${fixture.id}`}
      className="group relative flex overflow-hidden rounded-2xl border border-line/10 bg-paper transition-colors duration-200 hover:border-line/25"
    >
      <span aria-hidden className={cn("w-1 shrink-0", spine)} />

      {/*
        Phone: a stacked scorecard. Two team lines with their own scores, because a single
        row cannot hold a name like "The City Pride Football Club" beside a score without
        truncating it to nothing, and because a result is easier to read as a pair of lines
        than as a sentence. The old row simply shrank, which is what made it feel like a table.
      */}
      <div className="min-w-0 flex-1 sm:hidden">
        <div className="flex items-center justify-between gap-3 px-3.5 pt-3">
          <span className="font-mono text-[10px] uppercase tracking-stamp text-mist/75">
            {day} {month}
          </span>
          <Status fixture={fixture} />
        </div>

        <div className="space-y-2 px-3.5 py-3">
          <TeamLine logo={TEAM_LOGO_URL} name={TEAM_NAME} score={played ? us : null} />
          <TeamLine logo={fixture.opponentLogoUrl} name={fixture.opponent} score={played ? them : null} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line/10 px-3.5 py-2.5">
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-mist/72">{meta}</span>
          {result && <ResultChip result={result} />}
        </div>
      </div>

      {/*
        Tablet and up: the date rail beside a centred scoreboard. The three-column
        right-aligned / score / left-aligned arrangement is the same one the match page uses,
        so a fixture reads identically in the list and on its own page.
      */}
      <div className="hidden min-w-0 flex-1 sm:flex">
        <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5">
          <span className="font-display text-3xl font-black leading-none tabular-nums font-condensed">{day}</span>
          <span className="font-mono text-[10px] uppercase tracking-stamp text-mist/75">{month}</span>
        </div>

        <span aria-hidden className="my-3 w-px shrink-0 bg-line/12" />

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-4 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-mist/72">{meta}</span>
            <div className="flex shrink-0 items-center gap-2.5">
              <Status fixture={fixture} />
              <ArrowUpRight className="h-3.5 w-3.5 text-mist/40 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-signal" />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex min-w-0 items-center justify-end gap-2.5">
              <span className="truncate font-display text-base font-extrabold uppercase leading-none font-condensed lg:text-lg">
                {TEAM_NAME}
              </span>
              <Crest src={TEAM_LOGO_URL} name={TEAM_NAME} />
            </div>

            <div className="flex min-w-[3.5rem] items-center justify-center">
              {played ? (
                <span className="flex items-baseline gap-1.5 font-display text-2xl font-black leading-none tabular-nums font-condensed lg:text-3xl">
                  <span>{us}</span>
                  <span className="font-mono text-sm font-normal text-mist/50">–</span>
                  <span>{them}</span>
                </span>
              ) : (
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-mist/60">vs</span>
              )}
            </div>

            <div className="flex min-w-0 items-center gap-2.5">
              <Crest src={fixture.opponentLogoUrl} name={fixture.opponent} />
              <span className="truncate font-display text-base font-extrabold uppercase leading-none font-condensed lg:text-lg">
                {fixture.opponent}
              </span>
            </div>
          </div>
        </div>

        {result && (
          <div className="flex shrink-0 items-center pr-4">
            <ResultChip result={result} />
          </div>
        )}
      </div>
    </Link>
  )
}
