import { OG_SIZE, ogCard } from "@/lib/og"
import { getGalleryBySlug } from "@/lib/server/queries"

export const alt = "Capital City FC photo story"
export const size = OG_SIZE
export const contentType = "image/png"

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const g = await getGalleryBySlug(slug)
  if (!g) return ogCard({ eyebrow: "Photo stories", title: "Capital City FC" })
  return ogCard({
    eyebrow: g.chapter ? `Chapter ${g.chapter}` : "Photo story",
    title: g.title,
    sub: [g.location, `${g.photos.length} photos`].filter(Boolean).join(" · "),
    image: g.photos[0]?.url,
  })
}
