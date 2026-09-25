import type { Journey, JourneyMatch, JourneyRecord } from "@/lib/data"

export type JourneyDraft = Omit<Journey, "id" | "createdAt" | "updatedAt">

export type TabProps = {
  journeyId: string
  draft: JourneyDraft
  set: (patch: Partial<JourneyDraft>) => void
}

export function recordFromMatches(matches: JourneyMatch[]): JourneyRecord {
  const played = matches.filter((m) => m.status === "played" && m.scoreFor != null && m.scoreAgainst != null)
  return played.reduce<JourneyRecord>(
    (r, m) => {
      const f = m.scoreFor as number
      const a = m.scoreAgainst as number
      return {
        played: r.played + 1,
        won: r.won + (f > a ? 1 : 0),
        drawn: r.drawn + (f === a ? 1 : 0),
        lost: r.lost + (f < a ? 1 : 0),
        goalsFor: r.goalsFor + f,
        goalsAgainst: r.goalsAgainst + a,
      }
    },
    { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 }
  )
}
