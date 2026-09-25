import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ArrowUpRight } from "lucide-react"
import { copy } from "@/lib/copy"
import { getGalleries, getJourneys, getMedia } from "@/lib/server/queries"
import { PageHero } from "@/components/site/page-hero"
import { VideoPlayer } from "@/components/site/video-player"
import { mediaPoster } from "@/components/site/cards"
import { MediaBrowser } from "./media-browser"

export const revalidate = 60

export const metadata: Metadata = {
  title: copy.media.eyebrow,
  description: copy.media.body,
}

export default async function MediaPage() {
  const [media, journeys, galleries] = await Promise.all([getMedia(), getJourneys(), getGalleries()])
  const featured = media.find((m) => m.featured) ?? media[0]

  return (
    <>
      <PageHero eyebrow={copy.media.eyebrow} title={copy.media.title} body={copy.media.body}>
        {galleries.length > 0 && (
          <Link href="/gallery" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold">
            {copy.gallery.eyebrow} · {galleries.length}
            <ArrowUpRight className="h-4 w-4 text-signal" />
          </Link>
        )}
      </PageHero>
      <div className="container space-y-10 py-8 md:py-14">
        {featured && (
          <section className="grid gap-5 md:grid-cols-[1.6fr_1fr] md:items-end">
            <VideoPlayer url={featured.url} poster={mediaPoster(featured)} title={featured.title} />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-stamp text-signal">Featured · {copy.media.categories[featured.type]}</p>
              <h2 className="mt-2 font-display text-3xl font-black uppercase leading-[0.9] font-condensed sm:text-4xl">{featured.title}</h2>
              {featured.description && <p className="mt-3 line-clamp-4 text-mist/85">{featured.description}</p>}
              <Link href={`/media/${featured.id}`} className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold">
                Details <ArrowUpRight className="h-4 w-4 text-signal" />
              </Link>
            </div>
          </section>
        )}
        <Suspense>
          <MediaBrowser media={media} journeys={journeys.map((j) => ({ id: j.id, name: j.title }))} />
        </Suspense>
      </div>
    </>
  )
}
