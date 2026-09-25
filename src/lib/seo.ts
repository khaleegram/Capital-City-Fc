/**
 * Single source of truth for how the club shows up in search.
 *
 * Everything Google, Bing and the answer engines need to understand who Capital
 * City FC is — names, keywords, the Abuja location, schema.org JSON-LD — is
 * built here so pages never hand-roll metadata.
 *
 * Deployment note: set `NEXT_PUBLIC_SITE_URL` (e.g. https://capitalcityfc.ng)
 * so canonicals, the sitemap and schema.org URLs all point at the live domain.
 */
import type { Metadata } from "next"

import { TEAM_LOGO_URL } from "@/lib/brand"
import { copy } from "@/lib/copy"
import type { TeamProfile } from "@/lib/data"
import { siteUrl } from "@/lib/site-url"

/* ───────────────────────────── Identity ───────────────────────────── */

export const SITE_NAME = copy.brand.name
export const SITE_SHORT_NAME = copy.brand.short
export const SITE_LEGAL_NAME = "Capital City Football Club"
export const SITE_TAGLINE = copy.brand.masterLine
export const SITE_DESCRIPTION = copy.brand.descriptor
export const SITE_LANGUAGE = "en"
export const SITE_LOCALE = "en_NG"

/** Home title/description: carries the club name, the city and the acronym. */
export const HOME_TITLE = `${SITE_NAME} | Abuja Football Club & Player Pathway`
export const HOME_DESCRIPTION = `${SITE_NAME} (${SITE_SHORT_NAME}) is a football club and player-development pathway in Abuja, Nigeria. Fixtures, squads, tours and footage — built for Europe.`

/** Names people actually type into Google. Feeds `alternateName` in schema.org. */
export const SITE_ALTERNATE_NAMES = [
  "Capital City FC",
  "Capital City Football Club",
  "Capital City FC Abuja",
  "Capital City Football Club Abuja",
  "Capital City FC Nigeria",
  "Capital City FC Ltd",
  "CCFC",
  "CCFC Abuja",
]

/** Search phrases the public pages target. */
export const SITE_KEYWORDS = [
  "Capital City FC",
  "Capital City FC Abuja",
  "Capital City Football Club",
  "Capital City Football Club Abuja",
  "Capital City FC Nigeria",
  "CCFC",
  "CCFC Abuja",
  "Abuja football club",
  "football club in Abuja",
  "football club Abuja Nigeria",
  "Abuja football academy",
  "Abuja football trials",
  "football player development Nigeria",
  "Nigerian football players in Europe",
  "Abuja football fixtures and results",
  "Gothia Cup Nigeria",
]

/** Local signals: the club is physically at the National Stadium, Abuja (FCT). */
export const SITE_GEO = {
  city: copy.brand.origin.city,
  region: "Federal Capital Territory",
  regionCode: "NG-FC",
  country: "Nigeria",
  countryCode: "NG",
  lat: copy.brand.origin.lat,
  lng: copy.brand.origin.lng,
} as const

/* ──────────────────────── Verification tokens ──────────────────────── */

const token = (value?: string) => value?.trim() || undefined

/** Google Search Console → Settings → Ownership verification → HTML tag. */
export const GOOGLE_SITE_VERIFICATION = token(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION)
/** Bing Webmaster Tools verification token. */
export const BING_SITE_VERIFICATION = token(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION)
/** Yandex Webmaster verification token. */
export const YANDEX_SITE_VERIFICATION = token(process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION)

/* ─────────────────────────────── URLs ─────────────────────────────── */

