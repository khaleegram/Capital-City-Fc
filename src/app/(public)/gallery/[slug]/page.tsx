import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { getGalleryBySlug, getJourneys } from "@/lib/server/queries"
import { ChapterNumber } from "@/components/brand/chapter-number"
import { GrainOverlay } from "@/components/brand/grain-overlay"
import { PhotoStory } from "./photo-story"

export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const g = await getGalleryBySlug(slug)
  if (!g) return { title: "Not found" }
  return { title: g.title, description: g.story?.slice(0, 160) }
}

export default async function GalleryPage({ params }: Props) {
  const { slug } = await params
  const gallery = await getGalleryBySlug(slug)
  if (!gallery) notFound()
  const journey = gallery.journeyId ? (await getJourneys()).find((j) => j.id === gallery.journeyId) : null

  return (
    <article>
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
