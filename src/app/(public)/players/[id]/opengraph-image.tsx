import { OG_SIZE, ogCard } from "@/lib/og"
import { getPlayer } from "@/lib/server/queries"
import { situationOf } from "@/lib/player-status"

export const alt = "Capital City FC player profile"
export const size = OG_SIZE
export const contentType = "image/png"

/** Shares read "Alumni · abroad" as the eyebrow, so the one line of text on a link preview carries the news. */
const EYEBROW = {
  ccfc: "Scouting profile",
  nigeria: "Alumni · Nigeria",
  abroad: "Alumni · abroad",
} as const

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = await getPlayer(id)
  if (!p) return ogCard({ eyebrow: "Players", title: "Capital City FC" })
  const sub = [p.position, p.jerseyNumber != null ? `#${p.jerseyNumber}` : null, p.currentClub].filter(Boolean).join(" · ")
  return ogCard({ eyebrow: EYEBROW[situationOf(p)], title: p.name, sub, image: p.imageUrl })
}
