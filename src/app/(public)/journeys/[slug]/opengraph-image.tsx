import { OG_SIZE, ogCard } from "@/lib/og"
import { getJourneyBySlug } from "@/lib/server/queries"

export const alt = "Capital City FC journey"
export const size = OG_SIZE
export const contentType = "image/png"

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const j = await getJourneyBySlug(slug)
  if (!j) return ogCard({ eyebrow: "Journeys", title: "Capital City FC" })
  const r = j.record
  const sub = r && r.played ? `P${r.played} W${r.won} D${r.drawn} L${r.lost}` : j.subtitle || j.stops.map((s) => s.city).join(" → ")
  return ogCard({ eyebrow: j.status === "live" ? "Live now" : j.status === "upcoming" ? "Next journey" : "Journey", title: j.title, sub, image: j.coverImageUrl })
}
