"use client"

import { useEffect, useState } from "react"
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore"
import { ArrowLeftRight, Flag, Goal, Info, Square, Timer } from "lucide-react"
import { db } from "@/lib/firebase"
import type { LiveEvent } from "@/lib/data"
import { cn, toDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { LiveDot } from "@/components/brand/live-dot"

type MatchState = {
  status: "UPCOMING" | "LIVE" | "HT" | "FT"
  home: number
  away: number
  kickoffTime?: unknown
  firstHalfEndTime?: unknown
  secondHalfStartTime?: unknown
}

type SerializedEvent = Omit<LiveEvent, "timestamp"> & { timestamp?: unknown }

const ICONS: Partial<Record<LiveEvent["type"], React.ElementType>> = {
  Goal,
  "Red Card": Square,
  Substitution: ArrowLeftRight,
  "Match Start": Flag,
  "Half Time": Timer,
  "Second Half Start": Flag,
  "Match End": Flag,
  Info,
}

function minuteNow(s: MatchState) {
  const k = toDate(s.kickoffTime)?.getTime()
  if (!k) return null
  const fhEnd = toDate(s.firstHalfEndTime)?.getTime()
  const shStart = toDate(s.secondHalfStartTime)?.getTime()
  let ms = Date.now() - k
  if (shStart && fhEnd) ms = fhEnd - k + (Date.now() - shStart)
  else if (fhEnd) ms = fhEnd - k
  return Math.max(0, Math.floor(ms / 60000))
}

/** Scoreboard + feed. Subscribes to Firestore only while the match is live. */
export function LiveMatch({
  fixtureId,
  initial,
  initialEvents,
  teamName,
  opponent,
}: {
  fixtureId: string
  initial: MatchState
  initialEvents: SerializedEvent[]
  teamName: string
  opponent: string
}) {
  const [state, setState] = useState(initial)
  const [events, setEvents] = useState(initialEvents)
  const [, tick] = useState(0)
  const live = state.status === "LIVE" || state.status === "HT"

  useEffect(() => {
    if (initial.status === "FT") return
    const unsubFixture = onSnapshot(doc(db, "fixtures", fixtureId), (snap) => {
      const d = snap.data()
      if (!d) return
      setState({
        status: d.status,
        home: d.score?.home ?? 0,
        away: d.score?.away ?? 0,
        kickoffTime: d.kickoffTime,
        firstHalfEndTime: d.firstHalfEndTime,
        secondHalfStartTime: d.secondHalfStartTime,
      })
    })
    const unsubEvents = onSnapshot(query(collection(db, "fixtures", fixtureId, "liveEvents"), orderBy("timestamp", "desc")), (snap) =>
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SerializedEvent))
    )
    return () => {
      unsubFixture()
      unsubEvents()
    }
  }, [fixtureId, initial.status])

  useEffect(() => {
    if (state.status !== "LIVE") return
    const t = setInterval(() => tick((n) => n + 1), 15_000)
    return () => clearInterval(t)
  }, [state.status])

  const minute = state.status === "LIVE" ? minuteNow(state) : null

  return (
    <div className="space-y-8">
      <div className="on-dark relative overflow-hidden rounded-3xl border border-line/10 bg-navy-deep p-5 sm:p-8">
        <div aria-hidden className="absolute inset-0 bg-grid opacity-40" />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <p className="text-right font-display text-lg font-extrabold uppercase leading-tight font-condensed sm:text-3xl">{teamName}</p>
          <div className="text-center">
            <p className="font-display text-6xl font-black tabular-nums font-condensed sm:text-8xl">
              {state.status === "UPCOMING" ? "vs" : `${state.home}–${state.away}`}
            </p>
            <div className="mt-1 flex justify-center">
              {state.status === "LIVE" ? (
                <LiveDot label={minute !== null ? `${minute}'` : "Live"} />
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-stamp text-mist/70">
                  {state.status === "HT" ? "Half time" : state.status === "FT" ? "Full time" : "Kick-off soon"}
                </span>
              )}
            </div>
            {/*
              The score alone doesn't say which way it went — 2–1 is only good news if you know
              which side is ours. This is that answer, in the result colours.
            */}
            {state.status === "FT" && (
              <div className="mt-2 flex justify-center">
                <Badge variant={state.home > state.away ? "win" : state.home === state.away ? "draw" : "loss"}>
                  {state.home > state.away ? "Won" : state.home === state.away ? "Drawn" : "Lost"}
                </Badge>
              </div>
            )}
          </div>
          <p className="font-display text-lg font-extrabold uppercase leading-tight font-condensed sm:text-3xl">{opponent}</p>
        </div>
      </div>

      {events.length > 0 && (
        <section aria-live={live ? "polite" : undefined}>
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-stamp text-mist/70">Match feed</h2>
          <ol className="space-y-2">
            {events.map((e) => {
              const Icon = ICONS[e.type] ?? Info
              /*
                Goals and red cards are the two events with an obvious valence, so they are the
                two that get a colour. Everything else — kick-off, half time, substitutions —
                is reported neutrally, because a feed where every row is tinted is a feed where
                the goal doesn't stand out.
              */
              const goal = e.type === "Goal"
              const sentOff = e.type === "Red Card"
              return (
                <li
                  key={e.id}
                  className={cn(
                    "flex gap-3 rounded-2xl border p-3",
                    goal && "border-win/40 bg-win/10",
                    sentOff && "border-loss/40 bg-loss/10",
                    !goal && !sentOff && "border-line/10"
                  )}
                >
                  <span className="w-10 shrink-0 font-mono text-sm font-bold tabular-nums text-signal">{e.minute != null ? `${e.minute}'` : ""}</span>
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", goal && "text-win", sentOff && "text-loss", !goal && !sentOff && "text-mist")} />
                  <div className="min-w-0">
                    <p className="text-sm">{e.text}</p>
                    {e.score && <p className="font-mono text-[10px] text-mist/75">{e.score}</p>}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}
