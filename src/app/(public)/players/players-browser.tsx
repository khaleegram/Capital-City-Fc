"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { Placement, Player } from "@/lib/data"
import { copy } from "@/lib/copy"
import { Segmented } from "@/components/site/segmented"
import { EmptyNote, PlacementCard, PlayerCard } from "@/components/site/cards"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Tab = "current" | "abroad" | "alumni"
const POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"] as const

export function PlayersBrowser({ players, placements }: { players: Player[]; placements: Placement[] }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const initial = (params.get("tab") as Tab) || "current"
  const [tab, setTab] = useState<Tab>(["current", "abroad", "alumni"].includes(initial) ? initial : "current")
  const [position, setPosition] = useState<string>("all")
  const [cohort, setCohort] = useState<string>("all")

  const latestPlacement = useMemo(() => {
    const map = new Map<string, Placement>()
    for (const p of placements) if (p.playerId && !map.has(p.playerId)) map.set(p.playerId, p)
    return map
  }, [placements])

  const cohorts = useMemo(() => Array.from(new Set(players.map((p) => p.cohort).filter(Boolean) as string[])).sort().reverse(), [players])

  const changeTab = (t: Tab) => {
    setTab(t)
    const q = new URLSearchParams(params.toString())
    q.set("tab", t)
    router.replace(`${pathname}?${q.toString()}`, { scroll: false })
  }

  const filterPlayer = (p: Player) =>
    (position === "all" || p.position === position) && (cohort === "all" || p.cohort === cohort)

  const current = players.filter((p) => p.squadStatus === "current").filter(filterPlayer)
  const alumni = players.filter((p) => p.squadStatus === "alumni").filter(filterPlayer)
  const abroad = placements.filter((pl) => position === "all" || pl.position === position)

  return (
    <div className="space-y-6">
      <Segmented
        label="Squad"
        value={tab}
        onChange={changeTab}
        options={[
          { value: "current", label: copy.players.tabs.current, count: players.filter((p) => p.squadStatus === "current").length },
          { value: "abroad", label: copy.players.tabs.abroad, count: placements.length },
          { value: "alumni", label: copy.players.tabs.alumni, count: players.filter((p) => p.squadStatus === "alumni").length },
        ]}
      />
      <div className="flex gap-2">
        <Select value={position} onValueChange={setPosition}>
          <SelectTrigger className="w-40" aria-label="Filter by position">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All positions</SelectItem>
            {POSITIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}s
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tab !== "abroad" && cohorts.length > 0 && (
          <Select value={cohort} onValueChange={setCohort}>
            <SelectTrigger className="w-40" aria-label="Filter by cohort">
              <SelectValue placeholder="Cohort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cohorts</SelectItem>
              {cohorts.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {tab === "abroad" ? (
        abroad.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {abroad.map((pl) => (
              <PlacementCard key={pl.id} placement={pl} />
            ))}
          </div>
        ) : (
          <EmptyNote>Verified placements will be listed here as they're confirmed.</EmptyNote>
        )
      ) : (tab === "current" ? current : alumni).length ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {(tab === "current" ? current : alumni).map((p) => (
            <PlayerCard key={p.id} player={p} placement={latestPlacement.get(p.id)} />
          ))}
        </div>
      ) : (
        <EmptyNote>{copy.players.empty}</EmptyNote>
      )}
    </div>
  )
}
