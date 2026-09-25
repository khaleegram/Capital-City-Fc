import { cn } from "@/lib/utils"
import type { RouteNode as Node } from "@/lib/geo"

const DEFAULT_NODES: Node[] = [
  { x: 14, y: 84, label: "ABJ", sub: "Abuja · NG" },
  { x: 52, y: 42, label: "HJØ", sub: "Hjørring · DK" },
  { x: 82, y: 18, label: "GOT", sub: "Gothenburg · SE", active: true },
]

/**
 * Animated flight path between nodes, positioned in a 0–100 percentage space.
 * The path stretches to its container; nodes and labels are HTML so text never scales.
 */
export function RouteLine({
  nodes = DEFAULT_NODES,
  className,
  showLabels = true,
}: {
  nodes?: Node[]
  className?: string
  showLabels?: boolean
}) {
  const d = nodes
    .map((n, i) => {
      if (i === 0) return `M ${n.x} ${n.y}`
      const p = nodes[i - 1]
      const cx = (p.x + n.x) / 2 - (n.y - p.y) * 0.3
      const cy = (p.y + n.y) / 2 - Math.abs(n.x - p.x) * 0.2
      return `Q ${cx} ${cy} ${n.x} ${n.y}`
    })
    .join(" ")

  return (
    <div className={cn("pointer-events-none relative h-full w-full", className)} aria-hidden>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d={d} fill="none" stroke="rgb(245 243 238 / 0.16)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path
          d={d}
          fill="none"
          stroke="#E3262F"
          strokeWidth="2"
          strokeDasharray="6 6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="animate-route-dash"
        />
      </svg>
      {nodes.map((n) => (
        <div
          key={`${n.x}-${n.y}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
        >
          <span className="relative flex h-3 w-3 items-center justify-center">
            {n.active && <span className="absolute h-6 w-6 rounded-full bg-signal/40 animate-live-pulse" />}
            <span className={cn("relative h-2.5 w-2.5 rounded-full ring-2 ring-ink", n.active ? "bg-signal" : "bg-paper")} />
          </span>
          {showLabels && n.label && (
            <span
              className={cn(
                "absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-mono leading-tight",
                n.x > 62 ? "right-4 text-right" : "left-4"
              )}
            >
              <span className="block text-[11px] font-bold tracking-[0.2em] text-ivory">{n.label}</span>
              {n.sub && <span className="block text-[9px] uppercase tracking-[0.12em] text-mist/75">{n.sub}</span>}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
