import type { Journey, JourneyStop } from "./data"
import { copy } from "./copy"

export type RouteNode = { x: number; y: number; label?: string; sub?: string; active?: boolean }

/** The club's home city, and the default departure point for an international route. */
export const HOME_ORIGIN: JourneyStop = {
  city: copy.brand.origin.city,
  country: "NG",
  code: copy.brand.origin.code,
  lat: copy.brand.origin.lat,
  lng: copy.brand.origin.lng,
  reached: true,
}

/**
 * Departure point for a journey's route.
 *
 * A route leaves from its own `origin` when one is set. That matters for a leg the squad
 * reached from an earlier tournament rather than from Nigeria — Dana Cup 2026 started in
 * Gothenburg. `origin: null` means the route begins at its first stop, with nothing added.
 */
export function resolveJourneyOrigin(journey: Pick<Journey, "origin">): JourneyStop | null {
  if (journey.origin === null) return null
  return journey.origin ?? HOME_ORIGIN
}

/** Quick-pick cities for the journey route editor. */
export const CITY_PRESETS: Required<Pick<JourneyStop, "city" | "country" | "code" | "lat" | "lng">>[] = [
  { city: "Abuja", country: "Nigeria", code: "ABJ", lat: 9.0765, lng: 7.3986 },
  { city: "Lagos", country: "Nigeria", code: "LOS", lat: 6.5244, lng: 3.3792 },
  { city: "Istanbul", country: "Türkiye", code: "IST", lat: 41.0082, lng: 28.9784 },
  { city: "Doha", country: "Qatar", code: "DOH", lat: 25.2854, lng: 51.531 },
  { city: "Amsterdam", country: "Netherlands", code: "AMS", lat: 52.3676, lng: 4.9041 },
  { city: "Frankfurt", country: "Germany", code: "FRA", lat: 50.1109, lng: 8.6821 },
  { city: "London", country: "England", code: "LHR", lat: 51.5072, lng: -0.1276 },
  { city: "Paris", country: "France", code: "CDG", lat: 48.8566, lng: 2.3522 },
  { city: "Copenhagen", country: "Denmark", code: "CPH", lat: 55.6761, lng: 12.5683 },
  { city: "Aalborg", country: "Denmark", code: "AAL", lat: 57.0488, lng: 9.9217 },
  { city: "Hjørring", country: "Denmark", code: "HJR", lat: 57.4642, lng: 9.9823 },
  { city: "Gothenburg", country: "Sweden", code: "GOT", lat: 57.7089, lng: 11.9746 },
  { city: "Stockholm", country: "Sweden", code: "ARN", lat: 59.3293, lng: 18.0686 },
  { city: "Oslo", country: "Norway", code: "OSL", lat: 59.9139, lng: 10.7522 },
  { city: "Madrid", country: "Spain", code: "MAD", lat: 40.4168, lng: -3.7038 },
  { city: "Barcelona", country: "Spain", code: "BCN", lat: 41.3874, lng: 2.1686 },
  { city: "Lisbon", country: "Portugal", code: "LIS", lat: 38.7223, lng: -9.1393 },
  { city: "Brussels", country: "Belgium", code: "BRU", lat: 50.8503, lng: 4.3517 },
]

/**
 * Projects journey stops into a 0–100 box for <RouteLine>. `origin` is prepended to the
 * route unless it is already one of the stops; pass `null` to start at the first stop.
 * Stops without coordinates are spaced evenly.
 */
export function routeNodes(
  stops: JourneyStop[],
  { origin = HOME_ORIGIN, pad = 14 }: { origin?: JourneyStop | null; pad?: number } = {}
): RouteNode[] {
  const list = origin && !stops.some((s) => s.code === origin.code) ? [origin, ...stops] : stops
  if (list.length === 0) return []
  const geo = list.every((s) => typeof s.lat === "number" && typeof s.lng === "number")
  const lastCurrent = list.findIndex((s) => s.current)

  if (!geo) {
    return list.map((s, i) => {
      const t = list.length === 1 ? 0.5 : i / (list.length - 1)
      return {
        x: pad + t * (100 - pad * 2),
        y: 80 - Math.sin(t * Math.PI * 0.9) * 45 - t * 15,
        label: s.code || s.city.slice(0, 3).toUpperCase(),
        sub: s.city,
        active: i === lastCurrent,
      }
    })
  }

  const lats = list.map((s) => s.lat as number)
  const lngs = list.map((s) => s.lng as number)
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)]
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)]
  const spanLat = Math.max(maxLat - minLat, 1)
  const spanLng = Math.max(maxLng - minLng, 1)
  return list.map((s, i) => ({
    x: pad + (((s.lng as number) - minLng) / spanLng) * (100 - pad * 2),
    y: pad + ((maxLat - (s.lat as number)) / spanLat) * (100 - pad * 2),
    label: s.code || s.city.slice(0, 3).toUpperCase(),
    sub: `${s.city} · ${s.country}`,
    active: i === lastCurrent,
  }))
}
