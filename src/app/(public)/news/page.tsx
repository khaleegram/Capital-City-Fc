import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { copy } from "@/lib/copy"
import { PAGE_SEO, pageGraph, pageMetadata } from "@/lib/seo"
import { formatDate } from "@/lib/utils"
import { getNews } from "@/lib/server/queries"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHero } from "@/components/site/page-hero"
import { EmptyNote } from "@/components/site/cards"
import { Reveal } from "@/components/brand/reveal"

export const revalidate = 60

export const metadata: Metadata = pageMetadata("news", "/news")

export default async function StoriesPage() {
  const news = await getNews()
  const [lead, ...rest] = news

  return (
    <>
      <JsonLd data={pageGraph({ path: "/news", name: PAGE_SEO.news.title, description: PAGE_SEO.news.description, type: "CollectionPage" })} />
      <PageHero eyebrow={copy.stories.eyebrow} title={copy.stories.title} />
      <div className="container space-y-10 py-8 md:py-14">
        {!lead && <EmptyNote>{copy.stories.empty}</EmptyNote>}
        {lead && (
          <Reveal>
            <Link href={`/news/${lead.id}`} className="group grid gap-5 md:grid-cols-[1.4fr_1fr] md:items-end">
              <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-line/10 bg-navy-deep">
                {lead.imageUrl && <Image src={lead.imageUrl} alt="" fill priority sizes="(min-width: 768px) 60vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-stamp text-signal">{formatDate(lead.date, { day: "numeric", month: "long", year: "numeric" })}</p>
                <h2 className="mt-2 font-display text-4xl font-black uppercase leading-[0.9] tracking-tight font-condensed sm:text-5xl">{lead.headline}</h2>
                <p className="mt-3 line-clamp-4 text-mist/85">{lead.content}</p>
              </div>
            </Link>
          </Reveal>
        )}
        {rest.length > 0 && (
          <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((a) => (
              <Link key={a.id} href={`/news/${a.id}`} className="group block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line/10 bg-navy-deep">
                  {a.imageUrl && <Image src={a.imageUrl} alt="" fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
                </div>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-mist/75">{formatDate(a.date)}</p>
                <h3 className="mt-1 font-display text-2xl font-extrabold uppercase leading-none font-condensed">{a.headline}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-mist/80">{a.content}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
