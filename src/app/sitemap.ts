import type { MetadataRoute } from "next"
import { getFixtures, getGalleries, getJourneys, getMedia, getNews, getPlayers } from "@/lib/server/queries"
import { toDate } from "@/lib/utils"
import { siteUrl } from "@/lib/site-url"

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const [journeys, players, media, galleries, news, fixtures] = await Promise.all([
    getJourneys(),
    getPlayers(),
    getMedia(),
    getGalleries(),
    getNews(),
    getFixtures(),
  ])
  const at = (v: unknown) => toDate(v) ?? undefined

  const pages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/journeys`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/players`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/media`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/gallery`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/club`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/fixtures`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/news`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.5 },
  ]

  return [
    ...pages,
    ...journeys.map((j) => ({ url: `${base}/journeys/${j.slug}`, lastModified: at(j.updatedAt), changeFrequency: j.status === "live" ? ("hourly" as const) : ("monthly" as const), priority: 0.9 })),
    ...players.map((p) => ({ url: `${base}/players/${p.id}`, lastModified: at(p.updatedAt), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...media.map((m) => ({ url: `${base}/media/${m.id}`, lastModified: at(m.createdAt), priority: 0.5 })),
    ...galleries.map((g) => ({ url: `${base}/gallery/${g.slug}`, lastModified: at(g.createdAt), priority: 0.5 })),
    ...news.map((n) => ({ url: `${base}/news/${n.id}`, lastModified: at(n.date), priority: 0.5 })),
    ...fixtures.map((f) => ({ url: `${base}/fixtures/${f.id}`, lastModified: at(f.date), priority: 0.4 })),
  ]
}