/** Absolute URL for a site path, or a pass-through for an already absolute URL. */
export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`
}

/** Self-referencing canonical for a route's `metadata`. */
export function canonical(path = "/"): Metadata["alternates"] {
  return { canonical: path }
}

export function socialProfileUrls(socials?: TeamProfile["socials"], extra?: (string | undefined | null)[]) {
  return [...Object.values(socials ?? {}), ...(extra ?? [])].filter((url): url is string => !!url && /^https?:\/\//i.test(url))
}

/* ────────────────────── Open Graph / Twitter cards ────────────────────── */

/** A share image. `width`/`height` are optional but recommended (rich cards). */
export type ShareImage = { url: string; alt?: string; width?: number; height?: number }

/**
 * The branded card rendered by `app/opengraph-image.tsx` (1200×630, same shape as
 * `OG_SIZE` in `@/lib/og`).
 *
 * Detail routes that ship their own `opengraph-image.tsx` inherit this card for
 * free — Next merges it in as long as the page's `openGraph` has **no** `images`
 * key. Every other page must name it explicitly, otherwise it is dropped.
 */
export const SOCIAL_CARD: ShareImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME}. ${SITE_TAGLINE}`,
}

type PageOpenGraphInput = {
  title: string
  path: string
  description?: string
  images?: ShareImage[]
  type?: "website" | "article"
  publishedTime?: string
  modifiedTime?: string
}

/**
 * Full Open Graph object for a page.
 *
 * Next merges metadata shallowly, so a page that sets `openGraph` replaces the
 * root layout's object outright — this helper re-states the shared fields
 * (`siteName`, `locale`, `url`) so nothing is lost. Routes with their own
 * `opengraph-image.tsx` must **not** set `images`, so the branded card wins.
 */
export function pageOpenGraph({ title, path, description, images, type = "website", publishedTime, modifiedTime }: PageOpenGraphInput): Metadata["openGraph"] {
  // `{ absolute }` on purpose: the root layout sets `openGraph.title.template`,
  // and Next would append `· Capital City FC` to an already-complete title.
  const ogTitle = { absolute: title }
  // `images` must be *absent* (not `undefined`) when there is no photo: Next only
  // merges the file-based `opengraph-image.tsx` card when the page's openGraph
  // object has no `images` key at all (`source.openGraph.hasOwnProperty("images")`).
  const shared = {
    title: ogTitle,
    description,
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    url: path,
    ...(images?.length ? { images } : {}),
  }
  if (type === "article") {
    return {
      ...shared,
      type: "article",
      authors: [SITE_NAME],
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
    }
  }
  return { ...shared, type: "website" }
}

export function pageTwitter({ title, description }: { title: string; description?: string }): Metadata["twitter"] {
  // Same reason as `pageOpenGraph`: bypass the root `twitter.title.template`.
  return { card: "summary_large_image", title: { absolute: title }, description }
}

/**
 * The string Google shows in the tab and the SERP snippet for a detail page.
 *
 * A plain `title` is run through the `%s · Capital City FC` template by the root
 * layout; passing `{ absolute }` opts out entirely.
 */
function resolvedTitle(title: string | { absolute: string }) {
  return typeof title === "string" ? `${title} · ${SITE_NAME}` : title.absolute
}

/**
 * High-level helper for a public listing page: absolute title, canonical, OG and
 * Twitter. No listing route ships its own `opengraph-image.tsx`, so the branded
 * card is named explicitly here.
 */
export function pageMetadata(key: PageSeoKey, path: string): Metadata {
  const { title, description, keywords } = pageSeo(key)
  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: canonical(path),
    openGraph: pageOpenGraph({ title, description, path, images: [SOCIAL_CARD] }),
    twitter: pageTwitter({ title, description }),
  }
}

/**
 * High-level helper for a detail page.
 *
 * Pass `image` for an entity photo and `SOCIAL_CARD` when there is no photo and
 * the route has no `opengraph-image.tsx` of its own. Omit it entirely for routes
 * that *do* ship a card file (`players/[id]`, `journeys/[slug]`, `gallery/[slug]`),
 * so Next can merge the generated card in.
 */
