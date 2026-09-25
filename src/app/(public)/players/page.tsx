import type { Metadata } from "next"
import { Suspense } from "react"
import { copy } from "@/lib/copy"
import { getPlacements, getPlayers } from "@/lib/server/queries"
import { PageHero } from "@/components/site/page-hero"
import { PlayersBrowser } from "./players-browser"

export const revalidate = 60

export const metadata: Metadata = {
  title: copy.players.eyebrow,
  description: copy.players.title,
}

export default async function PlayersPage() {
  const [players, placements] = await Promise.all([getPlayers(), getPlacements()])
  return (
    <>
      <PageHero eyebrow={copy.players.eyebrow} title={copy.players.title} />
      <div className="container py-8 md:py-14">
        <Suspense>
          <PlayersBrowser players={players} placements={placements} />
        </Suspense>
      </div>
    </>
  )
}
