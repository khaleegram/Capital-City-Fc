import type { Metadata } from "next"
import { copy } from "@/lib/copy"
import { PAGE_SEO, pageGraph, pageMetadata } from "@/lib/seo"
import { getFixtures } from "@/lib/server/queries"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHero } from "@/components/site/page-hero"
import { FixtureRow } from "@/components/site/fixture-row"
import { EmptyNote } from "@/components/site/cards"

export const revalidate = 60

export const metadata: Metadata = pageMetadata("fixtures", "/fixtures")

/** Section rule with a count: the rule carries the eye across, the count saves the counting. */
function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-stamp text-mist/70">
      <span>{label}</span>
      <span aria-hidden className="h-px flex-1 bg-line/10" />
      <span className="tabular-nums text-mist/45">{count}</span>
    </h2>
  )
}

export default async function FixturesPage() {
  const fixtures = await getFixtures()
  const live = fixtures.filter((f) => f.status === "LIVE" || f.status === "HT")
  const upcoming = fixtures.filter((f) => f.status === "UPCOMING")
  const results = fixtures.filter((f) => f.status === "FT").reverse()

  return (
    <>
      <JsonLd data={pageGraph({ path: "/fixtures", name: PAGE_SEO.fixtures.title, description: PAGE_SEO.fixtures.description, type: "CollectionPage" })} />
      <PageHero eyebrow={copy.fixtures.eyebrow} title={copy.fixtures.title} />
      {/*
        One column, not two. Each card is now a full-width docket with a date rail and a
        centred scoreboard, and at half width the opponent names had nowhere to go but the
        truncator — which is what the two-column grid was doing to them.
      */}
      <div className="container max-w-4xl py-8 md:py-14">
        {fixtures.length === 0 && <EmptyNote>{copy.fixtures.empty}</EmptyNote>}

        {(live.length > 0 || upcoming.length > 0) && (
          <section className="mb-12">
            <SectionLabel label={copy.fixtures.upcoming} count={live.length + upcoming.length} />
            <div className="space-y-2.5">
              {[...live, ...upcoming].map((f) => (
                <FixtureRow key={f.id} fixture={f} />
              ))}
            </div>
          </section>
        )}

        {results.length > 0 && (
          <section>
            <SectionLabel label={copy.fixtures.results} count={results.length} />
            <div className="space-y-2.5">
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
