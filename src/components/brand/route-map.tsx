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

/**
 * Stylized equirectangular "flight board" map: graticule + arcs + stops.
 * No map library. Projection is computed from the stops' bounding box.
 */
export function RouteMap({ stops, className }: { stops: MapStop[]; className?: string }) {
  if (stops.length === 0) return null

  const W = 400
  const H = 300
  const lats = stops.map((s) => s.lat)
  const lngs = stops.map((s) => s.lng)
  let minLat = Math.min(...lats) - 6
  let maxLat = Math.max(...lats) + 6
  let minLng = Math.min(...lngs) - 8
  let maxLng = Math.max(...lngs) + 8
  // Keep a sane aspect so a single stop still renders.
  if (maxLat - minLat < 16) {
    const mid = (maxLat + minLat) / 2
    minLat = mid - 8
    maxLat = mid + 8
  }
  if (maxLng - minLng < 20) {
    const mid = (maxLng + minLng) / 2
    minLng = mid - 10
    maxLng = mid + 10
  }
  const pad = 24
  const sx = (lng: number) => pad + ((lng - minLng) / (maxLng - minLng)) * (W - pad * 2)
  const sy = (lat: number) => pad + ((maxLat - lat) / (maxLat - minLat)) * (H - pad * 2)

  const gridLng: number[] = []
  for (let g = Math.ceil(minLng / 10) * 10; g <= maxLng; g += 10) gridLng.push(g)
  const gridLat: number[] = []
  for (let g = Math.ceil(minLat / 10) * 10; g <= maxLat; g += 10) gridLat.push(g)

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
              {Math.abs(g)}°{g >= 0 ? "E" : "W"}
            </text>
          </g>
        ))}
        {gridLat.map((g) => (
          <g key={`lat-${g}`}>
            <line y1={sy(g)} y2={sy(g)} x1={0} x2={W} stroke="rgb(201 211 230 / 0.07)" />
            <text x={4} y={sy(g) - 3} fontSize="7" fill="rgb(201 211 230 / 0.35)" fontFamily="var(--font-mono)">
              {Math.abs(g)}°{g >= 0 ? "N" : "S"}
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
        {pts.map((p) => (
          <g key={`${p.city}-${p.lat}`}>
            {p.current && (
              <circle cx={p.x} cy={p.y} r="10" fill="#E3262F" opacity="0.3" className="animate-live-pulse" style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
            )}
            <circle cx={p.x} cy={p.y} r={p.current ? 4.5 : 3.5} fill={p.reached || p.current ? "#E3262F" : "#07142E"} stroke="#F5F3EE" strokeWidth="1.2" />
            <text x={p.x + 8} y={p.y - 4} fontSize="10" fontWeight="700" fill="#F5F3EE" fontFamily="var(--font-display)">
              {p.code || p.city.slice(0, 3).toUpperCase()}
            </text>
            <text x={p.x + 8} y={p.y + 7} fontSize="7" fill="rgb(201 211 230 / 0.6)" fontFamily="var(--font-mono)">
              {p.city.toUpperCase()} · {p.country.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  )
}
