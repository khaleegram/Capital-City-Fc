import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, Quote } from "lucide-react"
import { copy } from "@/lib/copy"
import type { JourneySquadMember, JourneyStop, Player } from "@/lib/data"
import { cn, formatDate } from "@/lib/utils"
import {
  getFixtures,
  getGalleries,
  getJourneyBySlug,
  getJourneyEntries,
  getMedia,
  getPlayers,
} from "@/lib/server/queries"
import { ProgressRail, type RailStep } from "@/components/brand/progress-rail"
import { RouteMap } from "@/components/brand/route-map"
import { SectionHeading } from "@/components/brand/section-heading"
import { TournamentStamp } from "@/components/brand/tournament-stamp"
import { GrainOverlay } from "@/components/brand/grain-overlay"
import { Reveal } from "@/components/brand/reveal"
import { JourneyStatusBadge, MediaCard } from "@/components/site/cards"
import { LiveDiary } from "./live-diary"

export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const j = await getJourneyBySlug(slug)
  if (!j) return { title: "Journey not found" }
  return { title: j.title, description: j.subtitle || j.summary.slice(0, 160) }
}

const ORIGIN: JourneyStop = {
  city: copy.brand.origin.city,
  country: copy.brand.origin.country,
  code: copy.brand.origin.code,
  lat: copy.brand.origin.lat,
  lng: copy.brand.origin.lng,
  reached: true,
}

