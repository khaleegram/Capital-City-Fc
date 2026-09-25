import { cn } from "@/lib/utils"

/** Circular passport-style stamp with text on a ring. */
export function TournamentStamp({
  top,
  center,
  bottom,
  className,
  tone = "signal",
}: {
  top: string
  center: string
  bottom?: string
  className?: string
  tone?: "signal" | "ivory"
}) {
  const id = `${top}-${center}-${bottom ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const color = tone === "signal" ? "#E3262F" : "#F5F3EE"
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn("h-24 w-24 -rotate-6", className)}
      role="img"
      aria-label={`${top} ${center} ${bottom ?? ""}`}
    >
      <defs>
        <path id={`ring-${id}`} d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke={color} strokeWidth="2" opacity="0.9" />
      <circle cx="60" cy="60" r="34" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
      <text fill={color} fontSize="9.5" fontFamily="var(--font-mono)" letterSpacing="2.4">
        <textPath href={`#ring-${id}`} startOffset="0">
          {`${top.toUpperCase()} · ${(bottom ?? "").toUpperCase()} · `}
        </textPath>
      </text>
      <text
        x="60"
        y="65"
        textAnchor="middle"
        fill={color}
        fontSize="15"
        fontWeight="700"
        fontFamily="var(--font-display)"
      >
        {center}
      </text>
    </svg>
  )
}
