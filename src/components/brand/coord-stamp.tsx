import { cn } from "@/lib/utils"

export function formatCoord(lat: number, lng: number) {
  const la = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`
  const lo = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`
  return `${la} ${lo}`
}

export function CoordStamp({
  code,
  lat,
  lng,
  className,
}: {
  code?: string
  lat: number
  lng: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-stamp text-mist/70",
        className
      )}
    >
      {code && <span className="text-ivory">{code}</span>}
      <span>{formatCoord(lat, lng)}</span>
    </span>
  )
}
