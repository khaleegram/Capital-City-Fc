import type { Fixture } from "@/lib/data"
import { cn, toDate } from "@/lib/utils"

type F = Fixture & { date: string }

export type TeamRecordStats = {
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  winRate: number
  /** Most recent first, at most five. */
  form: ("W" | "D" | "L")[]
}

function resultOf(f: F): "W" | "D" | "L" {
  const us = f.score?.home ?? 0
  const them = f.score?.away ?? 0
  return us > them ? "W" : us === them ? "D" : "L"
}

/**
 * The season so far, from the finished matches on record.
 *
 * Everything here is derived from the fixtures themselves rather than stored as its own
 * counter. A tally kept alongside the fixtures is a second source of truth, and the two drift
 * the first time a result is corrected without the tally being updated — this can't.
 *
 * Only full-time fixtures count. A live match has no result yet, and counting an upcoming one
 * as a loss would make the record wrong for most of the season.
 */
export function recordFrom(fixtures: F[]): TeamRecordStats | null {
  const played = fixtures
    .filter((f) => f.status === "FT")
    .sort((a, b) => (toDate(a.date)?.getTime() ?? 0) - (toDate(b.date)?.getTime() ?? 0))

  if (played.length === 0) return null

  let won = 0
  let drawn = 0
  let lost = 0
  let goalsFor = 0
  let goalsAgainst = 0

  for (const f of played) {
    const us = f.score?.home ?? 0
    const them = f.score?.away ?? 0
    goalsFor += us
    goalsAgainst += them
    const r = resultOf(f)
    if (r === "W") won++
    else if (r === "D") drawn++
    else lost++
  }

  return {
    played: played.length,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    winRate: Math.round((won / played.length) * 100),
    form: played.slice(-5).reverse().map(resultOf),
  }
}

const FORM_STYLE: Record<"W" | "D" | "L", string> = {
  W: "border-win/40 bg-win/15 text-win",
  D: "border-draw/40 bg-draw/15 text-draw",
  L: "border-loss/40 bg-loss/15 text-loss",
}

function FormChip({ result }: { result: "W" | "D" | "L" }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] font-bold",
        FORM_STYLE[result]
      )}
      title={result === "W" ? "Won" : result === "D" ? "Drawn" : "Lost"}
    >
      {result}
    </span>
  )
}

/** A single figure with its label, used for the two stat rows. */
function Stat({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  return (
    <div className="text-center">
      <dd className={cn("font-display text-2xl font-black leading-none tabular-nums font-condensed sm:text-3xl", tone)}>
        {value}
      </dd>
      <dt className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-mist/75">{label}</dt>
    </div>
  )
}

/**
 * Overall team record, shown above the fixtures list.
 *
 * The win/draw/loss split is the headline and the goals are secondary, because that is the
 * order the results are actually read in. The bar under the figures is the same three numbers
 * again as width — a shape is legible at a glance in a way that three digits are not, and it
 * makes a lopsided season obvious without any arithmetic.
 */
export function TeamRecord({ fixtures, className }: { fixtures: F[]; className?: string }) {
  const record = recordFrom(fixtures)
  if (!record) return null

  const { played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, winRate, form } = record
  const pct = (n: number) => `${(n / played) * 100}%`

  return (
    <section
      aria-label="Overall record"
      className={cn("overflow-hidden rounded-3xl border border-line/10 bg-paper", className)}
    >
      <div className="flex items-center justify-between gap-4 border-b border-line/10 px-5 py-3.5">
        <h2 className="font-mono text-[11px] uppercase tracking-stamp text-mist/70">Overall record</h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mist/70">
          <span className="text-ivory">{played}</span> played
        </p>
      </div>

      <div className="space-y-5 p-5">
        <dl className="grid grid-cols-3">
          <Stat value={won} label="Won" tone="text-win" />
          <Stat value={drawn} label="Drawn" tone="text-draw" />
          <Stat value={lost} label="Lost" tone="text-loss" />
        </dl>

        {/* Width is the same numbers again — the shape of the season in one line. */}
        <div className="flex h-1.5 overflow-hidden rounded-full bg-line/10" aria-hidden>
          {won > 0 && <span className="bg-win" style={{ width: pct(won) }} />}
          {drawn > 0 && <span className="bg-draw" style={{ width: pct(drawn) }} />}
          {lost > 0 && <span className="bg-loss" style={{ width: pct(lost) }} />}
        </div>

        <dl className="grid grid-cols-3 gap-y-4 border-t border-line/10 pt-5">
          <Stat value={goalsFor} label="Scored" />
          <Stat value={goalsAgainst} label="Conceded" />
          {/*
            The sign is the whole point of this column, so it carries the colour: a positive
            difference is the one number here that means the season is going well.
          */}
          <Stat
            value={goalDifference > 0 ? `+${goalDifference}` : goalDifference}
            label="Difference"
            tone={goalDifference > 0 ? "text-win" : goalDifference < 0 ? "text-loss" : undefined}
          />
        </dl>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/10 px-5 py-3.5">
        {form.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist/70">Form</span>
            <div className="flex gap-1.5">
              {form.map((r, i) => (
                <FormChip key={i} result={r} />
              ))}
            </div>
          </div>
        ) : (
          <span />
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist/70">
          Win rate <span className="text-ivory">{winRate}%</span>
        </p>
      </div>
    </section>
  )
}