export function detailMetadata({
  path,
  title,
  description,
  keywords,
  image,
  type = "website",
  publishedTime,
}: {
  path: string
  /** Plain string goes through the `%s · Capital City FC` template; use `{ absolute }` to opt out. */
  title: string | { absolute: string }
  description?: string
  keywords?: readonly string[]
  image?: ShareImage | null
  type?: "website" | "article"
  publishedTime?: string
}): Metadata {
  const absoluteTitle = resolvedTitle(title)
  return {
    title,
    description,
    keywords: keywords ? [...keywords] : undefined,
    alternates: canonical(path),
    openGraph: pageOpenGraph({ title: absoluteTitle, description, path, images: image ? [image] : undefined, type, publishedTime }),
    twitter: pageTwitter({ title: absoluteTitle, description }),
  }
}

/* ─────────────────────────── Per-page SEO copy ─────────────────────────── */

/**
 * Titles are absolute (no `%s · Capital City FC` template) so the club name and
 * the Abuja signal always lead, and descriptions stay under ~160 characters.
 */
export const PAGE_SEO = {
  home: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    keywords: [...SITE_KEYWORDS],
  },
  journeys: {
    title: "Capital City FC Journeys | Tours, Results & Tournaments",
    description:
      "Capital City FC journeys: the tours, tournaments and campaigns that take Abuja players to Europe — routes, diaries, squads, results and table standings.",
    keywords: ["Capital City FC journeys", "Abuja football tours", "Nigerian team in Europe", "Gothia Cup Nigeria", "football tournament Abuja", "Capital City FC fixtures abroad", "player exposure tours"],
  },
  players: {
    title: "Capital City FC Players | Abuja Squad & Alumni",
    description:
      "Meet the Capital City FC squad in Abuja: positions, ages, strengths and pathway records, plus alumni now signed with clubs abroad.",
    keywords: ["Capital City FC players", "Abuja football players", "Nigerian football prospects", "Capital City FC squad", "football players in Europe from Nigeria", "Abuja football trials squad", "CCFC alumni"],
  },
  media: {
    title: "Capital City FC Media | Match Footage & Highlights",
    description:
      "Watch Capital City FC: full matches, highlights, training-ground work, player focus reels, travel diaries, documentaries and interviews.",
    keywords: ["Capital City FC videos", "Abuja football match highlights", "Nigerian football footage", "football highlights Abuja", "Capital City FC full matches", "player scouting footage Nigeria"],
  },
  gallery: {
    title: "Capital City FC Gallery | Photo Stories from the Journey",
    description:
      "Photo stories from Capital City FC — training in Abuja, tournament days in Europe and life on tour, frame by frame.",
    keywords: ["Capital City FC photos", "Abuja football photos", "football gallery Abuja", "Capital City FC tour photos", "Nigerian football photojournalism"],
  },
  fixtures: {
    title: "Capital City FC Fixtures | Abuja Matches & Results",
    description:
      "Capital City FC fixtures, results and live match updates — every competitive match for the Abuja squad, with venues, kick-off times and recaps.",
    keywords: ["Capital City FC fixtures", "Capital City FC results", "Abuja football matches", "Nigerian football results", "Capital City FC live scores", "football fixtures Abuja"],
  },
  news: {
    title: "Capital City FC Stories | News from Abuja & Europe",
    description:
      "Stories and announcements from Capital City FC: match reports, signings, trials, tournament news and the road from Abuja to Europe.",
    keywords: ["Capital City FC news", "Abuja football news", "Nigerian football transfers", "Capital City FC signings", "football news Nigeria", "Capital City FC press"],
  },
  club: {
    title: "Capital City FC — The Club | Abuja Football Programme",
    description:
      "Capital City FC is a football club and player-development pathway in Abuja, Nigeria: the seven-month cycle, coaching staff, honours and the route to Europe.",
    keywords: ["Capital City FC club", "about Capital City FC", "Abuja football club", "football academy Abuja", "Nigerian football club pathway", "Capital City FC management", "football development Nigeria"],
  },
  contact: {
    title: "Contact Capital City FC | Abuja Office & Enquiries",
    description:
      "Contact Capital City FC in Abuja: email, phone and WhatsApp, our National Stadium office, and enquiry forms for scouts, clubs, parents and partners.",
    keywords: ["contact Capital City FC", "Capital City FC Abuja address", "Abuja football club contact", "Capital City FC phone number", "football trials enquiry Abuja", "Capital City FC email"],
  },
  join: {
    title: "Capital City FC Player Sign-Up | Abuja Football Trials",
    description:
      "Submit your Capital City FC player profile: position, bio, strengths and highlight links. One form — reviewed by our staff and shared with scouts.",
    keywords: ["Capital City FC trials", "Abuja football trials 2026", "football player sign up Nigeria", "join Capital City FC", "football academy application Abuja"],
  },
  fixturesDetail: {
    keywords: ["Capital City FC match", "Capital City FC result", "Capital City FC live", "Abuja football match report"],
  },
  playersDetail: {
    keywords: ["Capital City FC player profile", "Nigerian football player", "Abuja footballer", "football scouting profile Nigeria"],
  },
  mediaDetail: {
    keywords: ["Capital City FC video", "Nigerian football highlights", "Abuja football footage"],
  },
  newsDetail: {
    keywords: ["Capital City FC story", "Abuja football news", "Nigerian football report"],
  },
  galleryDetail: {
    keywords: ["Capital City FC photo story", "Abuja football gallery", "football tour photos"],
  },
  journeysDetail: {
    keywords: ["Capital City FC journey", "Abuja to Europe football tour", "Nigerian team tournament Europe"],
  },
} as const

