import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { copy } from "@/lib/copy"
import { formatDate } from "@/lib/utils"
import { getArticle, getNews } from "@/lib/server/queries"
import { HOME_CRUMB, SOCIAL_CARD, articleNode, breadcrumbNode, detailKeywords, detailMetadata, jsonLdGraph } from "@/lib/seo"
import { JsonLd } from "@/components/seo/json-ld"

export const revalidate = 60

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const a = await getArticle(id)
  if (!a) return { title: "Story not found", robots: { index: false, follow: true } }
  const description = a.content.slice(0, 160)
  return detailMetadata({
    path: `/news/${id}`,
    title: a.headline,
    description,
    keywords: [...detailKeywords("newsDetail"), ...(a.tags ?? [])],
    image: a.imageUrl ? { url: a.imageUrl, alt: a.headline } : SOCIAL_CARD,
    type: "article",
    publishedTime: a.date,
  })
}

export default async function StoryPage({ params }: Props) {
  const { id } = await params
  const article = await getArticle(id)
  if (!article) notFound()
  const more = (await getNews()).filter((n) => n.id !== id).slice(0, 3)

  return (
    <article className="pt-20 md:pt-28">
      <JsonLd
        data={jsonLdGraph(
          articleNode({
            headline: article.headline,
            path: `/news/${id}`,
            description: article.content.slice(0, 200),
            imageUrl: article.imageUrl,
            datePublished: article.date,
            section: copy.stories.eyebrow,
            tags: article.tags,
          }),
          breadcrumbNode([HOME_CRUMB, { name: copy.stories.eyebrow, path: "/news" }, { name: article.headline, path: `/news/${id}` }])
        )}
      />
      <div className="container max-w-3xl">
        <Link href="/news" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-mist/75 hover:text-ivory">
          <ArrowLeft className="h-4 w-4" /> {copy.stories.eyebrow}
        </Link>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-stamp text-signal">{formatDate(article.date, { day: "numeric", month: "long", year: "numeric" })}</p>
        <h1 className="mt-2 font-display text-5xl font-black uppercase leading-[0.88] tracking-tight font-condensed sm:text-6xl">{article.headline}</h1>
        {article.tags?.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {article.tags.map((t) => (
              <li key={t} className="rounded-full border border-line/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mist/80">
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
      {article.imageUrl && (
        <div className="container mt-8 max-w-5xl">
          <div className="relative -mx-5 aspect-[16/9] overflow-hidden sm:mx-0 sm:rounded-3xl">
            <Image src={article.imageUrl} alt="" fill priority sizes="(min-width: 1024px) 64rem, 100vw" className="object-cover" />
          </div>
        </div>
      )}
      <div className="container mt-8 max-w-3xl space-y-6">
        {article.audioUrl && <audio controls preload="none" src={article.audioUrl} className="w-full" />}
        <div className="whitespace-pre-line text-lg leading-relaxed text-mist/90">{article.content}</div>
      </div>
      {more.length > 0 && (
        <aside className="container mt-16 max-w-5xl">
          <h2 className="mb-5 font-mono text-[11px] uppercase tracking-stamp text-mist/70">More stories</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {more.map((a) => (
              <Link key={a.id} href={`/news/${a.id}`} className="group block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line/10 bg-navy-deep">
                  {a.imageUrl && <Image src={a.imageUrl} alt="" fill sizes="33vw" className="object-cover" />}
                </div>
                <p className="mt-2 font-semibold leading-snug">{a.headline}</p>
              </Link>
            ))}
          </div>
        </aside>
      )}
    </article>
  )
}
