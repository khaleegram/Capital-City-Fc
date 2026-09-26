import { OG_SIZE, ogCard } from "@/lib/og"
import { getFixture } from "@/lib/server/queries"
import { formatDate } from "@/lib/utils"

export const alt = "Capital City FC match"
export const size = OG_SIZE
export const contentType = "image/png"

/**
 * The card for one match.
 *
 * A fixture was previously the one detail route still sharing the club's generic card, so a link to
 * a match said nothing about the match. This gives it the three things someone scanning a preview
 * wants: which competition, the score, and who it was against. The date and venue sit underneath
 * for the upcoming case, where there is no score to lead with.
 *
 * The opponent's crest is deliberately not used as the photo. Crests are square with transparent
 * edges and the card's image slot is 560×630 with `objectFit: cover`, so it would be stretched and
 * cropped into something unrecognisable. The card falls back to the brand gradient instead.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const f = await getFixture(id)
  if (!f) return ogCard({ eyebrow: "Fixtures", title: "Capital City FC" })

  const when = formatDate(f.date, { day: "numeric", month: "long", year: "numeric" })
  // "FT" and "HT" both mean the score is real: full time, and half time of a match still playing.
  const played = f.status === "FT" || f.status === "HT"
  const status =
    f.status === "FT" ? "Full time" : f.status === "HT" ? "Half time" : f.status === "LIVE" ? "Live" : "Upcoming"

  const score = played && f.score ? `${f.score.home}–${f.score.away}` : undefined
  // The venue is worth the space only when there is no scoreline competing for it.
  const sub = score ? when : [when, f.venue].filter(Boolean).join(" · ")

  return ogCard({
    eyebrow: f.competition ? `${f.competition} · ${status}` : status,
    title: f.opponent,
    sub: sub || undefined,
    score,
  })
}
