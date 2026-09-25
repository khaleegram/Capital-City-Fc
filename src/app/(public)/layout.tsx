import type { Metadata } from "next"
import { getJourneys, getTeam } from "@/lib/server/queries"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { BottomTabBar } from "@/components/site/bottom-tab-bar"
import { MaintenanceGate } from "@/components/site/maintenance-gate"
import { JsonLd } from "@/components/seo/json-ld"
import { siteGraph } from "@/lib/seo"

/** Maintenance mode hides the whole public site behind a gate, so keep it out of the index. */
export async function generateMetadata(): Promise<Metadata> {
  const team = await getTeam()
  return team.maintenanceMode ? { robots: { index: false, follow: false } } : {}
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [team, journeys] = await Promise.all([getTeam(), getJourneys()])
  const live = journeys.find((j) => j.status === "live")

  const shell = (
    <div className="relative flex min-h-svh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-signal focus:px-4 focus:py-2">
        Skip to content
      </a>
      <SiteHeader live={live ? { slug: live.slug, title: live.title } : null} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter team={team} />
      <BottomTabBar />
      {/* Sitewide schema.org: the club (SportsTeam) and the website, linked by @id. */}
      <JsonLd data={siteGraph(team)} />
    </div>
  )

  return team.maintenanceMode ? <MaintenanceGate>{shell}</MaintenanceGate> : shell
}
