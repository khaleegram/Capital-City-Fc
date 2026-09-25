"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Grid2X2, RectangleVertical, X } from "lucide-react"
import type { MediaAsset, MediaType } from "@/lib/data"
import { copy, type MediaCategory } from "@/lib/copy"
import { cn } from "@/lib/utils"
import { Segmented } from "@/components/site/segmented"
import { EmptyNote, MediaCard, mediaPoster } from "@/components/site/cards"
import { VideoPlayer } from "@/components/site/video-player"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Option = { id: string; name: string }

export function MediaBrowser({ media, journeys }: { media: MediaAsset[]; journeys: Option[] }) {
  const params = useSearchParams()
  const [cat, setCat] = useState<MediaCategory>((params.get("type") as MediaCategory) || "all")
  const [player, setPlayer] = useState(params.get("player") || "all")
  const [journey, setJourney] = useState(params.get("journey") || "all")
  const [year, setYear] = useState("all")
  const [view, setView] = useState<"grid" | "reel">("grid")

  const players = useMemo(() => {
    const map = new Map<string, string>()
    media.forEach((m) => m.taggedPlayers?.forEach((p) => map.set(p.id, p.name)))
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [media])
  const years = useMemo(() => Array.from(new Set(media.map((m) => m.year).filter(Boolean) as number[])).sort((a, b) => b - a), [media])
  const usedJourneys = journeys.filter((j) => media.some((m) => m.journeyId === j.id))

  const shown = media.filter(
    (m) =>
      (cat === "all" || m.type === cat) &&
      (player === "all" || m.playerIds.includes(player)) &&
      (journey === "all" || m.journeyId === journey) &&
      (year === "all" || String(m.year) === year)
  )

  const categories = (Object.keys(copy.media.categories) as MediaCategory[]).filter(
    (k) => k === "all" || media.some((m) => m.type === k)
  )

  return (
    <div className="space-y-5">
      <Segmented
        label="Category"
        value={cat}
        onChange={setCat}
        options={categories.map((k) => ({
          value: k,
          label: copy.media.categories[k],
          count: k === "all" ? media.length : media.filter((m) => m.type === k).length,
        }))}
      />
      <div className="flex flex-wrap items-center gap-2">
        {players.length > 0 && (
          <Select value={player} onValueChange={setPlayer}>
            <SelectTrigger className="w-44" aria-label="Filter by player">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All players</SelectItem>
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {usedJourneys.length > 0 && (
          <Select value={journey} onValueChange={setJourney}>
            <SelectTrigger className="w-44" aria-label="Filter by journey">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All journeys</SelectItem>
              {usedJourneys.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {years.length > 1 && (
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32" aria-label="Filter by year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex rounded-full border border-line/15 p-1" role="group" aria-label="View">
          {(
            [
              ["grid", Grid2X2, "Grid view"],
              ["reel", RectangleVertical, "Reel view"],
            ] as const
          ).map(([v, Icon, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              aria-label={label}
              onClick={() => setView(v)}
              className={cn("flex h-9 w-11 items-center justify-center rounded-full", view === v ? "bg-signal text-white" : "text-mist/70")}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyNote>{copy.media.empty}</EmptyNote>
      ) : view === "grid" ? (
        <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((m) => (
            <MediaCard key={m.id} asset={m} />
          ))}
        </div>
      ) : (
        <Reel items={shown} onClose={() => setView("grid")} />
      )}
    </div>
  )
}

/** Full-screen vertical reel: swipe up/down, tap to play. */
function Reel({ items, onClose }: { items: MediaAsset[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-ink/70 text-ivory backdrop-blur"
        aria-label="Close reel"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-none">
        {items.map((m) => (
          <section key={m.id} className="relative flex h-[100svh] snap-start items-center justify-center">
            <VideoPlayer
              url={m.url}
              poster={mediaPoster(m)}
              title={m.title}
              vertical={m.vertical}
              className={cn("rounded-none border-0", m.vertical ? "h-full w-auto max-w-full" : "w-full")}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/60 to-transparent p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
              <p className="font-mono text-[10px] uppercase tracking-stamp text-signal">{copy.media.categories[m.type as MediaType]}</p>
              <h3 className="mt-1 font-display text-2xl font-black uppercase leading-none font-condensed">{m.title}</h3>
              {m.taggedPlayers && m.taggedPlayers.length > 0 && (
                <div className="pointer-events-auto mt-3 flex flex-wrap gap-2">
                  {m.taggedPlayers.map((p) => (
                    <Link key={p.id} href={`/players/${p.id}`} className="rounded-full border border-line/20 bg-black/40 px-3 py-1.5 text-xs font-semibold">
                      {p.name}
                    </Link>
                  ))}
                </div>
              )}
              <Link href={`/media/${m.id}`} className="pointer-events-auto mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-ivory underline-offset-4 hover:underline">
                Details
              </Link>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
