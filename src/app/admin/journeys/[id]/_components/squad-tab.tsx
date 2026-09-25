"use client"

import type { Fixture } from "@/lib/data"
import { useCollection } from "@/lib/collections"
import { formatDate, toDate } from "@/lib/utils"
import { PlayerMultiSelect } from "@/components/admin/form-kit"
import { Checkbox } from "@/components/ui/checkbox"
import type { TabProps } from "./types"

export function SquadTab({ draft, set }: TabProps) {
  const { items: fixtures } = useCollection<Fixture>("fixtures", (a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0))
  const fixtureIds = draft.fixtureIds ?? []

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <PlayerMultiSelect label="CCFC profiles on this journey" value={draft.playerIds ?? []} onChange={(ids) => set({ playerIds: ids })} />
        <p className="mt-2 text-xs text-muted-foreground">These players get this journey on their pathway timeline. The full tournament sheet lives on the public journey page.</p>
        {(draft.squad?.length ?? 0) > 0 && (
          <ul className="mt-6 divide-y divide-line/10 overflow-hidden rounded-xl border border-line/10 text-sm">
            {draft.squad!.map((m) => (
              <li key={`${m.number}-${m.name}`} className="flex items-center gap-3 px-3 py-2">
                <span className="w-6 font-mono text-xs text-muted-foreground">{m.number}</span>
                <span className="flex-1">{m.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{m.position}</span>
                <span className="font-mono text-xs tabular-nums">{m.goals ?? 0} G · {m.assists ?? 0} A</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Linked club fixtures</span>
          <span className="font-mono text-xs text-muted-foreground">{fixtureIds.length} linked</span>
        </div>
        <p className="text-xs text-muted-foreground">For matches you ran through the live match console. Tournament games abroad go in Results instead.</p>
        <ul className="max-h-96 overflow-y-auto rounded-xl border border-line/10">
          {fixtures.map((f) => (
            <li key={f.id} className="border-b border-line/5 last:border-0">
              <label className="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-line/5">
                <Checkbox
                  checked={fixtureIds.includes(f.id)}
                  onCheckedChange={(v) => set({ fixtureIds: v ? [...fixtureIds, f.id] : fixtureIds.filter((x) => x !== f.id) })}
                />
                <span className="flex-1">
                  vs {f.opponent} <span className="text-muted-foreground">· {f.competition}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">{formatDate(f.date)}</span>
              </label>
            </li>
          ))}
          {fixtures.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No fixtures yet.</li>}
        </ul>
      </section>
    </div>
  )
}
