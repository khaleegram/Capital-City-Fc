import { OG_SIZE, ogCard } from "@/lib/og"
import { getPlayer } from "@/lib/server/queries"

export const alt = "Capital City FC player profile"
export const size = OG_SIZE
export const contentType = "image/png"

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const p = await getPlayer(id)
  if (!p) return ogCard({ eyebrow: "Players", title: "Capital City FC" })
  const sub = [p.position, p.jerseyNumber != null ? `#${p.jerseyNumber}` : null, p.currentClub].filter(Boolean).join(" · ")
  return ogCard({ eyebrow: p.squadStatus === "alumni" ? "Alumni" : "Scouting profile", title: p.name, sub, image: p.imageUrl })
}
