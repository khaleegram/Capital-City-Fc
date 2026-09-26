import "server-only"

import { unstable_cache } from "next/cache"
import { getDocById, listDocs } from "./firestore"
import { TAGS, type CacheTag } from "@/lib/cache-tags"
import type {
  Achievement,
  Fixture,
  Gallery,
  Journey,
  JourneyEntry,
  MediaAsset,
  NewsArticle,
  Placement,
  Player,
  ProofStats,
  Recap,
  StaffMember,
  SquadStatus,
  TeamProfile,
} from "@/lib/data"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { applyProofOverride, computeProofStats } from "@/lib/proof"

const REVALIDATE = 300

function cached<A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, tags: CacheTag[]) {
  return unstable_cache(fn, ["ccfc", key], { tags, revalidate: REVALIDATE })
}

const time = (v: unknown) => {
  if (!v) return 0
  const t = new Date(v as string).getTime()
  return Number.isNaN(t) ? 0 : t
}
const byNewest = <T extends { createdAt?: unknown }>(a: T, b: T) => time(b.createdAt) - time(a.createdAt)
const byOrder = <T extends { order?: number }>(a: T, b: T) => (a.order ?? 999) - (b.order ?? 999)

const PUBLISHED: [string, "==", boolean] = ["published", "==", true]

/* ───────── Team ───────── */

export const getTeam = cached(
  async (): Promise<TeamProfile> => {
    const doc = await getDocById<TeamProfile>("teamProfile", "main_profile")
    return {
      id: "main_profile",
      name: doc?.name || "Capital City FC",
      logoUrl: TEAM_LOGO_URL,
      homeVenue: doc?.homeVenue || "Abuja, Nigeria",
      maintenanceMode: !!doc?.maintenanceMode,
      heroVideoUrl: doc?.heroVideoUrl,
      heroImageUrl: doc?.heroImageUrl,
      heroImageMobileUrl: doc?.heroImageMobileUrl,
      socials: doc?.socials,
      proofStats: doc?.proofStats ?? null,
    }
  },
  "team",
  [TAGS.team]
)

/* ───────── Players ───────── */

export function squadStatusOf(p: Player): SquadStatus {
  if (p.squadStatus) return p.squadStatus
  return p.status === "Former Player" ? "alumni" : "current"
}

export const getPlayers = cached(
  async (): Promise<Player[]> => {
    // Firestore rules are not filters: a public list of `players` must ask for
    // `published == true` itself, or the rules reject the whole query and this returns
    // an empty squad. Drafts are unreadable by design — see the `players` read rule.
    const rows = await listDocs<Player>("players", { where: [PUBLISHED] })
    return rows
      .filter((p) => (p.role ?? "Player") === "Player")
      .map((p) => ({ ...p, squadStatus: squadStatusOf(p) }))
      .sort((a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99))
  },
  "players",
  [TAGS.players]
)

export const getPlayer = cached(
  async (id: string): Promise<Player | null> => {
    const p = await getDocById<Player>("players", id)
    if (!p || p.published === false) return null
    return { ...p, squadStatus: squadStatusOf(p) }
  },
  "player",
  [TAGS.players]
)

/* ───────── Journeys ───────── */

function normaliseJourney(j: Journey): Journey {
  return {
    ...j,
    stops: j.stops ?? [],
    matches: j.matches ?? [],
    quotes: j.quotes ?? [],
    playerIds: j.playerIds ?? [],
    fixtureIds: j.fixtureIds ?? [],
    squad: j.squad ?? [],
    progress: Math.max(0, Math.min(100, j.progress ?? 0)),
  }
}

export const getJourneys = cached(
  async (): Promise<Journey[]> => {
    const rows = await listDocs<Journey>("journeys", { where: [PUBLISHED] })
    const rank = { live: 0, upcoming: 1, completed: 2 } as const
    return rows
      .map(normaliseJourney)
      .sort((a, b) => rank[a.status] - rank[b.status] || byOrder(a, b) || time(b.startDate) - time(a.startDate))
  },
  "journeys",
  [TAGS.journeys]
)

export const getJourneyBySlug = cached(
  async (slug: string): Promise<Journey | null> => {
    const rows = await listDocs<Journey>("journeys", { where: [PUBLISHED, ["slug", "==", slug]], limit: 1 })
    if (rows[0]) return normaliseJourney(rows[0])
    const byId = await getDocById<Journey>("journeys", slug)
    return byId?.published ? normaliseJourney(byId) : null
  },
  "journey",
  [TAGS.journeys]
)

export const getJourneyEntries = cached(
  async (journeyId: string): Promise<JourneyEntry[]> => {
    const rows = await listDocs<JourneyEntry>(`journeys/${journeyId}/entries`)
    return rows.map((r) => ({ ...r, mediaIds: r.mediaIds ?? [] })).sort(byNewest)
  },
  "journey-entries",
  [TAGS.journeys]
)

/* ───────── Media & galleries ───────── */

const normaliseMedia = (m: MediaAsset): MediaAsset => ({
  ...m,
  playerIds: m.playerIds ?? [],
  taggedPlayers: m.taggedPlayers ?? [],
  year: m.year ?? (m.createdAt ? new Date(m.createdAt as string).getFullYear() : undefined),
})

export const getMedia = cached(
  async (): Promise<MediaAsset[]> => {
    const rows = await listDocs<MediaAsset>("mediaAssets", { where: [PUBLISHED] })
    return rows.map(normaliseMedia).sort(byNewest)
  },
  "media",
  [TAGS.media]
)

