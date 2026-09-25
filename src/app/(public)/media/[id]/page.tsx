import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, Route, Users } from "lucide-react"
import { copy } from "@/lib/copy"
import { embedUrlFor, formatDate, formatDuration, toDate } from "@/lib/utils"
import { getFixtures, getJourneys, getMedia, getMediaAsset } from "@/lib/server/queries"
import { HOME_CRUMB, SOCIAL_CARD, breadcrumbNode, detailKeywords, detailMetadata, jsonLdGraph, videoNode } from "@/lib/seo"
import { JsonLd } from "@/components/seo/json-ld"
import { VideoPlayer } from "@/components/site/video-player"
import { MediaCard, mediaPoster } from "@/components/site/cards"
import { Badge } from "@/components/ui/badge"

export const revalidate = 60

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const m = await getMediaAsset(id)
  if (!m) return { title: "Not found", robots: { index: false, follow: true } }
  const poster = mediaPoster(m)
  return detailMetadata({
    path: `/media/${id}`,
    title: m.title,
    description: m.description?.slice(0, 160) || undefined,
    keywords: [...detailKeywords("mediaDetail"), copy.media.categories[m.type]],
    image: poster ? { url: poster, alt: m.title } : SOCIAL_CARD,
  })
}

export default async function MediaAssetPage({ params }: Props) {
  const { id } = await params
  const asset = await getMediaAsset(id)
  if (!asset) notFound()

  const [all, journeys, fixtures] = await Promise.all([getMedia(), getJourneys(), getFixtures()])
  const journey = asset.journeyId ? journeys.find((j) => j.id === asset.journeyId) : null
  const fixture = asset.fixtureId ? fixtures.find((f) => f.id === asset.fixtureId) : null
  const related = all
    .filter((m) => m.id !== asset.id)
    .map((m) => ({
      m,
      score:
        (m.journeyId && m.journeyId === asset.journeyId ? 3 : 0) +
        m.playerIds.filter((p) => asset.playerIds.includes(p)).length * 2 +
        (m.type === asset.type ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((r) => r.m)

  const embed = embedUrlFor(asset.url)

  return (
    <article className="pt-16 md:pt-24">
      <JsonLd
        data={jsonLdGraph(
          videoNode({
            name: asset.title,
            path: `/media/${id}`,
            description: asset.description,
            thumbnailUrl: mediaPoster(asset),
            uploadDate: toDate(asset.createdAt)?.toISOString(),
            durationSeconds: asset.duration,
            contentUrl: embed ? undefined : asset.url,
            embedUrl: embed,
          }),
          breadcrumbNode([HOME_CRUMB, { name: copy.media.eyebrow, path: "/media" }, { name: asset.title, path: `/media/${id}` }])
        )}
      />
      <div className="container grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          <div className={asset.vertical ? "mx-auto max-w-sm" : undefined}>
            <VideoPlayer url={asset.url} poster={mediaPoster(asset)} title={asset.title} vertical={asset.vertical} className="-mx-5 rounded-none border-x-0 sm:mx-0 sm:rounded-2xl sm:border-x" />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{copy.media.categories[asset.type]}</Badge>
            {asset.duration ? <span className="font-mono text-xs text-mist/75">{formatDuration(asset.duration)}</span> : null}
            {asset.createdAt && <span className="font-mono text-xs text-mist/75">{formatDate(asset.createdAt)}</span>}
          </div>
          <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.9] tracking-tight font-condensed sm:text-5xl">{asset.title}</h1>
          {asset.description && <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-mist/90">{asset.description}</p>}
        </div>

        <aside className="space-y-6">
          {asset.taggedPlayers && asset.taggedPlayers.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-stamp text-mist/70">
                <Users className="h-3.5 w-3.5" /> In this video
              </h2>
              <ul className="flex flex-wrap gap-2">
                {asset.taggedPlayers.map((p) => (
                  <li key={p.id}>
                    <Link href={`/players/${p.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line/15 px-4 text-sm font-semibold hover:border-line/40">
                      {p.name}
                      <ArrowUpRight className="h-3.5 w-3.5 text-signal" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {journey && (
            <Link href={`/journeys/${journey.slug}`} className="flex items-center justify-between rounded-2xl border border-line/10 p-4 hover:border-line/25">
              <span className="flex items-center gap-3">
                <Route className="h-5 w-5 text-signal" />
                <span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-mist/75">Part of</span>
                  <span className="font-semibold">{journey.title}</span>
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
          {fixture && (
            <Link href={`/fixtures/${fixture.id}`} className="flex items-center justify-between rounded-2xl border border-line/10 p-4 hover:border-line/25">
              <span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-mist/75">Match centre</span>
                <span className="font-semibold">vs {fixture.opponent}</span>
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
          <Link href="/contact?role=scout" className="flex items-center justify-between rounded-2xl border border-signal/40 bg-signal/10 p-4">
            <span className="font-semibold">Need the full match?</span>
            <ArrowUpRight className="h-4 w-4 text-signal" />
          </Link>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="container mt-16">
          <h2 className="mb-5 font-display text-3xl font-black uppercase font-condensed">Keep watching</h2>
          <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((m) => (
              <MediaCard key={m.id} asset={m} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
