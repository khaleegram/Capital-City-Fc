import type { Metadata } from "next"
import { copy } from "@/lib/copy"
import { getFixtures } from "@/lib/server/queries"
import { PageHero } from "@/components/site/page-hero"
import { FixtureRow } from "@/components/site/fixture-row"
import { EmptyNote } from "@/components/site/cards"

export const revalidate = 60

export const metadata: Metadata = { title: copy.fixtures.eyebrow }

export default async function FixturesPage() {
  const fixtures = await getFixtures()
  const live = fixtures.filter((f) => f.status === "LIVE" || f.status === "HT")
  const upcoming = fixtures.filter((f) => f.status === "UPCOMING")
  const results = fixtures.filter((f) => f.status === "FT").reverse()

  return (
    <>
      <PageHero eyebrow={copy.fixtures.eyebrow} title={copy.fixtures.title} />
      <div className="container grid gap-12 py-8 md:py-14 lg:grid-cols-2">
        {fixtures.length === 0 && <EmptyNote>{copy.fixtures.empty}</EmptyNote>}
        {(live.length > 0 || upcoming.length > 0) && (
          <section>
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-stamp text-mist/70">{copy.fixtures.upcoming}</h2>
            <div className="space-y-2">
              {[...live, ...upcoming].map((f) => (
                <FixtureRow key={f.id} fixture={f} />
              ))}
            </div>
          </section>
        )}
        {results.length > 0 && (
          <section>
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-stamp text-mist/70">{copy.fixtures.results}</h2>
            <div className="space-y-2">
              {results.map((f) => (
                <FixtureRow key={f.id} fixture={f} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
