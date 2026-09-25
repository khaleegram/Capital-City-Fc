import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { copy } from "@/lib/copy"
import { formatDate } from "@/lib/utils"
import { getGalleries } from "@/lib/server/queries"
import { PageHero } from "@/components/site/page-hero"
import { ChapterNumber } from "@/components/brand/chapter-number"
import { Reveal } from "@/components/brand/reveal"
import { EmptyNote } from "@/components/site/cards"

export const revalidate = 60

export const metadata: Metadata = { title: copy.gallery.eyebrow, description: copy.gallery.title }

export default async function GalleryIndex() {
  const galleries = await getGalleries()
  return (
    <>
      <PageHero eyebrow={copy.gallery.eyebrow} title={copy.gallery.title} />
      <div className="container space-y-6 py-8 md:space-y-10 md:py-14">
        {galleries.length === 0 && <EmptyNote>{copy.gallery.empty}</EmptyNote>}
        {galleries.map((g, i) => {
          const [a, b, c] = g.photos
          return (
            <Reveal key={g.id}>
              <Link href={`/gallery/${g.slug}`} className="group grid gap-4 md:grid-cols-[1fr_1.4fr] md:items-center md:gap-10">
                <div className={i % 2 ? "md:order-2" : undefined}>
                  <ChapterNumber n={g.chapter ?? galleries.length - i} />
                  <h2 className="mt-2 font-display text-4xl font-black uppercase leading-[0.88] tracking-tight font-condensed sm:text-6xl">{g.title}</h2>
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-mist/70">
                    {[g.location, g.date && formatDate(g.date, { month: "long", year: "numeric" }), `${g.photos.length} frames`].filter(Boolean).join(" · ")}
                  </p>
                  {g.story && <p className="mt-3 line-clamp-3 text-mist/85">{g.story}</p>}
                </div>
                <div className="grid aspect-[4/3] grid-cols-3 grid-rows-2 gap-1.5 overflow-hidden rounded-3xl">
                  {[a, b, c].map((ph, k) =>
                    ph ? (
                      <div key={k} className={`relative overflow-hidden bg-navy-deep ${k === 0 ? "col-span-2 row-span-2" : ""}`}>
                        <Image src={ph.url} alt={ph.caption ?? ""} fill sizes={k === 0 ? "(min-width: 768px) 40vw, 66vw" : "(min-width: 768px) 20vw, 33vw"} className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                      </div>
                    ) : (
                      <div key={k} className={`bg-navy-deep ${k === 0 ? "col-span-2 row-span-2" : ""}`} />
                    )
                  )}
                </div>
              </Link>
            </Reveal>
          )
        })}
      </div>
    </>
  )
}