export default async function JourneyPage({ params }: Props) {
  const { slug } = await params
  const journey = await getJourneyBySlug(slug)
  if (!journey) notFound()

  const [entries, allMedia, galleries, players, fixtures] = await Promise.all([
    getJourneyEntries(journey.id),
    getMedia(),
    getGalleries(),
    getPlayers(),
    getFixtures(),
  ])

  const media = allMedia.filter((m) => m.journeyId === journey.id)
  const linkedGalleries = galleries.filter((g) => g.journeyId === journey.id)
  const profiles = new Map(players.map((p) => [p.id, p]))
  const roster = journey.squad ?? []
  const linkedSquad = players.filter((p) => journey.playerIds.includes(p.id))
  const squad = roster.length > 0 ? roster : linkedSquad.map((p) => ({
    number: p.jerseyNumber,
    name: p.name,
    position: p.position as JourneySquadMember["position"],
    playerId: p.id,
  }))
  const linkedFixtures = fixtures.filter((f) => journey.fixtureIds.includes(f.id))
  const isDomestic = journey.kind === "domestic"
  const r = journey.record

  const mapStops = (isDomestic ? journey.stops : [ORIGIN, ...journey.stops]).filter(
    (s): s is JourneyStop & { lat: number; lng: number } => typeof s.lat === "number" && typeof s.lng === "number"
  )

  const railSteps: RailStep[] = journey.stops.map((s, i) => ({
    key: `${s.city}-${i}`,
    title: isDomestic ? s.city : `${s.city}`,
    caption: isDomestic
      ? s.country
      : [s.country, s.arrive && formatDate(s.arrive, { day: "numeric", month: "short" })].filter(Boolean).join(" · "),
    state: s.current ? "current" : s.reached ? "done" : "next",
  }))

  return (
    <article>
      {/* Header */}
      <header className="relative overflow-hidden pb-10 pt-24 md:pb-16 md:pt-32">
        {journey.coverImageUrl ? (
          <Image src={journey.coverImageUrl} alt="" fill priority sizes="100vw" className="object-cover opacity-45" />
        ) : (
          <div className="absolute inset-0 bg-horizon" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/60 to-ink" />
        <div className="absolute inset-0 bg-grid opacity-40 mask-fade-b" />
        <GrainOverlay />
        <div className="container relative">
          <div className="flex items-center gap-3">
            <JourneyStatusBadge status={journey.status} />
            <span className="font-mono text-[10px] uppercase tracking-stamp text-mist/70">
              {isDomestic ? "Domestic campaign" : "International journey"}
              {journey.season && ` · ${journey.season}`}
            </span>
          </div>
          <div className="mt-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-[14vw] font-black uppercase leading-[0.84] tracking-tight font-condensed sm:text-7xl md:text-8xl">
                {journey.title}
              </h1>
              {journey.subtitle && <p className="mt-4 max-w-xl text-lg text-mist/85">{journey.subtitle}</p>}
              {(journey.startDate || journey.endDate) && (
                <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-mist/70">
                  {formatDate(journey.startDate)} {journey.endDate && `→ ${formatDate(journey.endDate)}`}
                </p>
              )}
            </div>
            {journey.outcome?.badge && (
              <TournamentStamp
                top={journey.title}
                center={journey.outcome.badge}
                bottom={journey.season || ""}
                className="hidden h-28 w-28 shrink-0 sm:block md:h-36 md:w-36"
              />
            )}
          </div>

          {r && r.played > 0 && (
            <dl className="mt-8 grid grid-cols-6 overflow-hidden rounded-2xl border border-line/10 bg-paper backdrop-blur">
              {(
                [
                  ["P", r.played],
                  ["W", r.won],
                  ["D", r.drawn],
                  ["L", r.lost],
                  ["GF", r.goalsFor],
                  ["GA", r.goalsAgainst],
                ] as const
              ).map(([k, v], i) => (
                <div key={k} className={cn("px-2 py-3 text-center", i > 0 && "border-l border-line/10")}>
                  <dd className={cn("font-display text-2xl font-black tabular-nums font-condensed sm:text-4xl", k === "L" && v === 0 && "text-signal")}>{v}</dd>
                  <dt className="font-mono text-[10px] tracking-[0.2em] text-mist/75">{k}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      </header>

      <div className="container grid gap-12 py-10 lg:grid-cols-[1fr_22rem] lg:gap-14">
        <div className="min-w-0 space-y-14">
          {/* Story */}
          <Reveal>
            <p className="whitespace-pre-line text-lg leading-relaxed text-mist/90">{journey.summary}</p>
          </Reveal>

          {/* Route */}
          {(mapStops.length > 1 || railSteps.length > 0) && (
            <section aria-labelledby="route">
              <SectionHeading eyebrow={isDomestic ? "Rounds" : "Route"} title={isDomestic ? "Round by Round." : "Stop by Stop."} as="h2" />
              <div id="route" className="mt-6 space-y-6">
                {!isDomestic && mapStops.length > 1 && <RouteMap stops={mapStops} />}
                {railSteps.length > 0 && (
                  <div className="rounded-2xl border border-line/10 p-5">
                    <div className="mb-4 flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-mist/70">
                      <span>Progress</span>
                      <span>{journey.progress}%</span>
                    </div>
                    <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-line/10">
                      <div className="h-full rounded-full bg-signal" style={{ width: `${journey.progress}%` }} />
                    </div>
                    <ProgressRail steps={railSteps} />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Diary */}
          <section aria-labelledby="diary">
            <SectionHeading eyebrow={copy.journeys.diary} title="As It Happened." as="h2" />
            <div id="diary" className="mt-6">
              <LiveDiary journeyId={journey.id} initial={entries} live={journey.status === "live"} media={media} />
            </div>
          </section>

          {/* Results */}
          {journey.matches.length > 0 && (
            <section aria-labelledby="results">
              <SectionHeading eyebrow={copy.journeys.results} title="Every Match Moves It Forward." as="h2" />
              <ul id="results" className="mt-6 divide-y divide-white/10 overflow-hidden rounded-2xl border border-line/10">
                {journey.matches.map((m) => {
                  const played = m.status === "played" && typeof m.scoreFor === "number" && typeof m.scoreAgainst === "number"
                  const res = played ? (m.scoreFor! > m.scoreAgainst! ? "W" : m.scoreFor === m.scoreAgainst ? "D" : "L") : null
                  return (
                    <li key={m.id} className="flex items-center gap-3 p-4">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
                          res === "W" && "bg-signal text-white",
                          res === "D" && "bg-line/15 text-ivory",
                          res === "L" && "border border-line/20 text-mist",
                          !res && "border border-dashed border-line/20 text-mist/75"
                        )}
                      >
                        {res ?? (m.status === "live" ? "•" : "–")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">vs {m.opponent}</p>
                        <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-mist/75">
                          {m.stage}
                          {m.date && ` · ${formatDate(m.date, { day: "numeric", month: "short" })}`}
                          {m.venue && ` · ${m.venue}`}
                        </p>
                        {m.note && <p className="mt-0.5 text-xs text-mist/70">{m.note}</p>}
                      </div>
                      <span className="font-display text-2xl font-black tabular-nums font-condensed">
                        {played ? `${m.scoreFor}–${m.scoreAgainst}` : m.status === "live" ? "LIVE" : ""}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {journey.table && journey.table.length > 0 && (
                <div className="mt-6 overflow-x-auto rounded-2xl border border-line/10">
                  <table className="w-full min-w-[26rem] text-sm">
                    <thead className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist/75">
                      <tr className="border-b border-line/10">
                        <th className="p-3 text-left">Team</th>
                        {["P", "W", "D", "L", "GD", "Pts"].map((h) => (
                          <th key={h} className="p-3 text-right">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {journey.table.map((row) => (
                        <tr key={row.team} className={cn("border-b border-line/5 last:border-0", row.isUs && "bg-signal/10 font-semibold")}>
                          <td className="p-3">{row.team}</td>
                          <td className="p-3 text-right tabular-nums">{row.p}</td>
                          <td className="p-3 text-right tabular-nums">{row.w}</td>
                          <td className="p-3 text-right tabular-nums">{row.d}</td>
                          <td className="p-3 text-right tabular-nums">{row.l}</td>
                          <td className="p-3 text-right tabular-nums">{row.gf - row.ga}</td>
                          <td className="p-3 text-right font-bold tabular-nums">{row.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {squad.length > 0 && (
            <section aria-labelledby="squad">
              <SectionHeading eyebrow={copy.journeys.squad} title="Who Made The Trip." as="h2" />
              <JourneyRoster id="squad" members={squad} profiles={profiles} />
            </section>
          )}

          {/* Media */}
          {media.length > 0 && (
            <section aria-labelledby="media">
              <SectionHeading eyebrow="Footage" title="Watch the Journey." href={`/media?journey=${journey.id}`} as="h2" />
              <div id="media" className="mt-6 grid gap-4 sm:grid-cols-2">
                {media.slice(0, 6).map((m) => (
                  <MediaCard key={m.id} asset={m} />
                ))}
              </div>
            </section>
          )}

          {/* Galleries */}
          {linkedGalleries.length > 0 && (
            <section aria-labelledby="galleries">
              <SectionHeading eyebrow={copy.gallery.eyebrow} title="In Pictures." as="h2" />
              <div id="galleries" className="mt-6 grid gap-4 sm:grid-cols-2">
                {linkedGalleries.map((g) => (
                  <Link key={g.id} href={`/gallery/${g.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-2xl border border-line/10">
                    {g.photos[0] && <Image src={g.photos[0].url} alt="" fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent" />
                    <div className="absolute inset-x-4 bottom-4">
                      <p className="font-mono text-[10px] uppercase tracking-stamp text-mist/80">{g.photos.length} photos</p>
                      <p className="font-display text-2xl font-black uppercase leading-none font-condensed">{g.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Quotes */}
          {journey.quotes.length > 0 && (
            <section className="space-y-6">
              {journey.quotes.map((q, i) => (
                <figure key={i} className="rounded-3xl border border-line/10 bg-paper p-6">
                  <Quote className="h-6 w-6 text-signal" aria-hidden />
                  <blockquote className="mt-3 font-display text-2xl font-bold leading-snug">{q.text}</blockquote>
                  <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-mist/70">
                    {q.author}
                    {q.role && <span className="text-mist/72"> · {q.role}</span>}
                  </figcaption>
                </figure>
              ))}
            </section>
          )}

          {/* Outcome */}
          {journey.outcome?.headline && (
            <section className="relative overflow-hidden rounded-3xl bg-signal p-6 text-white sm:p-8">
              <div aria-hidden className="absolute inset-0 bg-grid opacity-30" />
              <div className="relative">
                <p className="font-mono text-[11px] uppercase tracking-stamp text-white/80">{copy.journeys.outcome}</p>
                <h2 className="mt-2 font-display text-4xl font-black uppercase leading-[0.9] font-condensed sm:text-5xl">{journey.outcome.headline}</h2>
                {journey.outcome.body && <p className="mt-3 max-w-xl text-white/90">{journey.outcome.body}</p>}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-10 lg:sticky lg:top-24 lg:self-start">
          {linkedSquad.length > 0 && (
            <section>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-stamp text-mist/70">CCFC profiles · {linkedSquad.length}</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {linkedSquad.map((p) => (
                  <li key={p.id}>
                    <Link href={`/players/${p.id}`} className="flex items-center gap-3 rounded-xl border border-line/10 p-2 pr-3 hover:border-line/25">
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-navy-soft">
                        {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="44px" className="object-cover object-top" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{p.name}</span>
                        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-mist/75">
                          #{p.jerseyNumber} · {p.position}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {linkedFixtures.length > 0 && (
            <section>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-stamp text-mist/70">Match centre</h2>
              <ul className="space-y-2">
                {linkedFixtures.map((f) => (
                  <li key={f.id}>
                    <Link href={`/fixtures/${f.id}`} className="flex items-center justify-between rounded-xl border border-line/10 p-3 hover:border-line/25">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">vs {f.opponent}</span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist/75">{formatDate(f.date)}</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-signal" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Link href="/contact?role=scout" className="flex items-center justify-between rounded-2xl border border-signal/40 bg-signal/10 p-4">
            <span>
              <span className="block font-semibold">Scouting this squad?</span>
              <span className="text-sm text-mist/80">Request profiles and full-match footage.</span>
            </span>
            <ArrowUpRight className="h-5 w-5 text-signal" />
          </Link>
        </aside>
      </div>
    </article>
  )
}

const POS_ORDER: JourneySquadMember["position"][] = ["Goalkeeper", "Defender", "Midfielder", "Forward"]

function JourneyRoster({
  id,
  members,
  profiles,
}: {
  id: string
  members: JourneySquadMember[]
  profiles: Map<string, Player>
}) {
  const groups = POS_ORDER.map((position) => ({
    position,
    rows: members.filter((m) => m.position === position).sort((a, b) => a.number - b.number),
  })).filter((g) => g.rows.length > 0)

  return (
    <div id={id} className="mt-6 overflow-hidden rounded-2xl border border-line/10">
      <table className="w-full text-sm">
        <thead className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist/75">
          <tr className="border-b border-line/10">
            <th className="p-3 text-left">No</th>
            <th className="p-3 text-left">Player</th>
            <th className="p-3 text-right">G</th>
            <th className="p-3 text-right">A</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.position}>
            <tr className="border-b border-line/10 bg-line/5">
              <td colSpan={4} className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mist/70">
                {g.position}
              </td>
            </tr>
            {g.rows.map((m) => {
              const profile = m.playerId ? profiles.get(m.playerId) : undefined
              const name = (
                <span className="font-semibold">
                  {m.name}
                  {profile?.nickname && <span className="ml-1.5 font-normal text-mist/75">“{profile.nickname}”</span>}
                </span>
              )
              return (
                <tr key={`${m.number}-${m.name}`} className="border-b border-line/5 last:border-0">
                  <td className="p-3 font-mono tabular-nums text-mist/70">{m.number}</td>
                  <td className="p-3">
                    {profile ? (
                      <Link href={`/players/${profile.id}`} className="hover:text-signal">
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
                  </td>
                  <td className="p-3 text-right tabular-nums">{m.goals ?? 0}</td>
                  <td className="p-3 text-right tabular-nums">{m.assists ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        ))}
      </table>
    </div>
  )
}
