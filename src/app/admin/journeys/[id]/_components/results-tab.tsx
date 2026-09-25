"use client"

import { Calculator, Plus, Trash2 } from "lucide-react"
import type { JourneyMatch, JourneyRecord, JourneyTableRow } from "@/lib/data"
import { NativeSelect, numberOrUndefined } from "@/components/admin/form-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { recordFromMatches, type TabProps } from "./types"

const MATCH_STATUS = [
  ["upcoming", "Upcoming"],
  ["live", "Live"],
  ["played", "Played"],
] as const

const RECORD_FIELDS: [keyof JourneyRecord, string][] = [
  ["played", "P"],
  ["won", "W"],
  ["drawn", "D"],
  ["lost", "L"],
  ["goalsFor", "GF"],
  ["goalsAgainst", "GA"],
]

const TABLE_FIELDS: (keyof Omit<JourneyTableRow, "team" | "isUs">)[] = ["p", "w", "d", "l", "gf", "ga", "pts"]

const emptyRecord: JourneyRecord = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 }

export function ResultsTab({ draft, set }: TabProps) {
  const matches = draft.matches ?? []
  const table = draft.table ?? []
  const record = draft.record ?? emptyRecord

  const updateMatch = (i: number, patch: Partial<JourneyMatch>) => set({ matches: matches.map((m, j) => (j === i ? { ...m, ...patch } : m)) })
  const updateRow = (i: number, patch: Partial<JourneyTableRow>) => set({ table: table.map((r, j) => (j === i ? { ...r, ...patch } : r)) })

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold">Record</h2>
          <Button variant="outline" size="sm" onClick={() => set({ record: recordFromMatches(matches) })}>
            <Calculator /> Calculate from played matches
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {RECORD_FIELDS.map(([k, label]) => (
            <label key={k} className="rounded-xl border border-line/10 p-2 text-center">
              <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-mist/60">{label}</span>
              <input
                type="number"
                min={0}
                value={record[k]}
                onChange={(e) => set({ record: { ...record, [k]: numberOrUndefined(e.target.value) ?? 0 } })}
                className="w-full bg-transparent text-center font-display text-2xl font-black tabular-nums outline-none"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Matches</h2>
        <div className="space-y-2">
          {matches.map((m, i) => (
            <div key={m.id} className="grid items-center gap-2 rounded-2xl border border-line/10 p-3 sm:grid-cols-[130px_120px_1fr_64px_64px_120px_44px]">
              <Input type="date" aria-label="Date" value={m.date ?? ""} onChange={(e) => updateMatch(i, { date: e.target.value })} />
              <Input aria-label="Stage" placeholder="Group A" value={m.stage} onChange={(e) => updateMatch(i, { stage: e.target.value })} />
              <Input aria-label="Opponent" placeholder="Opponent" value={m.opponent} onChange={(e) => updateMatch(i, { opponent: e.target.value })} />
              <Input
                aria-label="Our score"
                type="number"
                min={0}
                placeholder="Us"
                value={m.scoreFor ?? ""}
                onChange={(e) => updateMatch(i, { scoreFor: numberOrUndefined(e.target.value) ?? null })}
              />
              <Input
                aria-label="Their score"
                type="number"
                min={0}
                placeholder="Them"
                value={m.scoreAgainst ?? ""}
                onChange={(e) => updateMatch(i, { scoreAgainst: numberOrUndefined(e.target.value) ?? null })}
              />
              <NativeSelect value={m.status} onChange={(v) => updateMatch(i, { status: v })} options={MATCH_STATUS} />
              <Button variant="ghost" size="icon" aria-label="Remove match" onClick={() => set({ matches: matches.filter((_, j) => j !== i) })} className="hover:text-signal">
                <Trash2 />
              </Button>
              <Input className="sm:col-span-3" aria-label="Venue" placeholder="Venue" value={m.venue ?? ""} onChange={(e) => updateMatch(i, { venue: e.target.value })} />
              <Input className="sm:col-span-4" aria-label="Note" placeholder="Note (scorers, penalties…)" value={m.note ?? ""} onChange={(e) => updateMatch(i, { note: e.target.value })} />
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={() => set({ matches: [...matches, { id: crypto.randomUUID().slice(0, 8), stage: "", opponent: "", status: "upcoming", scoreFor: null, scoreAgainst: null }] })}
        >
          <Plus /> Add match
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Group table</h2>
        {table.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-line/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist/60">
                  <th className="p-2 text-left">Team</th>
                  {TABLE_FIELDS.map((f) => (
                    <th key={f} className="w-14 p-2">
                      {f}
                    </th>
                  ))}
                  <th className="p-2">Us</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {table.map((r, i) => (
                  <tr key={i} className="border-t border-line/5">
                    <td className="p-1">
                      <Input aria-label="Team" value={r.team} onChange={(e) => updateRow(i, { team: e.target.value })} />
                    </td>
                    {TABLE_FIELDS.map((f) => (
                      <td key={f} className="p-1">
                        <Input
                          aria-label={f}
                          type="number"
                          className="px-2 text-center"
                          value={r[f]}
                          onChange={(e) => updateRow(i, { [f]: numberOrUndefined(e.target.value) ?? 0 })}
                        />
                      </td>
                    ))}
                    <td className="p-1 text-center">
                      <Checkbox aria-label="This is us" checked={!!r.isUs} onCheckedChange={(v) => updateRow(i, { isUs: !!v })} />
                    </td>
                    <td className="p-1">
                      <Button variant="ghost" size="icon" aria-label="Remove row" onClick={() => set({ table: table.filter((_, j) => j !== i) })}>
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button
          variant="outline"
          onClick={() =>
            set({
              table: [...table, { team: table.length === 0 ? "Capital City FC" : "", p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, isUs: table.length === 0 }],
            })
          }
        >
          <Plus /> Add row
        </Button>
      </section>
    </div>
  )
}
