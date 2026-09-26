"use client"

import { Plus, Trash2, Link2 } from "lucide-react"
import type { Fixture, JourneySquadMember, Player } from "@/lib/data"
import { useCollection } from "@/lib/collections"
import { formatDate, toDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { PlayerMultiSelect, NativeSelect } from "@/components/admin/form-kit"
import { useToast } from "@/hooks/use-toast"
import type { TabProps } from "./types"

const POSITIONS = [
  ["Goalkeeper", "GK"],
  ["Defender", "DEF"],
  ["Midfielder", "MID"],
  ["Forward", "FWD"],
] as const

const blankMember = (number: number): JourneySquadMember => ({
  number,
  name: "",
  position: "Midfielder",
  goals: 0,
  assists: 0,
  playerId: null,
})

/**
 * Edits the tournament sheet — which is what a journey's appearances and goals are computed
 * from.
 *
 * This panel used to render the sheet read-only, which made the numbers on it unmaintainable:
 * the sheet was seeded once by a script and could never be corrected afterwards. The link
 * between a name on the sheet and a CCFC profile is the field that matters most — a member with
 * no `playerId` is a name with no document behind it, so their appearances and goals cannot be
 * written anywhere, and the player they refer to keeps showing zero.
 */
export function SquadTab({ draft, set }: TabProps) {
  const { items: fixtures } = useCollection<Fixture>("fixtures", (a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0))
  const { items: players } = useCollection<Player>("players", (a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99))
  const { toast } = useToast()
  const fixtureIds = draft.fixtureIds ?? []
  const squad = draft.squad ?? []

  const update = (index: number, patch: Partial<JourneySquadMember>) =>
    set({ squad: squad.map((m, i) => (i === index ? { ...m, ...patch } : m)) })

  const add = () => {
    const next = Math.max(0, ...squad.map((m) => Number(m.number) || 0)) + 1
    set({ squad: [...squad, blankMember(next)] })
  }

  const remove = (index: number) => set({ squad: squad.filter((_, i) => i !== index) })

  /**
   * Matches sheet names to player profiles by name.
   *
   * The sheet arrived with fourteen names and only three of them carrying a profile link, so
   * eleven players could not be credited. Where a profile exists and its name matches, this
   * fills the link in — a starting point a person confirms, not something applied on its own,
   * because two players can share a name and a wrong link misattributes a career.
   */
  const linkByName = () => {
    const byName = new Map(players.map((p) => [p.name.trim().toLowerCase(), p.id]))
    let linked = 0
    const next = squad.map((m) => {
      if (m.playerId) return m
      const id = byName.get((m.name ?? "").trim().toLowerCase())
      if (!id) return m
      linked++
      return { ...m, playerId: id }
    })
    set({ squad: next })
    toast({
      title: linked ? `Linked ${linked} player${linked === 1 ? "" : "s"} by name` : "No names matched a profile",
      description: linked
        ? "Check each one before saving — two players can share a name."
        : "Create the player profiles first, or link them by hand from the dropdown.",
    })
  }

  const unlinked = squad.filter((m) => !m.playerId).length
  const played = (draft.matches ?? []).filter((m) => m.status === "played").length

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section className="space-y-3 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Tournament sheet</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Goals and assists here belong to this tournament. Each member who is linked to a CCFC profile
              is credited {played} appearance{played === 1 ? "" : "s"} — one per match this journey played.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={linkByName} disabled={players.length === 0}>
              <Link2 className="h-3.5 w-3.5" /> <span className="ml-1.5">Link by name</span>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Plus className="h-3.5 w-3.5" /> <span className="ml-1.5">Add player</span>
            </Button>
          </div>
        </div>

        {squad.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line/20 p-6 text-center text-sm text-muted-foreground">
            No sheet for this journey. Without one, none of its matches can be credited to a player.
          </p>
        ) : (
          <>
            {unlinked > 0 && (
              <p className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-muted-foreground">
                {unlinked} of {squad.length} names are not linked to a CCFC profile, so they count for nothing.
                Link the ones who have a profile.
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border border-line/10">
              <table className="w-full text-sm">
                <thead className="bg-line/[0.03] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="w-14 p-2 font-medium">No.</th>
                    <th className="min-w-[9rem] p-2 font-medium">Name</th>
                    <th className="w-24 p-2 font-medium">Pos</th>
                    <th className="w-16 p-2 font-medium">G</th>
                    <th className="w-16 p-2 font-medium">A</th>
                    <th className="min-w-[11rem] p-2 font-medium">CCFC profile</th>
                    <th className="w-10 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {squad.map((m, i) => (
                    <tr key={i} className="border-t border-line/5">
                      <td className="p-1.5">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-12 px-2 text-center"
                          value={m.number ?? ""}
                          onChange={(e) => update(i, { number: Number(e.target.value) })}
                        />
                      </td>
                      <td className="p-1.5">
                        <Input className="h-8" value={m.name ?? ""} onChange={(e) => update(i, { name: e.target.value })} />
                      </td>
                      <td className="p-1.5">
                        <NativeSelect<JourneySquadMember["position"]>
                          value={m.position ?? "Midfielder"}
                          onChange={(v) => update(i, { position: v })}
                          options={POSITIONS}
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-12 px-2 text-center"
                          value={m.goals ?? 0}
                          onChange={(e) => update(i, { goals: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-12 px-2 text-center"
                          value={m.assists ?? 0}
                          onChange={(e) => update(i, { assists: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="p-1.5">
                        <NativeSelect
                          value={m.playerId ?? ""}
                          onChange={(v) => update(i, { playerId: v || null })}
                          placeholder="Not linked"
                          options={players.map((p) => [p.id, `#${p.jerseyNumber ?? "-"} ${p.name}`] as const)}
                        />
                      </td>
                      <td className="p-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(i)}
                          aria-label={`Remove ${m.name || "this player"}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section>
        <PlayerMultiSelect label="CCFC profiles on this journey" value={draft.playerIds ?? []} onChange={(ids) => set({ playerIds: ids })} />
        <p className="mt-2 text-xs text-muted-foreground">
          These players get this journey on their pathway timeline, and are credited its appearances even if they
          aren&rsquo;t on the sheet above.
        </p>
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
