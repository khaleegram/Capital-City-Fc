import { cn } from "@/lib/utils"

/** Equirectangular: 1° = 1 unit. x = lng + 180, y = 90 − lat. */
const xy = (lng: number, lat: number): [number, number] => [+(lng + 180).toFixed(2), +(90 - lat).toFixed(2)]

function ring(pts: [number, number][]) {
  return pts.map(([lng, lat], i) => `${i === 0 ? "M" : "L"} ${xy(lng, lat).join(" ")}`).join(" ") + " Z"
}

function flight(from: [number, number], to: [number, number], lift = 0.3) {
  const [x1, y1] = xy(...from)
  const [x2, y2] = xy(...to)
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const cx = +((x1 + x2) / 2 - (dy / len) * len * lift).toFixed(2)
  const cy = +((y1 + y2) / 2 + (dx / len) * len * lift).toFixed(2)
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

const ABUJA: [number, number] = [7.4, 9.08]
const EUROPE: [number, number] = [10.5, 50.8]
const AMERICAS: [number, number] = [-74.0, 40.7]
const ASIA: [number, number] = [121.5, 31.2]
const OCEANIA: [number, number] = [151.2, -33.9]
const LATAM: [number, number] = [-46.6, -23.5]

const LAND = [
  ring([
    [-168, 66], [-152, 59], [-141, 60], [-130, 55], [-124, 48], [-124, 40],
    [-117, 33], [-114, 28], [-105, 22], [-97, 16], [-90, 14], [-83, 9],
    [-78, 8], [-81, 24], [-80, 31], [-75, 39], [-70, 42], [-66, 45],
    [-60, 47], [-56, 52], [-64, 60], [-80, 63], [-95, 68], [-115, 68],
    [-135, 69], [-156, 71], [-166, 68],
  ]),
  ring([
    [-81, 8], [-77, 7], [-70, 12], [-60, 8], [-51, 0], [-35, -5],
    [-35, -8], [-40, -22], [-46, -24], [-48, -28], [-53, -34],
    [-68, -55], [-71, -51], [-74, -42], [-71, -18], [-77, -5], [-80, 1],
  ]),
  ring([
    [-5.8, 35.9], [-1.8, 35.2], [6, 37], [10.2, 37], [11.2, 33.5],
    [20, 32.2], [25, 31.6], [32.4, 31.2], [34, 27], [34.6, 22.5],
    [37, 21], [38.8, 16], [42.2, 16], [43.8, 12.4], [48.5, 14],
    [51.3, 11.9], [51, 9.5], [47, 5], [43.3, -0.8], [40.9, -2.4],
    [40.6, -10], [39.2, -16], [35, -24], [32, -28.8], [28, -33],
    [22, -34.4], [18.4, -34.2], [16, -28.5], [13.5, -18], [12, -8],
    [9.6, 4], [4, 6.2], [-4, 5.1], [-8.2, 4.6], [-13.5, 9],
    [-16.6, 12.4], [-16.8, 16.5], [-16.2, 21.5], [-17, 24.8],
    [-14.5, 28.8], [-9.5, 31.4], [-8.2, 33.4],
  ]),
  ring([
    [-9.4, 38.6], [-8.2, 43.4], [-1.8, 43.3], [3.2, 42.4], [7.5, 43.8],
    [9.8, 44], [12.4, 42], [16, 40.6], [18.5, 40.2], [22, 38.3],
    [26.5, 40], [28.2, 41.2], [28.8, 45.2], [30, 46.5], [29.5, 50],
    [24, 54.4], [18.5, 55], [13, 54.6], [12.8, 56.5], [18, 58.8],
    [16.5, 64], [12, 61], [8.2, 58], [8, 54.5], [4.8, 53.2],
    [1.5, 52.8], [-4.8, 50.5], [-5.2, 48.2], [-1.2, 46], [-1.5, 43.4],
    [-5.8, 43.2], [-9.2, 41.8],
  ]),
  ring([
    [-10.4, 51.4], [-8.2, 55.2], [-6, 55], [-5.5, 58.6], [-3, 58.6],
    [1.8, 52.6], [1.2, 51], [-1.8, 50.5], [-5.2, 50.2], [-5.4, 51.8], [-8.5, 51.5],
  ]),
  ring([
    [28, 41], [32, 36], [36, 36], [40, 37], [44, 40], [48, 37],
    [56, 27], [59, 23], [70, 22], [73, 19], [77, 8], [80, 6],
    [99, 13], [105, 2], [109, 14], [108, 22], [120, 24], [122, 31],
    [128, 35], [140, 37], [142, 45], [135, 54], [125, 53], [110, 48],
    [95, 56], [80, 52], [72, 48], [68, 53], [60, 54], [50, 55], [40, 47], [35, 45],
  ]),
  ring([
    [34.5, 31], [35.5, 28], [39, 21], [44, 17], [52, 22.5], [59, 25],
    [56, 27], [48, 30], [39, 34], [34.2, 31.2],
  ]),
  ring([
    [114, -22], [114, -34], [129, -32], [136, -35], [146, -39],
    [153, -28], [145, -16], [136, -12], [126, -14], [122, -17],
  ]),
  ring([
    [43.2, -12], [50.5, -15], [47.5, -25.6], [43.5, -23], [43.3, -16],
  ]),
  ring([
    [-73, 76], [-60, 82], [-22, 74], [-44, 60], [-54, 66], [-68, 70],
  ]),
]

const EUROPE_ARC = flight(ABUJA, EUROPE, 0.2)
const OTHER_ARCS = [
  flight(ABUJA, AMERICAS, 0.36),
  flight(ABUJA, ASIA, 0.24),
  flight(ABUJA, OCEANIA, 0.18),
  flight(ABUJA, LATAM, 0.28),
]

const MARKS: { at: [number, number]; label: string; x: number; y: number; primary?: boolean }[] = [
  { at: EUROPE, label: "EUROPE", x: 4, y: -3.2, primary: true },
  { at: AMERICAS, label: "AMERICAS", x: -28, y: -3.4 },
  { at: ASIA, label: "ASIA", x: 4, y: -3.2 },
  { at: OCEANIA, label: "OCEANIA", x: -8, y: 7.2 },
  { at: LATAM, label: "S. AMERICA", x: 4, y: 1.2 },
]

export function WorldFlight({ className }: { className?: string }) {
  const [ax, ay] = xy(...ABUJA)

  return (
    <div className={cn("pointer-events-none relative h-full w-full", className)} aria-hidden>
      <svg viewBox="8 10 344 152" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <defs>
          <filter id="wf-soft" x="-8%" y="-8%" width="116%" height="116%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.35" />
          </filter>
        </defs>

        {Array.from({ length: 13 }, (_, i) => 16 + i * 26).map((x) => (
          <line key={`v${x}`} x1={x} y1={10} x2={x} y2={162} stroke="rgb(201 211 230 / 0.1)" strokeWidth="0.25" />
        ))}
        {Array.from({ length: 7 }, (_, i) => 16 + i * 22).map((y) => (
          <line key={`h${y}`} x1={8} y1={y} x2={352} y2={y} stroke="rgb(201 211 230 / 0.1)" strokeWidth="0.25" />
        ))}

        {LAND.map((d) => (
          <path key={d.slice(0, 24)} d={d} fill="#1E3A74" fillOpacity="0.92" stroke="#C9D3E6" strokeOpacity="0.7" strokeWidth="0.65" />
        ))}

        {OTHER_ARCS.map((d) => (
          <path key={d} d={d} fill="none" stroke="rgb(245 243 238 / 0.22)" strokeWidth="0.55" strokeDasharray="1.4 1.8" strokeLinecap="round" />
        ))}
        <path id="wf-europe-arc" d={EUROPE_ARC} fill="none" stroke="rgb(245 243 238 / 0.35)" strokeWidth="0.9" />
        <path d={EUROPE_ARC} fill="none" stroke="#E3262F" strokeWidth="1.35" strokeDasharray="3 2.2" strokeLinecap="round" className="animate-route-dash" />

        {MARKS.map((m) => {
          const [x, y] = xy(...m.at)
          return (
            <g key={m.label}>
              <circle cx={x} cy={y} r={m.primary ? 1.8 : 1.25} fill={m.primary ? "#E3262F" : "#F5F3EE"} />
              <text
                x={x + m.x}
                y={y + m.y}
                fill={m.primary ? "#F5F3EE" : "rgb(201 211 230 / 0.82)"}
                fontSize="6"
                fontFamily="var(--font-mono)"
                letterSpacing="0.16em"
                fontWeight="700"
              >
                {m.label}
              </text>
            </g>
          )
        })}

        <g>
          <circle cx={ax} cy={ay} r="8" fill="#E3262F" opacity="0.2" filter="url(#wf-soft)" />
          <circle cx={ax} cy={ay} r="2.4" fill="#E3262F" stroke="#F5F3EE" strokeWidth="0.55" />
          <text x={ax - 32} y={ay + 8.8} fill="#F5F3EE" fontSize="7" fontFamily="var(--font-mono)" letterSpacing="0.2em" fontWeight="700">
            FROM ABUJA
          </text>
        </g>

        <g>
          <path
            d="M 11 0 L -2.4 3.6 L -0.3 0.85 L -9.8 0.85 L -11.4 0 L -9.8 -0.85 L -0.3 -0.85 L -2.4 -3.6 Z"
            fill="#F5F3EE"
            stroke="#E3262F"
            strokeWidth="0.35"
          >
            <animateMotion dur="8s" repeatCount="indefinite" rotate="auto">
              <mpath href="#wf-europe-arc" />
            </animateMotion>
          </path>
        </g>
      </svg>
    </div>
  )
}