/** Listing pages: full copy available. */
export type PageSeoKey = "home" | "journeys" | "players" | "media" | "gallery" | "fixtures" | "news" | "club" | "contact" | "join"

/** Detail pages: titles/descriptions are built from the entity, keywords are shared. */
export type DetailSeoKey = "fixturesDetail" | "playersDetail" | "mediaDetail" | "newsDetail" | "galleryDetail" | "journeysDetail"

export function pageSeo(key: PageSeoKey): { title: string; description: string; keywords: string[] } {
  const page = PAGE_SEO[key]
  return { title: page.title, description: page.description, keywords: [...page.keywords] }
}

export function detailKeywords(key: DetailSeoKey): string[] {
  return [...PAGE_SEO[key].keywords]
}

/* ───────────────────────────── schema.org ───────────────────────────── */

export type JsonLdNode = Record<string, unknown>

export const clubId = () => `${absoluteUrl("/")}#club`
export const websiteId = () => `${absoluteUrl("/")}#website`

/** Wraps nodes in one `@graph` so a single <script> can describe several entities. */
export function jsonLdGraph(...nodes: JsonLdNode[]) {
  return { "@context": "https://schema.org", "@graph": nodes }
}

export function postalAddressNode(): JsonLdNode {
  return {
    "@type": "PostalAddress",
    streetAddress: "Suite 33.2, Moshood Abiola Way, National Stadium",
    addressLocality: SITE_GEO.city,
    addressRegion: SITE_GEO.region,
    addressCountry: SITE_GEO.countryCode,
  }
}

export function geoNode(): JsonLdNode {
  return { "@type": "GeoCoordinates", latitude: SITE_GEO.lat, longitude: SITE_GEO.lng }
}

