import type { Metadata } from "next"
import { Suspense } from "react"
import { copy } from "@/lib/copy"
import { PAGE_SEO, pageGraph, pageMetadata } from "@/lib/seo"
import { getPlacements, getPlayers } from "@/lib/server/queries"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHero } from "@/components/site/page-hero"
import { PlayersBrowser } from "./players-browser"

export const revalidate = 60

export const metadata: Metadata = pageMetadata("players", "/players")

export default async function PlayersPage() {
  const [players, placements] = await Promise.all([getPlayers(), getPlacements()])
  return (
    <>
      <JsonLd data={pageGraph({ path: "/players", name: PAGE_SEO.players.title, description: PAGE_SEO.players.description, type: "CollectionPage" })} />
      <PageHero eyebrow={copy.players.eyebrow} title={copy.players.title} />
      <div className="container py-8 md:py-14">
        <Suspense>
          <PlayersBrowser players={players} placements={placements} />
        </Suspense>
      </div>
    </>
  )
}
