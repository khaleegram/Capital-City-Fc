import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRight, Route } from "lucide-react"
import type { LiveEvent } from "@/lib/data"
import { formatDate } from "@/lib/utils"
import { listDocs } from "@/lib/server/firestore"
import { getFixture, getJourneys, getMedia, getRecapForFixture, getTeam } from "@/lib/server/queries"
import { MediaCard } from "@/components/site/cards"
import { LiveMatch } from "./live-match"

export const revalidate = 60

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const f = await getFixture(id)
  if (!f) return { title: "Match not found" }
  return { title: `vs ${f.opponent}`, description: `${f.competition} · ${f.venue}` }
}

export default async function MatchPage({ params }: Props) {
  const { id } = await params
  const fixture = await getFixture(id)
  if (!fixture) notFound()

  const [team, recap, journeys, media, events] = await Promise.all([
    getTeam(),
    getRecapForFixture(id),
    getJourneys(),
    getMedia(),
    listDocs<Omit<LiveEvent, "timestamp"> & { timestamp?: string }>(`fixtures/${id}/liveEvents`),
  ])
  const journey = journeys.find((j) => j.fixtureIds.includes(id))
  const matchMedia = media.filter((m) => m.fixtureId === id)
  const sortedEvents = events.sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")))

  return (
    <article className="pt-20 md:pt-28">
      <div className="container max-w-4xl space-y-10">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-stamp text-signal">{fixture.competition}</p>
          <p className="mt-1 text-sm text-mist/75">
            {formatDate(fixture.date, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {fixture.venue}
          </p>
          {journey && (
            <Link href={`/journeys/${journey.slug}`} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-line/15 px-4 text-sm font-semibold hover:border-line/40">
              <Route className="h-4 w-4 text-signal" /> {journey.title}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
        </header>

        <LiveMatch
          fixtureId={fixture.id}
          teamName={team.name}
          opponent={fixture.opponent}
          initial={{
            status: fixture.status,
            home: fixture.score?.home ?? 0,
            away: fixture.score?.away ?? 0,
            kickoffTime: fixture.kickoffTime,
            firstHalfEndTime: fixture.firstHalfEndTime,
            secondHalfStartTime: fixture.secondHalfStartTime,
          }}
          initialEvents={sortedEvents}
        />

        {recap && (
          <section className="space-y-5">
            <p className="font-mono text-[11px] uppercase tracking-stamp text-mist/70">Match report</p>
            <h2 className="font-display text-4xl font-black uppercase leading-[0.9] font-condensed sm:text-5xl">{recap.headline}</h2>
            {recap.shortSummary && <p className="text-lg text-mist/90">{recap.shortSummary}</p>}
            {recap.audioUrl && <audio controls preload="none" src={recap.audioUrl} className="w-full" />}
            <div className="whitespace-pre-line leading-relaxed text-mist/85">{recap.fullRecap}</div>
            {recap.structuredData?.goalScorers?.length > 0 && (
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-mist/70">Scorers: {recap.structuredData.goalScorers.join(", ")}</p>
            )}
          </section>
        )}

        {fixture.notes && !recap && <p className="text-mist/85">{fixture.notes}</p>}

        {matchMedia.length > 0 && (
          <section>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-stamp text-mist/70">Footage</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {matchMedia.map((m) => (
                <MediaCard key={m.id} asset={m} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  )
}