/** The club itself — drives Google's knowledge panel and the Abuja local results. */
export function clubNode(team?: Pick<TeamProfile, "socials">): JsonLdNode {
  return {
    "@type": ["SportsTeam", "SportsOrganization"],
    "@id": clubId(),
    name: SITE_NAME,
    alternateName: [...SITE_ALTERNATE_NAMES],
    legalName: SITE_LEGAL_NAME,
    description: SITE_DESCRIPTION,
    slogan: SITE_TAGLINE,
    url: absoluteUrl("/"),
    sport: "Association football",
    logo: { "@type": "ImageObject", url: absoluteUrl(TEAM_LOGO_URL), caption: `${SITE_NAME} crest` },
    image: absoluteUrl(TEAM_LOGO_URL),
    email: copy.brand.email,
    telephone: copy.brand.phone,
    identifier: copy.brand.legal,
    address: postalAddressNode(),
    location: { "@type": "Place", name: `${SITE_GEO.city}, ${SITE_GEO.country}`, address: postalAddressNode(), geo: geoNode() },
    foundingLocation: { "@type": "Place", name: `${SITE_GEO.city}, ${SITE_GEO.country}` },
    areaServed: ["Nigeria", "Europe"],
    sameAs: socialProfileUrls(team?.socials),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: copy.brand.email,
        telephone: copy.brand.phone,
        areaServed: SITE_GEO.countryCode,
        availableLanguage: ["en"],
      },
    ],
  }
}

export function websiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": websiteId(),
    url: absoluteUrl("/"),
    name: SITE_NAME,
    alternateName: SITE_SHORT_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
    publisher: { "@id": clubId() },
  }
}

/** Site-wide graph, rendered once by the public layout. */
export function siteGraph(team?: Pick<TeamProfile, "socials">) {
  return jsonLdGraph(clubNode(team), websiteNode())
}

export type Crumb = { name: string; path: string }

export function breadcrumbNode(trail: Crumb[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  }
}

