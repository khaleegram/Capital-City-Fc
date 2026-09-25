import { cn } from "@/lib/utils"

export type MapStop = {
  city: string
  country: string
  code?: string
  lat: number
  lng: number
  reached?: boolean
  current?: boolean
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/** Picks a graticule spacing giving roughly three lines across the window. */
function graticuleStep(span: number) {
  const target = span / 3
  return [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30].find((s) => target <= s) ?? 30
}

/** Trims drift from repeated addition, e.g. 9.999999999 where 10 was meant. */
const tidy = (v: number) => Math.round(v * 1e6) / 1e6

const degreeLabel = (g: number, axis: "lat" | "lng", step: number) => {
  const suffix = axis === "lat" ? (g >= 0 ? "N" : "S") : g >= 0 ? "E" : "W"
  return `${Math.abs(g).toFixed(step < 1 ? 1 : 0)}°${suffix}`
}

/**
 * Stylized equirectangular "flight board" map: graticule + arcs + stops.
 * No map library. The window is fitted to the stops.
 */
export function RouteMap({ stops, className }: { stops: MapStop[]; className?: string }) {
  if (stops.length === 0) return null

  const W = 400
  const H = 300
  const PAD = 26
  const lats = stops.map((s) => s.lat)
  const lngs = stops.map((s) => s.lng)
  const rawMinLat = Math.min(...lats)
  const rawMaxLat = Math.max(...lats)
  const rawMinLng = Math.min(...lngs)
  const rawMaxLng = Math.max(...lngs)
  const spanLat = rawMaxLat - rawMinLat
  const spanLng = rawMaxLng - rawMinLng

  // Padding scales with the route's own spread. A fixed number of degrees framed an
  // intercontinental route well but squashed a short hop — Gothenburg to Hjørring is
  // ~150 km — into two touching dots whose labels overlapped.
  const padLat = stops.length === 1 ? 4 : clamp(spanLat * 0.3, 0.5, 5)
  const padLng = stops.length === 1 ? 6 : clamp(spanLng * 0.3, 0.5, 7)

  const minLat = rawMinLat - padLat
  const maxLat = rawMaxLat + padLat
  const minLng = rawMinLng - padLng
  const maxLng = rawMaxLng + padLng

  const sx = (lng: number) => PAD + ((lng - minLng) / (maxLng - minLng)) * (W - PAD * 2)
  const sy = (lat: number) => PAD + ((maxLat - lat) / (maxLat - minLat)) * (H - PAD * 2)

  // Spacing follows the window, so a tight route isn't labelled with far-off degrees.
  const stepLng = graticuleStep(maxLng - minLng)
  const stepLat = graticuleStep(maxLat - minLat)
  const gridLng: number[] = []
  for (let g = Math.ceil(minLng / stepLng) * stepLng; g <= maxLng; g += stepLng) gridLng.push(tidy(g))
  const gridLat: number[] = []
  for (let g = Math.ceil(minLat / stepLat) * stepLat; g <= maxLat; g += stepLat) gridLat.push(tidy(g))

  const pts = stops.map((s) => ({ ...s, x: sx(s.lng), y: sy(s.lat) }))
  const segments = pts.slice(1).map((p, i) => {
    const a = pts[i]
    const dx = p.x - a.x
    const dy = p.y - a.y
    const dist = Math.hypot(dx, dy)
    const cx = (a.x + p.x) / 2 - (dy / (dist || 1)) * dist * 0.22
    const cy = (a.y + p.y) / 2 + (dx / (dist || 1)) * dist * 0.22 * -1
    return { d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${p.x} ${p.y}`, reached: !!p.reached }
  })

  return (
    <figure className={cn("relative overflow-hidden rounded-2xl border border-line/10 bg-paper", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Route: ${stops.map((s) => s.city).join(" to ")}`}>
        <rect width={W} height={H} fill="#07142E" />
        {gridLng.map((g) => (
          <g key={`lng-${g}`}>
            <line x1={sx(g)} x2={sx(g)} y1={0} y2={H} stroke="rgb(201 211 230 / 0.07)" />
            <text x={sx(g) + 3} y={H - 6} fontSize="7" fill="rgb(201 211 230 / 0.35)" fontFamily="var(--font-mono)">
              {degreeLabel(g, "lng", stepLng)}
            </text>
          </g>
        ))}
        {gridLat.map((g) => (
          <g key={`lat-${g}`}>
            <line y1={sy(g)} y2={sy(g)} x1={0} x2={W} stroke="rgb(201 211 230 / 0.07)" />
            <text x={4} y={sy(g) - 3} fontSize="7" fill="rgb(201 211 230 / 0.35)" fontFamily="var(--font-mono)">
              {degreeLabel(g, "lat", stepLat)}
            </text>
          </g>
        ))}
        {segments.map((s, i) => (
          <g key={i}>
            <path d={s.d} fill="none" stroke="rgb(245 243 238 / 0.18)" strokeWidth="1" />
            {s.reached && (
              <path d={s.d} fill="none" stroke="#E3262F" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" className="animate-route-dash" />
            )}
          </g>
        ))}
        {pts.map((p) => {
          // Flip labels inwards near the right edge so they never run off the frame.
          const flip = p.x > W * 0.62
          const labelX = flip ? p.x - 8 : p.x + 8
          const anchor = flip ? "end" : "start"
          return (
            <g key={`${p.city}-${p.lat}`}>
              {p.current && (
                <circle cx={p.x} cy={p.y} r="10" fill="#E3262F" opacity="0.3" className="animate-live-pulse" style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
              )}
              <circle cx={p.x} cy={p.y} r={p.current ? 4.5 : 3.5} fill={p.reached || p.current ? "#E3262F" : "#07142E"} stroke="#F5F3EE" strokeWidth="1.2" />
              <text x={labelX} y={p.y - 4} fontSize="10" fontWeight="700" fill="#F5F3EE" fontFamily="var(--font-display)" textAnchor={anchor}>
                {p.code || p.city.slice(0, 3).toUpperCase()}
              </text>
              <text x={labelX} y={p.y + 7} fontSize="7" fill="rgb(201 211 230 / 0.6)" fontFamily="var(--font-mono)" textAnchor={anchor}>
                {p.city.toUpperCase()} · {p.country.toUpperCase()}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