export const getMediaAsset = cached(
  async (id: string): Promise<MediaAsset | null> => {
    const m = await getDocById<MediaAsset>("mediaAssets", id)
    return m?.published ? normaliseMedia(m) : null
  },
  "media-asset",
  [TAGS.media]
)

export const getGalleries = cached(
  async (): Promise<Gallery[]> => {
    const rows = await listDocs<Gallery>("galleries", { where: [PUBLISHED] })
    return rows
      .map((g) => ({ ...g, photos: g.photos ?? [] }))
      .sort((a, b) => time(b.date ?? b.createdAt) - time(a.date ?? a.createdAt))
  },
  "galleries",
  [TAGS.galleries]
)

export const getGalleryBySlug = cached(
  async (slug: string): Promise<Gallery | null> => {
    const rows = await listDocs<Gallery>("galleries", { where: [PUBLISHED, ["slug", "==", slug]], limit: 1 })
    const g = rows[0] ?? (await getDocById<Gallery>("galleries", slug))
    return g?.published ? { ...g, photos: g.photos ?? [] } : null
  },
  "gallery",
  [TAGS.galleries]
)

/* ───────── Pathway proof ───────── */

export const getPlacements = cached(
  async (): Promise<Placement[]> => {
    const rows = await listDocs<Placement>("placements", { where: [PUBLISHED] })

    /*
     * A placement stores its own copy of the player's photo. That copy is written from
     * whatever URL the player had at the time, so it goes stale when the photo is replaced
     * and dies outright when the host it pointed at does. The homepage rail reads the
     * placement while the player's own page reads the player, so the same person showed a
     * photo in one place and an empty frame in the other.
     *
     * Preferring the linked player's current photo makes the two surfaces read from one
     * source and removes the drift rather than correcting it each time. The stored value
     * stays as the fallback for a placement with no `playerId`, or one whose player has no
     * photo of their own.
     *
     * Tagged with `players` as well as `placements`, because a change to a player's photo
     * now changes what this returns.
     */
    const players = await getPlayers()
    const photoByPlayer = new Map(players.map((p) => [p.id, p.imageUrl]))

    return rows
      .map((r) => ({ ...r, playerImageUrl: (r.playerId ? photoByPlayer.get(r.playerId) : undefined) || r.playerImageUrl }))
      .sort((a, b) => time(b.date) - time(a.date) || byNewest(a, b))
  },
  "placements",
  [TAGS.placements, TAGS.players]
)

export const getStaff = cached(
  async (): Promise<StaffMember[]> => {
    const rows = await listDocs<StaffMember>("staff", { where: [PUBLISHED] })
    if (rows.length) return rows.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    // Until staff are migrated, fall back to coaches/staff stored on the legacy players
    // collection. Same rules-not-filters constraint as getPlayers(): this must carry
    // `published == true` or Firestore rejects the query outright.
    const legacy = await listDocs<Player>("players", { where: [PUBLISHED] })
    return legacy
      .filter((p) => p.role === "Coach" || p.role === "Staff")
      .map((p, i) => ({
        id: p.id,
        name: p.name,
        role: p.role === "Coach" ? "Coach" : "Staff",
        group: p.role === "Coach" ? ("coaching" as const) : ("operations" as const),
        rank: p.role === "Coach" ? i : 50 + i,
        imageUrl: p.imageUrl,
        bio: p.bio,
        published: true,
        legacyPlayerId: p.id,
      }))
      .sort((a, b) => a.rank - b.rank)
  },
  "staff",
  [TAGS.staff]
)

export const getAchievements = cached(
  async (): Promise<Achievement[]> => {
    const rows = await listDocs<Achievement>("achievements", { where: [PUBLISHED] })
    return rows.sort((a, b) => b.year - a.year)
  },
  "achievements",
  [TAGS.achievements]
)

export const getProofStats = cached(
  async (): Promise<ProofStats> => {
    const [team, placements, journeys, achievements] = await Promise.all([
      getTeam(),
      getPlacements(),
      getJourneys(),
      getAchievements(),
    ])
    return applyProofOverride(computeProofStats(placements, journeys, achievements), team.proofStats)
  },
  "proof",
  [TAGS.proof, TAGS.team, TAGS.placements, TAGS.journeys, TAGS.achievements]
)

/* ───────── Matchday & stories ───────── */

export const getFixtures = cached(
  async (): Promise<(Fixture & { date: string })[]> => {
    const rows = await listDocs<Fixture & { date: string }>("fixtures")
    return rows.sort((a, b) => time(a.date) - time(b.date))
  },
  "fixtures",
  [TAGS.fixtures]
)

export const getFixture = cached(
  async (id: string) => getDocById<Fixture & { date: string }>("fixtures", id),
  "fixture",
  [TAGS.fixtures]
)

export const getRecapForFixture = cached(
  async (fixtureId: string): Promise<Recap | null> => {
    const rows = await listDocs<Recap>("recaps", { where: [["fixtureId", "==", fixtureId]], limit: 1 })
    return rows[0] ?? null
  },
  "recap",
  [TAGS.recaps]
)

export const getNews = cached(
  async (): Promise<NewsArticle[]> => {
    const rows = await listDocs<NewsArticle>("news")
    return rows.sort((a, b) => time(b.date) - time(a.date))
  },
  "news",
  [TAGS.news]
)

export const getArticle = cached(
  async (id: string) => getDocById<NewsArticle>("news", id),
  "article",
  [TAGS.news]
)
