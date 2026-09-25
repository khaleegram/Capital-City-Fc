import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { getGalleryBySlug, getJourneys } from "@/lib/server/queries"
import { HOME_CRUMB, breadcrumbNode, detailKeywords, detailMetadata, imageGalleryNode, jsonLdGraph } from "@/lib/seo"
import { JsonLd } from "@/components/seo/json-ld"
import { ChapterNumber } from "@/components/brand/chapter-number"
import { GrainOverlay } from "@/components/brand/grain-overlay"
import { PhotoStory } from "./photo-story"

export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const g = await getGalleryBySlug(slug)
  if (!g) return { title: "Not found", robots: { index: false, follow: true } }
  return detailMetadata({
    path: `/gallery/${slug}`,
    title: g.title,
    description: g.story?.slice(0, 160) || `${g.photos.length} frames from Capital City FC${g.location ? ` · ${g.location}` : ""}.`,
    keywords: [...detailKeywords("galleryDetail"), g.location].filter((k): k is string => !!k),
    // No `image`: this route ships a branded `opengraph-image.tsx` card.
  })
}

export default async function GalleryPage({ params }: Props) {
  const { slug } = await params
  const gallery = await getGalleryBySlug(slug)
  if (!gallery) notFound()
  const journey = gallery.journeyId ? (await getJourneys()).find((j) => j.id === gallery.journeyId) : null

  return (
    <article>
      <JsonLd
        data={jsonLdGraph(
          imageGalleryNode({
            name: gallery.title,
            path: `/gallery/${slug}`,
            description: gallery.story?.slice(0, 200),
            datePublished: gallery.date,
            location: gallery.location,
            photos: gallery.photos.map((p) => ({ url: p.url, caption: p.caption })),
          }),
          breadcrumbNode([HOME_CRUMB, { name: "Photo Stories", path: "/gallery" }, { name: gallery.title, path: `/gallery/${slug}` }])
        )}
      />
      <header className="relative overflow-hidden bg-horizon pb-10 pt-24 md:pt-32">
        <div aria-hidden className="absolute inset-0 bg-grid opacity-40 mask-fade-b" />
        <GrainOverlay />
        <div className="container relative">
          {gallery.chapter ? <ChapterNumber n={gallery.chapter} /> : null}
          <h1 className="mt-3 font-display text-[14vw] font-black uppercase leading-[0.86] tracking-tight font-condensed sm:text-7xl md:text-8xl">{gallery.title}</h1>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-mist/70">
            {[gallery.location, gallery.date && formatDate(gallery.date, { day: "numeric", month: "long", year: "numeric" }), `${gallery.photos.length} frames`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {gallery.story && <p className="mt-5 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-mist/90">{gallery.story}</p>}
          {journey && (
            <Link href={`/journeys/${journey.slug}`} className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold">
              Part of {journey.title} <ArrowUpRight className="h-4 w-4 text-signal" />
            </Link>
          )}
        </div>
      </header>
      <div className="container py-8">
        <PhotoStory photos={gallery.photos} title={gallery.title} />
      </div>
    </article>
  )
}
