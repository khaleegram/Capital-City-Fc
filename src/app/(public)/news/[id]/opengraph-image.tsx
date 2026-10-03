import { OG_SIZE, ogCard } from "@/lib/og"
import { getArticle } from "@/lib/server/queries"

export const alt = "Capital City FC news"
export const size = OG_SIZE
export const contentType = "image/png"

/**
 * The card a shared article link unfurls into.
 *
 * Without this the article's own photo was used raw, at whatever shape it happened to be, and
 * every platform cropped it to its own ratio from the centre — so a tall photo arrived as a
 * chest-and-horizon, and the headline was reduced to plain text beside it. Rendering the card
 * here instead means the crest, the club's type and the headline are always present, the shape is
 * fixed at the 1200×630 every platform expects, and the photo is cropped the way the writer chose
 * in the editor rather than by whichever app is doing the unfurling.
 *
 * The photo is optional: an article without one gets the branded gradient, and a photo that is
 * slow or unreachable is dropped by `fetchImage` rather than failing the card. A preview with no
 * picture is a smaller loss than a link that shares as a blank box.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const article = await getArticle(id)
  if (!article) return ogCard({ eyebrow: "News", title: "Capital City FC" })

  // The portrait hero wins when there is one, since that is what the article itself leads with.
  const heroPortrait = Boolean(article.heroImageUrl)
  return ogCard({
    eyebrow: "News",
    title: article.headline,
    sub: (article.tags ?? []).slice(0, 2).join(" · ") || undefined,
    image: article.heroImageUrl || article.imageUrl,
    imagePosition: heroPortrait ? article.heroImagePosition : article.imagePosition,
  })
}
