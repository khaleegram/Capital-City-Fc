import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, BadgeCheck, FileText, Plane } from "lucide-react"
import { copy } from "@/lib/copy"
import type { MediaType } from "@/lib/data"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { ageFrom, cn, formatDate } from "@/lib/utils"
import { getGalleries, getJourneys, getMedia, getPlacements, getPlayer } from "@/lib/server/queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PassportBadge } from "@/components/brand/passport-badge"
import { SectionHeading } from "@/components/brand/section-heading"
import { GrainOverlay } from "@/components/brand/grain-overlay"
import { MediaCard } from "@/components/site/cards"

export const revalidate = 60

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const p = await getPlayer(id)
  if (!p) return { title: "Player not found" }
  return {
    title: `${p.name} · ${p.position}`,
    description: p.bio?.slice(0, 160),
  }
}

type TimelineItem = { key: string; date?: string; title: string; caption?: string; href?: string; tone: "origin" | "journey" | "placement" | "now" }

export default async function PlayerPage({ params }: Props) {
  const { id } = await params
  const player = await getPlayer(id)
  if (!player) notFound()

  const [placementsAll, journeysAll, mediaAll, galleriesAll] = await Promise.all([getPlacements(), getJourneys(), getMedia(), getGalleries()])
  const placements = placementsAll.filter((p) => p.playerId === player.id)
  const journeys = journeysAll.filter((j) => j.playerIds.includes(player.id))
  const media = mediaAll.filter((m) => m.playerIds.includes(player.id))
  const galleries = galleriesAll.filter((g) => g.photos.some((ph) => ph.playerIds?.includes(player.id)))
  const age = ageFrom(player.dob)
  const latest = placements[0]
  const currentClub = player.currentClub || (latest && latest.type !== "trial" ? latest.club : undefined)

  const facts: [string, string | number | undefined | null][] = [
    ["Age", age],
    ["Position", player.position],
    ["Preferred foot", player.strongFoot],
    ["Height", player.heightCm ? `${player.heightCm} cm` : null],
    ["Nationality", player.nationality],
    ["Cohort", player.cohort],
    ["Current club", currentClub],
    ["Squad no.", player.jerseyNumber],
  ]

  const timeline: TimelineItem[] = [
    { key: "ccfc", title: "Capital City FC", caption: player.cohort ? `${player.cohort} cycle · Abuja` : "Abuja, Nigeria", tone: "origin" },
    ...journeys
      .slice()
      .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))
      .map((j) => ({
        key: `j-${j.id}`,
        date: j.startDate,
        title: j.title,
        caption: [j.stops.map((s) => s.city).join(" → "), j.outcome?.badge].filter(Boolean).join(" · "),
        href: `/journeys/${j.slug}`,
        tone: "journey" as const,
      })),
    ...placements
      .slice()
      .reverse()
      .map((p) => ({
        key: `p-${p.id}`,
        date: p.date,
        title: `${p.type === "signed" ? "Signed" : p.type === "loan" ? "Loan" : "Trial"} · ${p.club}`,
        caption: [p.country, p.league].filter(Boolean).join(" · "),
        href: p.sourceUrl,
        tone: "placement" as const,
      })),
  ]
  if (currentClub && !placements.some((p) => p.club === currentClub)) {
    timeline.push({ key: "now", title: currentClub, caption: "Current club", tone: "now" })
  }

  const mediaByType = media.reduce<Record<string, typeof media>>((acc, m) => {
    ;(acc[m.type] ??= []).push(m)
    return acc
  }, {})

  const enquireHref = `/contact?role=scout&player=${encodeURIComponent(player.id)}&name=${encodeURIComponent(player.name)}`

  return (
    <article>
      {/* Hero */}
      <header className="relative overflow-hidden bg-horizon pt-14 md:pt-24">
        <div aria-hidden className="absolute inset-0 bg-grid opacity-40" />
        <GrainOverlay />
        <div className="container relative grid gap-6 md:grid-cols-[minmax(0,26rem)_1fr] md:items-end md:gap-10">
          <div className="relative -mx-5 aspect-[4/5] overflow-hidden md:mx-0 md:rounded-t-3xl">
            {player.imageUrl ? (
              <Image src={player.imageUrl} alt={player.name} fill priority sizes="(min-width: 768px) 26rem, 100vw" className="object-cover object-top" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Image src={TEAM_LOGO_URL} alt="" width={120} height={120} className="opacity-20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent md:from-ink/60" />
            <span className="absolute right-4 top-4 font-display text-8xl font-black leading-none text-ivory/15 font-condensed">{player.jerseyNumber}</span>
          </div>
          <div className="relative -mt-28 pb-8 md:mt-0 md:pb-12">
            <div className="flex flex-wrap gap-2">
              {latest && <PassportBadge label={latest.club} country={latest.country} />}
              {player.readyForNextStep && <Badge variant="live">{copy.players.readyBadge}</Badge>}
              {player.squadStatus === "alumni" && <Badge variant="outline">Alumni</Badge>}
            </div>
            <p className="mt-4 font-mono text-xs uppercase tracking-stamp text-signal">{player.position}</p>
            <h1 className="mt-2 font-display text-[15vw] font-black uppercase leading-[0.84] tracking-tight font-condensed sm:text-7xl md:text-8xl">
              {player.name}
            </h1>
            {player.nickname && <p className="mt-2 text-lg text-mist/80">&ldquo;{player.nickname}&rdquo;</p>}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={enquireHref}>
                  <FileText className="mr-2 h-4 w-4" />
                  {copy.players.requestProfile}
                </Link>
              </Button>
              {media.length > 0 && (
                <Button asChild size="lg" variant="outline">
                  <a href="#footage">Watch footage · {media.length}</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container grid gap-12 py-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
        <div className="min-w-0 space-y-14">
          {/* Data sheet */}
          <section aria-label="Profile data">
            <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line/10 sm:grid-cols-4">
              {facts
                .filter(([, v]) => v !== undefined && v !== null && v !== "")
                .map(([k, v]) => (
                  <div key={k} className="border-b border-r border-line/10 p-4 [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:[&:nth-child(4n)]:border-r-0">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist/75">{k}</dt>
                    <dd className="mt-1 font-display text-xl font-bold">{v}</dd>
                  </div>
                ))}
            </dl>
            {player.strengths && player.strengths.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {player.strengths.map((s) => (
                  <li key={s} className="rounded-full border border-line/15 px-3 py-1.5 text-sm">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {player.bio && (
            <section>
              <SectionHeading eyebrow="Profile" title="The Player." as="h2" />
              <p className="mt-5 whitespace-pre-line text-lg leading-relaxed text-mist/90">{player.bio}</p>
            </section>
          )}

          {/* Pathway timeline */}
          <section aria-labelledby="pathway">
            <SectionHeading eyebrow={copy.players.pathwayTimeline} title="From Abuja to Next." as="h2" />
            <ol id="pathway" className="relative mt-6 space-y-5 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-gradient-to-b before:from-signal before:to-white/10">
              {timeline.map((t) => {
                const body = (
                  <>
                    <span
                      className={cn(
                        "absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2",
                        t.tone === "origin" && "border-signal bg-signal text-white",
                        t.tone === "journey" && "border-line/30 bg-paper",
                        (t.tone === "placement" || t.tone === "now") && "border-signal bg-signal"
                      )}
                    >
                      {(t.tone === "placement" || t.tone === "now") && <Plane className="h-3 w-3 text-white" />}
                    </span>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist/75">
                      {t.date ? formatDate(t.date, { month: "short", year: "numeric" }) : t.tone === "origin" ? "Start" : t.tone === "now" ? "Now" : ""}
                    </p>
                    <p className="mt-0.5 font-display text-xl font-bold">{t.title}</p>
                    {t.caption && <p className="text-sm text-mist/75">{t.caption}</p>}
                  </>
                )
                return (
                  <li key={t.key} className="relative pl-10">
                    {t.href ? (
                      <Link href={t.href} className="block hover:opacity-90" target={t.href.startsWith("http") ? "_blank" : undefined}>
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                )
              })}
            </ol>
          </section>

          {/* Footage */}
          {media.length > 0 && (
            <section id="footage" aria-labelledby="footage-h" className="scroll-mt-24">
              <SectionHeading eyebrow="Footage" title="Footage Doesn't Lie." as="h2" />
              <div className="mt-6 space-y-8">
                {Object.entries(mediaByType).map(([type, items]) => (
                  <div key={type}>
                    <h3 id="footage-h" className="mb-3 font-mono text-[11px] uppercase tracking-stamp text-mist/70">
                      {copy.media.categories[type as MediaType]} · {items.length}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {items.map((m) => (
                        <MediaCard key={m.id} asset={m} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {galleries.length > 0 && (
            <section>
              <SectionHeading eyebrow={copy.gallery.eyebrow} title="In Pictures." as="h2" />
              <div className="mt-6 grid grid-cols-2 gap-3">
                {galleries.map((g) => {
                  const ph = g.photos.find((p) => p.playerIds?.includes(player.id)) ?? g.photos[0]
                  return (
                    <Link key={g.id} href={`/gallery/${g.slug}`} className="group relative aspect-square overflow-hidden rounded-2xl border border-line/10">
                      {ph && <Image src={ph.url} alt="" fill sizes="(min-width: 640px) 25vw, 50vw" className="object-cover" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent" />
                      <p className="absolute inset-x-3 bottom-3 font-semibold leading-tight">{g.title}</p>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          {player.stats && (
            <section className="rounded-2xl border border-line/10 p-5">
              <h2 className="font-mono text-[11px] uppercase tracking-stamp text-mist/70">CCFC record</h2>
              <dl className="mt-4 grid grid-cols-3 text-center">
                {(
                  [
                    ["Apps", player.stats.appearances],
                    ["Goals", player.stats.goals],
                    ["Assists", player.stats.assists],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dd className="font-display text-4xl font-black tabular-nums font-condensed">{v ?? 0}</dd>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist/75">{k}</dt>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {placements.length > 0 && (
            <section>
              <h2 className="mb-3 font-mono text-[11px] uppercase tracking-stamp text-mist/70">Placements</h2>
              <ul className="space-y-2">
                {placements.map((p) => (
                  <li key={p.id} className="rounded-xl border border-line/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{p.club}</p>
                      {p.verified && <BadgeCheck className="h-4 w-4 text-signal" aria-label="Verified" />}
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist/75">
                      {p.type} · {p.country}
                      {p.date && ` · ${formatDate(p.date, { month: "short", year: "numeric" })}`}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {player.careerHighlights?.length > 0 && (
            <section>
              <h2 className="mb-3 font-mono text-[11px] uppercase tracking-stamp text-mist/70">Highlights</h2>
              <ul className="space-y-2 text-sm text-mist/90">
                {player.careerHighlights.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-signal" />
                    {h}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link href={enquireHref} className="flex items-center justify-between rounded-2xl border border-signal/40 bg-signal/10 p-4">
            <span>
              <span className="block font-semibold">{copy.players.requestProfile}</span>
              <span className="text-sm text-mist/80">Full-match footage, data and availability.</span>
            </span>
            <ArrowUpRight className="h-5 w-5 text-signal" />
          </Link>
        </aside>
      </div>
    </article>
  )
}