/** A page node — WebPage, CollectionPage, AboutPage, ContactPage… */
export function pageNode({ path, name, description, type = "WebPage" }: { path: string; name: string; description?: string; type?: string }): JsonLdNode {
  return {
    "@type": type,
    "@id": `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name,
    description,
    isPartOf: { "@id": websiteId() },
    about: { "@id": clubId() },
    inLanguage: SITE_LANGUAGE,
  }
}

export const HOME_CRUMB: Crumb = { name: "Home", path: "/" }

/** Graph for a listing page: the page itself plus its breadcrumb trail. */
export function pageGraph({ path, name, description, type, trail }: { path: string; name: string; description?: string; type?: string; trail?: Crumb[] }) {
  return jsonLdGraph(
    pageNode({ path, name, description, type }),
    breadcrumbNode(trail?.length ? [HOME_CRUMB, ...trail] : [HOME_CRUMB, { name, path }])
  )
}

/* ─────────────────────── Content entity builders ─────────────────────── */

/** ISO-8601 duration for schema.org (`PT4M13S`). */
export function isoDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return undefined
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s ? `${s}S` : ""}`
}

/** Stories / press coverage. */
export function articleNode(input: {
  headline: string
  path: string
  description?: string
  imageUrl?: string | null
  datePublished?: string
  dateModified?: string
  section?: string
  tags?: string[]
}): JsonLdNode {
  const url = absoluteUrl(input.path)
  return {
    "@type": "NewsArticle",
    "@id": `${url}#article`,
    headline: input.headline,
    name: input.headline,
    description: input.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: input.datePublished || undefined,
    dateModified: input.dateModified || input.datePublished || undefined,
    image: [absoluteUrl(input.imageUrl || TEAM_LOGO_URL)],
    articleSection: input.section,
    keywords: input.tags?.length ? input.tags.join(", ") : undefined,
    inLanguage: SITE_LANGUAGE,
    author: { "@id": clubId() },
    publisher: { "@id": clubId() },
    isPartOf: { "@id": websiteId() },
  }
}

/** Player profiles — makes players discoverable as people, not just text. */
export function athleteNode(input: {
  name: string
  path: string
  bio?: string
  position?: string
  nationality?: string
  heightCm?: number
  jerseyNumber?: number
  imageUrl?: string | null
  currentClub?: string
  squadStatus?: string
}): JsonLdNode {
  const url = absoluteUrl(input.path)
  return {
    "@type": "Person",
    "@id": `${url}#person`,
    name: input.name,
    url,
    description: input.bio,
    image: input.imageUrl ? absoluteUrl(input.imageUrl) : undefined,
    jobTitle: input.position ? `Football player · ${input.position}` : "Football player",
    nationality: input.nationality ? { "@type": "Country", name: input.nationality } : undefined,
    height: input.heightCm ? { "@type": "QuantitativeValue", value: input.heightCm, unitCode: "CMT" } : undefined,
    memberOf: { "@id": clubId() },
    affiliation: input.currentClub ? [{ "@type": "SportsTeam", name: input.currentClub }] : undefined,
    identifier: input.jerseyNumber != null ? `#${input.jerseyNumber}` : undefined,
    knowsAbout: ["Association football", input.position || "Football"].filter(Boolean),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  }
}

/** Match footage, highlight reels, documentaries. */
export function videoNode(input: {
  name: string
  path: string
  description?: string
  thumbnailUrl?: string | null
  uploadDate?: string
  durationSeconds?: number
  contentUrl?: string
  embedUrl?: string | null
}): JsonLdNode {
  const url = absoluteUrl(input.path)
  return {
    "@type": "VideoObject",
    "@id": `${url}#video`,
    name: input.name,
    description: input.description,
    url,
    thumbnailUrl: [absoluteUrl(input.thumbnailUrl || TEAM_LOGO_URL)],
    uploadDate: input.uploadDate || undefined,
    duration: isoDuration(input.durationSeconds),
    contentUrl: input.contentUrl && /^https?:\/\//i.test(input.contentUrl) ? input.contentUrl : undefined,
    embedUrl: input.embedUrl || undefined,
    publisher: { "@id": clubId() },
    inLanguage: SITE_LANGUAGE,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  }
}

/** Fixtures and results. */
export function sportsEventNode(input: {
  name: string
  path: string
  /** Distinguishes several matches sharing one page (a journey's fixture list). */
  key?: string
  startDate?: string
  venue?: string
  competition?: string
  opponent?: string
  homeScore?: number
  awayScore?: number
}): JsonLdNode {
  const url = absoluteUrl(input.path)
  const score = input.homeScore != null && input.awayScore != null ? `Capital City FC ${input.homeScore}–${input.awayScore} ${input.opponent}` : undefined
  const fragment = input.key ? `match-${input.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}` : "match"
  return {
    "@type": "SportsEvent",
    "@id": `${url}#${fragment}`,
    name: input.name,
    url,
    startDate: input.startDate || undefined,
    sport: "Association football",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: input.venue
      ? { "@type": "Place", name: input.venue, address: { "@type": "PostalAddress", addressLocality: input.venue, addressCountry: SITE_GEO.countryCode } }
      : { "@id": clubId() },
    competitor: [{ "@id": clubId() }, ...(input.opponent ? [{ "@type": "SportsTeam", name: input.opponent }] : [])],
    organizer: { "@id": clubId() },
    description: [input.competition, score].filter(Boolean).join(" · ") || undefined,
    isPartOf: { "@id": websiteId() },
  }
}

/** Photo stories. */
export function imageGalleryNode(input: {
  name: string
  path: string
  description?: string
  datePublished?: string
  location?: string
  photos: { url: string; caption?: string }[]
}): JsonLdNode {
  const url = absoluteUrl(input.path)
  return {
    "@type": "ImageGallery",
    "@id": `${url}#gallery`,
    name: input.name,
    url,
    description: input.description,
    datePublished: input.datePublished || undefined,
    locationCreated: input.location ? { "@type": "Place", name: input.location } : undefined,
    image: input.photos.slice(0, 20).map((photo) => ({ "@type": "ImageObject", url: absoluteUrl(photo.url), caption: photo.caption, creditText: SITE_NAME })),
    author: { "@id": clubId() },
    publisher: { "@id": clubId() },
    isPartOf: { "@id": websiteId() },
  }
}
