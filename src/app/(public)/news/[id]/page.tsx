import type { Metadata } from "next"
import type { CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { copy } from "@/lib/copy"
import { formatDate, cn } from "@/lib/utils"
import { focusStyle } from "@/lib/image-position"
import { getArticle, getNews } from "@/lib/server/queries"
import { HOME_CRUMB, SOCIAL_CARD, articleNode, breadcrumbNode, detailKeywords, detailMetadata, jsonLdGraph } from "@/lib/seo"
import { JsonLd } from "@/components/seo/json-ld"
import { ArtImage } from "@/components/brand/art-image"

export const revalidate = 60

type Props = { params: Promise<{ id: string }> }

/**
 * Hero frames. Covers render with `object-cover`, so a full-length portrait photo in the
 * landscape frame loses its subject. An article that supplies a portrait `heroImageUrl`
 * gets a 4:5 frame that matches the photo instead.
 * Class strings are written out in full so Tailwind's scanner can see them.
 */
const HERO_FRAMES = {
  landscape: {
    box: "container mt-8 max-w-5xl",
    frame: "relative -mx-5 aspect-[16/9] overflow-hidden sm:mx-0 sm:rounded-3xl",
    sizes: "(min-width: 1024px) 64rem, 100vw",
    /**
     * Phone-first overrides, used only when the article has a separate mobile photo. The
     * narrow frame gives that photo the portrait shape it was shot in, then hands back to
     * the landscape frame from `sm` up.
     */
    withPhone: {
      box: "container mt-8 max-w-md sm:max-w-5xl",
      frame: "relative -mx-5 aspect-[4/5] overflow-hidden sm:mx-0 sm:aspect-[16/9] sm:rounded-3xl",
    },
  },
  portrait: {
    box: "container mt-8 max-w-md",
    frame: "relative -mx-5 aspect-[4/5] overflow-hidden sm:mx-0 sm:rounded-3xl",
    sizes: "(min-width: 768px) 28rem, 100vw",
    /** Already 4:5 at every width, so a mobile photo only swaps the file. */
    withPhone: {
      box: "container mt-8 max-w-md",
      frame: "relative -mx-5 aspect-[4/5] overflow-hidden sm:mx-0 sm:rounded-3xl",
    },
  },
} as const

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
  const heroSrc = article.heroImageUrl || article.imageUrl
  const hero = article.heroImageUrl ? HERO_FRAMES.portrait : HERO_FRAMES.landscape
  // A separate phone photo unlocks the narrower frame on small screens.
  const phoneHero = article.heroImageMobileUrl ? hero.withPhone : null
  // Read once: the gallery's layout decisions all branch on the count.
  const photos = article.photos ?? []
  const photoCount = photos.length

  /*
   * The writer's crop, handed to the `<img>` as custom properties.
   *
   * Which stored position applies depends on which file the hero actually shows: a portrait
   * `heroImageUrl` overrides the cover, and a separate phone photo overrides both on small
   * screens. `--focus-mobile` is left unset unless there is a phone-only photo, so phones fall
   * back to the same crop as the wide frame in the ordinary case.
   */
  const heroFocus = {
    "--focus-desktop": article.heroImageUrl ? article.heroImagePosition : article.imagePosition,
    "--focus-mobile": article.heroImageMobileUrl ? article.heroImageMobilePosition : undefined,
  } as CSSProperties

  return (
    <article className="pt-20 md:pt-28">
      <JsonLd
        data={jsonLdGraph(
          articleNode({
            headline: article.headline,
            path: `/news/${id}`,
            description: article.content.slice(0, 200),
            imageUrl: article.imageUrl,
            imageUrls: article.photos?.map((p) => p.url),
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
      {heroSrc && (
        <div className={phoneHero ? phoneHero.box : hero.box}>
          <div className={phoneHero ? phoneHero.frame : hero.frame}>
            <ArtImage
              desktop={heroSrc}
              mobile={article.heroImageMobileUrl}
              alt=""
              priority
              sizes={hero.sizes}
              mobileSizes="100vw"
              className="absolute inset-0"
              imgClassName="art-focus h-full w-full object-cover"
              imgStyle={heroFocus}
            />
          </div>
        </div>
      )}
      <div className="container mt-8 max-w-3xl space-y-6">
        {article.audioUrl && <audio controls preload="none" src={article.audioUrl} className="w-full" />}
        <div className="whitespace-pre-line text-lg leading-relaxed text-mist/90">{article.content}</div>
      </div>
      {photoCount > 0 && (
        <section className="container mt-12 max-w-5xl">
          <h2 className="mb-5 font-mono text-[11px] uppercase tracking-stamp text-mist/70">
            Photos{photoCount > 1 ? ` · ${photoCount}` : ""}
          </h2>
          {/*
            Two up on a phone, three from `sm`. A single photo spans the full width instead of
            sitting in a third of the grid, which is what one wide shot deserves.
          */}
          <ul className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            {photos.map((photo, i) => (
              <li key={`${photo.url}-${i}`} className={cn(photoCount === 1 && "sm:col-span-3")}>
                <figure>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line/10 bg-navy-deep">
                    <Image
                      src={photo.url}
                      alt={photo.caption ?? ""}
                      fill
                      sizes={photoCount === 1 ? "(min-width: 1024px) 64rem, 100vw" : "(min-width: 640px) 33vw, 50vw"}
                      className="object-cover"
                      style={focusStyle(photo.position)}
                    />
                  </div>
                  {photo.caption && <figcaption className="mt-2 text-sm text-mist/70">{photo.caption}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}
      {more.length > 0 && (
        <aside className="container mt-16 max-w-5xl">
          <h2 className="mb-5 font-mono text-[11px] uppercase tracking-stamp text-mist/70">More stories</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {more.map((a) => (
              <Link key={a.id} href={`/news/${a.id}`} className="group block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line/10 bg-navy-deep">
                  {a.imageUrl && <Image src={a.imageUrl} alt="" fill sizes="33vw" className="object-cover" style={focusStyle(a.imagePosition)} />}
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
