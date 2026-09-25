import type { Metadata } from "next"
import { copy } from "@/lib/copy"
import { getJourneyEntries, getJourneys } from "@/lib/server/queries"
import { PageHero } from "@/components/site/page-hero"
import { LiveJourneyCard } from "@/components/site/live-journey-card"
import { EmptyNote } from "@/components/site/cards"
import { Reveal } from "@/components/brand/reveal"
import { JourneyGrid } from "./journey-grid"

export const revalidate = 60

export const metadata: Metadata = {
  title: copy.journeys.eyebrow,
  description: copy.journeys.body,
}

export default async function JourneysPage() {
  const journeys = await getJourneys()
  const spotlight = journeys.find((j) => j.status === "live") ?? journeys.find((j) => j.status === "upcoming")
  const latest = spotlight?.status === "live" ? (await getJourneyEntries(spotlight.id))[0] : null
  const rest = journeys.filter((j) => j.id !== spotlight?.id)

  return (
    <>
      <PageHero eyebrow={copy.journeys.eyebrow} title={copy.journeys.title} body={copy.journeys.body} />
      <div className="container space-y-12 py-10 md:py-16">
        {spotlight && (
          <Reveal>
            <LiveJourneyCard journey={spotlight} latest={latest} />
          </Reveal>
        )}
        {rest.length > 0 ? <JourneyGrid journeys={rest} /> : !spotlight && <EmptyNote>{copy.journeys.empty}</EmptyNote>}
      </div>
    </>
  )
}
