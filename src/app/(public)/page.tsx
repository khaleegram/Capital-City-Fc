import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ArrowUpRight, Quote } from "lucide-react"
import { copy } from "@/lib/copy"
import { TEAM_LOGO_URL } from "@/lib/brand"
import {
  getJourneyEntries,
  getJourneys,
  getMedia,
  getPlacements,
  getPlayers,
  getProofStats,
  getTeam,
} from "@/lib/server/queries"
import { Button } from "@/components/ui/button"
import { CoordStamp } from "@/components/brand/coord-stamp"
import { GrainOverlay } from "@/components/brand/grain-overlay"
import { Reveal } from "@/components/brand/reveal"
import { WorldFlight } from "@/components/brand/world-flight"
import { SectionHeading, Eyebrow } from "@/components/brand/section-heading"
import { HeroMedia } from "@/components/site/hero-media"
import { ProofStrip } from "@/components/site/proof-strip"
import { PathwaySteps } from "@/components/site/pathway-steps"
import { LiveJourneyCard } from "@/components/site/live-journey-card"
import { JourneyCard, MediaCard, PlacementCard, PlayerCard, ViewAllTile } from "@/components/site/cards"

export const revalidate = 60

export default async function HomePage() {
  const [team, proof, journeys, placements, players, media] = await Promise.all([
    getTeam(),
    getProofStats(),
    getJourneys(),
    getPlacements(),
    getPlayers(),
    getMedia(),
  ])

  const spotlight = journeys.find((j) => j.status === "live") ?? journeys.find((j) => j.status === "upcoming")
  const latest = spotlight?.status === "live" ? (await getJourneyEntries(spotlight.id))[0] : null
  const completed = journeys.filter((j) => j.status === "completed")
  const current = players.filter((p) => p.squadStatus === "current")
  const ready = current.filter((p) => p.readyForNextStep)
  const prospects = ready.length ? ready : current
  const reel = [...media.filter((m) => m.featured), ...media.filter((m) => !m.featured)].slice(0, 8)
  const hasProof = Object.values(proof).some((n) => n > 0)
  const destinations = Array.from(
    new Set(journeys.flatMap((j) => j.stops.map((s) => `${s.code || s.city.slice(0, 3).toUpperCase()} ${s.city}`)))
  )
  const tickerItems = destinations.length ? destinations : ["ABJ Abuja", "GOT Gothenburg", "HJØ Hjørring"]

  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className="on-dark relative flex min-h-[100svh] flex-col overflow-hidden bg-ink">
        <HeroMedia image={team.heroImageUrl} video={team.heroVideoUrl} />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/30 to-ink" />
        <div aria-hidden className="absolute inset-0 bg-grid opacity-50 mask-fade-b" />
        <GrainOverlay opacity={0.07} />
        <div className="relative z-10 flex flex-1 flex-col">
          <div className="pointer-events-none mx-auto mt-16 h-[210px] w-full px-1 md:absolute md:top-[16%] md:right-6 md:left-auto md:mt-0 md:h-[46%] md:w-[54%] md:px-0">
            <WorldFlight />
          </div>

        <div className="container flex flex-1 flex-col justify-end pb-10 pt-4 md:pb-20 md:pt-28">
          <div className="mb-6 hidden items-center gap-3 md:flex">
            <Image src={TEAM_LOGO_URL} alt="" width={44} height={44} priority className="h-11 w-11" />
            <CoordStamp code={copy.brand.origin.code} lat={copy.brand.origin.lat} lng={copy.brand.origin.lng} />
          </div>
          <p className="font-mono text-[11px] uppercase tracking-stamp text-signal">{copy.home.heroEyebrow}</p>
          <h1 className="mt-3 font-display font-black uppercase leading-[0.84] tracking-tight font-condensed">
            <span className="block text-[17vw] sm:text-[12vw] md:text-[8.5rem]">{copy.home.heroTitle[0]}</span>
            <span className="block text-[11.5vw] text-ivory/90 sm:text-[8vw] md:text-[5.75rem]">
              {copy.home.heroTitle[1].split(" ").map((w, i, arr) => (
                <span key={i} className={i === arr.length - 1 ? "text-signal" : undefined}>
                  {w}
                  {i < arr.length - 1 ? " " : ""}
                </span>
              ))}
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-mist/90 sm:max-w-2xl sm:text-xl">{copy.home.heroBody}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="xl">
              <Link href="/journeys">
                {copy.home.heroPrimary}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/players">{copy.home.heroSecondary}</Link>
            </Button>
          </div>
        </div>
        </div>

        {/* Departure-board ticker */}
        <div className="relative z-10 mb-[calc(4rem+env(safe-area-inset-bottom))] border-y border-line/10 bg-ink/70 backdrop-blur md:mb-0">
          <div className="flex overflow-hidden py-3" aria-hidden>
            {[0, 1].map((k) => (
              <ul key={k} className="flex shrink-0 animate-marquee items-center gap-8 pr-8 font-mono text-[11px] uppercase tracking-[0.22em] text-mist/70">
                {[...tickerItems, ...tickerItems].map((d, i) => (
                  <li key={`${k}-${i}`} className="flex items-center gap-8 whitespace-nowrap">
                    <span>
                      <span className="text-ivory">{d.split(" ")[0]}</span> {d.split(" ").slice(1).join(" ")}
                    </span>
                    <span className="text-signal">✈</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Proof ───────── */}
      {hasProof && (
        <section className="container py-14 md:py-20">
          <Reveal>
            <Eyebrow className="mb-5">{copy.home.proofEyebrow}</Eyebrow>
            <ProofStrip stats={proof} />
          </Reveal>
        </section>
      )}

      {/* ───────── Pathway ───────── */}
      <section className="container py-14 md:py-24">
        <Reveal>
          <SectionHeading eyebrow={copy.home.pathwayEyebrow} title={copy.home.pathwayTitle} body={copy.home.pathwayBody} href="/club" hrefLabel="How the cycle works" />
        </Reveal>
        <Reveal className="mt-10">
          <PathwaySteps />
        </Reveal>
      </section>

      {/* ───────── Where we are now ───────── */}
      {spotlight && (
        <section className="container py-10 md:py-16">
          <Reveal>
            <LiveJourneyCard journey={spotlight} latest={latest} />
          </Reveal>
        </section>
      )}

      {/* ───────── Journeys completed ───────── */}
      {completed.length > 0 && (
        <section className="py-14 md:py-20">
          <div className="container">
            <Reveal>
              <SectionHeading eyebrow={copy.home.journeysEyebrow} title={copy.home.journeysTitle} href="/journeys" />
            </Reveal>
          </div>
          <div className="container mt-8">
            <div className="snap-rail -mx-5 px-5 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
              {completed.slice(0, 6).map((j) => (
                <JourneyCard key={j.id} journey={j} className="w-[78vw] max-w-sm md:w-auto md:max-w-none" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────── Signed beyond Capital City ───────── */}
      {placements.length > 0 && (
        <section className="py-14 md:py-20">
          <div className="container">
            <Reveal>
              <SectionHeading eyebrow={copy.home.alumniEyebrow} title={copy.home.alumniTitle} href="/players?tab=abroad" />
            </Reveal>
          </div>
          <div className="container mt-8">
            <div className="snap-rail -mx-5 px-5">
              {placements.slice(0, 10).map((p) => (
                <PlacementCard key={p.id} placement={p} className="w-[64vw] max-w-[16rem]" />
              ))}
              {placements.length > 10 && <ViewAllTile href="/players?tab=abroad" label="All placements" />}
            </div>
          </div>
        </section>
      )}

      {/* ───────── Ready for the next step ───────── */}
      {prospects.length > 0 && (
        <section className="py-14 md:py-20">
          <div className="container">
            <Reveal>
              <SectionHeading
                eyebrow={ready.length ? copy.home.prospectsEyebrow : copy.players.tabs.current}
                title={copy.home.prospectsTitle}
                href="/players"
              />
            </Reveal>
          </div>
          <div className="container mt-8">
            <div className="snap-rail -mx-5 px-5">
              {prospects.slice(0, 10).map((p) => (
                <PlayerCard key={p.id} player={p} className="w-[46vw] max-w-[15rem]" />
              ))}
              <ViewAllTile href="/players" label="Full squad" />
            </div>
          </div>
        </section>
      )}

      {/* ───────── Media reel ───────── */}
      {reel.length > 0 && (
        <section className="py-14 md:py-20">
          <div className="container">
            <Reveal>
              <SectionHeading eyebrow={copy.home.mediaEyebrow} title={copy.home.mediaTitle} href="/media" />
            </Reveal>
          </div>
          <div className="container mt-8">
            <div className="snap-rail -mx-5 px-5 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
              {reel.map((m) => (
                <MediaCard key={m.id} asset={m} className="w-[72vw] max-w-xs md:w-auto md:max-w-none" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────── Voice ───────── */}
      <section className="container py-14 md:py-20">
        <Reveal>
          <figure className="relative mx-auto max-w-3xl text-center">
            <Quote className="mx-auto h-8 w-8 text-signal" aria-hidden />
            <blockquote className="mt-5 font-display text-3xl font-extrabold uppercase leading-[1] tracking-tight font-condensed text-balance sm:text-5xl">
              {copy.quotes[0].text}
            </blockquote>
            <figcaption className="mt-5 font-mono text-[11px] uppercase tracking-stamp text-mist/75">{copy.quotes[0].by}</figcaption>
          </figure>
        </Reveal>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="container py-10">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-signal p-6 text-white sm:p-10">
            <div aria-hidden className="absolute inset-0 bg-grid opacity-30" />
            <GrainOverlay opacity={0.1} />
            <div className="relative grid gap-6 md:grid-cols-[1.5fr_1fr] md:items-end">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-stamp text-white/80">{copy.home.ctaEyebrow}</p>
                <h2 className="mt-3 font-display text-4xl font-black uppercase leading-[0.9] tracking-tight font-condensed sm:text-6xl">
                  {copy.home.ctaTitle}
                </h2>
                <p className="mt-4 max-w-md text-white/85">{copy.home.ctaBody}</p>
              </div>
              <div className="flex md:justify-end">
                <Button asChild size="xl" variant="ghost-ivory" className="w-full sm:w-auto">
                  <Link href="/contact">
                    {copy.home.ctaAction}
                    <ArrowUpRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
