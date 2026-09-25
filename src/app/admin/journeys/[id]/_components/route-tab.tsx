"use client"

import { ArrowDown, ArrowUp, MapPin, Plus, Trash2 } from "lucide-react"
import type { JourneyStop } from "@/lib/data"
import { copy } from "@/lib/copy"
import { CITY_PRESETS, resolveJourneyOrigin } from "@/lib/geo"
import { cn } from "@/lib/utils"
import { RouteMap } from "@/components/brand/route-map"
import { numberOrUndefined } from "@/components/admin/form-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import type { TabProps } from "./types"

export function RouteTab({ draft, set }: TabProps) {
  const stops = draft.stops ?? []
  const update = (i: number, patch: Partial<JourneyStop>) => set({ stops: stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const setCurrent = (i: number) =>
    set({ stops: stops.map((s, j) => ({ ...s, current: j === i, reached: j <= i ? true : s.reached })) })
  const move = (i: number, dir: -1 | 1) => {
    const next = [...stops]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    set({ stops: next })
  }
  const addPreset = (city: string) => {
    const p = CITY_PRESETS.find((c) => c.city === city)
    if (p) set({ stops: [...stops, { ...p, reached: false }] })
  }

  /** The select always writes either an explicit city or `null`, never "" — see setOrigin. */
  const originCity = draft.origin === null ? "__none__" : draft.origin?.city ?? copy.brand.origin.city
  const setOrigin = (city: string) => {
    if (city === "__none__") return set({ origin: null })
    const p = CITY_PRESETS.find((c) => c.city === city)
    set({ origin: p ? { ...p, reached: true } : undefined })
  }

  const stopsWithCoords = stops
    .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
    .map((s) => ({ city: s.city, country: s.country, code: s.code, lat: s.lat as number, lng: s.lng as number, reached: s.reached, current: s.current }))

  // Mirror the public map, which prepends the departure city for international routes, so
  // the preview can't disagree with what gets published.
  const previewOrigin = (() => {
    const o = draft.kind === "domestic" ? null : resolveJourneyOrigin(draft)
    if (!o || typeof o.lat !== "number" || typeof o.lng !== "number") return null
    return { city: o.city, country: o.country, code: o.code, lat: o.lat, lng: o.lng, reached: o.reached, current: o.current }
  })()
  const originAlreadyListed = previewOrigin ? stopsWithCoords.some((s) => s.code === previewOrigin.code) : false
  const previewStops = previewOrigin && !originAlreadyListed ? [previewOrigin, ...stopsWithCoords] : stopsWithCoords

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {draft.kind === "international"
            ? "Cities in travel order, starting with the first stop on arrival. The city you pick as the origin is prepended to the route."
            : "For domestic campaigns, use stops for rounds or venues (coordinates optional)."}
        </p>

        {draft.kind === "international" && (
          <div className="rounded-2xl border border-line/10 p-3">
            <label htmlFor="route-origin" className="text-sm font-medium">
              Route origin
            </label>
            <select
              id="route-origin"
              value={originCity}
              onChange={(e) => setOrigin(e.target.value)}
              className="mt-2 h-11 w-full rounded-full border border-input bg-paper px-4 text-sm text-ivory"
            >
              <option value="__none__">None — route starts at the first stop</option>
              {CITY_PRESETS.map((c) => (
                <option key={c.city} value={c.city}>
                  {c.city}, {c.country}
                  {c.city === copy.brand.origin.city ? " (club default)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">
              Where the squad set off from. Change this for a leg reached from an earlier tournament — Dana Cup
              2026 began in Gothenburg, not {copy.brand.origin.city}.
            </p>
          </div>
        )}
        {stops.map((s, i) => (
          <div key={i} className={cn("rounded-2xl border p-3", s.current ? "border-signal/60 bg-signal/5" : "border-line/10")}>
            <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_80px]">
              <Input aria-label="City" placeholder="City" value={s.city} onChange={(e) => update(i, { city: e.target.value })} />
              <Input aria-label="Country" placeholder="Country" value={s.country} onChange={(e) => update(i, { country: e.target.value })} />
              <Input aria-label="Code" placeholder="Code" maxLength={4} value={s.code ?? ""} onChange={(e) => update(i, { code: e.target.value.toUpperCase() })} />
              <Input aria-label="Latitude" placeholder="Lat" inputMode="decimal" value={s.lat ?? ""} onChange={(e) => update(i, { lat: numberOrUndefined(e.target.value) })} />
              <Input aria-label="Longitude" placeholder="Lng" inputMode="decimal" value={s.lng ?? ""} onChange={(e) => update(i, { lng: numberOrUndefined(e.target.value) })} />
              <div />
              <Input aria-label="Arrive" type="date" value={s.arrive ?? ""} onChange={(e) => update(i, { arrive: e.target.value })} />
              <Input aria-label="Depart" type="date" value={s.depart ?? ""} onChange={(e) => update(i, { depart: e.target.value })} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!s.reached} onCheckedChange={(v) => update(i, { reached: !!v })} /> Reached
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="current-stop" checked={!!s.current} onChange={() => setCurrent(i)} className="accent-[hsl(var(--primary))]" /> Squad is here now
              </label>
              <div className="ml-auto flex">
                <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === stops.length - 1} aria-label="Move down">
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => set({ stops: stops.filter((_, j) => j !== i) })} aria-label="Remove stop" className="hover:text-signal">
                  <Trash2 />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => set({ stops: [...stops, { city: "", country: "", reached: false }] })}>
            <Plus /> Add stop
          </Button>
          <select
            value=""
            onChange={(e) => addPreset(e.target.value)}
            className="h-11 rounded-full border border-input bg-paper px-4 text-sm text-ivory"
            aria-label="Add a city preset"
          >
            <option value="">+ Quick add city…</option>
            {CITY_PRESETS.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city}, {c.country}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4" /> Preview
        </p>
        {previewStops.length > 0 ? (
          <RouteMap stops={previewStops} />
        ) : (
          <p className="rounded-2xl border border-dashed border-line/15 p-8 text-center text-sm text-muted-foreground">Add stops with coordinates to preview the map.</p>
        )}
      </div>
    </div>
  )
}
