"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ArrowUpRight, Clapperboard, Inbox, PenLine, Plane, Plus, Route, Users } from "lucide-react"
import type { Achievement, Enquiry, Journey, MediaAsset, Placement, Player, TeamProfile } from "@/lib/data"
import { useCollection, useDocument } from "@/lib/collections"
import { applyProofOverride, computeProofStats } from "@/lib/proof"
import { copy } from "@/lib/copy"
import { byNewest, formatDate } from "@/lib/utils"
import { AdminPage } from "@/components/admin/ui"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LiveDot } from "@/components/brand/live-dot"
import { ProofStrip } from "@/components/site/proof-strip"

function Stat({ icon: Icon, label, value, href, note }: { icon: React.ElementType; label: string; value: number | string; href: string; note?: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-white/10 bg-card p-4 transition-colors hover:border-white/25">
      <div className="flex items-center justify-between text-mist/70">
        <span className="text-xs font-medium uppercase tracking-[0.14em]">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 font-display text-4xl font-black tabular-nums font-condensed">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </Link>
  )
}

export default function AdminDashboard() {
  const { items: journeys } = useCollection<Journey>("journeys")
  const { items: placements } = useCollection<Placement>("placements")
  const { items: media } = useCollection<MediaAsset>("mediaAssets")
  const { items: achievements } = useCollection<Achievement>("achievements")
  const { items: players } = useCollection<Player>("players")
  const { items: enquiries } = useCollection<Enquiry>("enquiries", byNewest)
  const { data: team } = useDocument<TeamProfile>("teamProfile", "main_profile")

  const live = journeys.find((j) => j.status === "live")
  const newEnquiries = enquiries.filter((e) => e.status === "new")
  const drafts = [...journeys, ...placements, ...media].filter((x) => !x.published).length

  const proof = useMemo(
    () =>
      applyProofOverride(
        computeProofStats(
          placements.filter((p) => p.published),
          journeys.filter((j) => j.published),
          achievements.filter((a) => a.published)
        ),
        team?.proofStats
      ),
    [placements, journeys, achievements, team?.proofStats]
  )

  return (
    <AdminPage
      title="Dashboard"
      description={copy.brand.masterLine}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/admin/media?new=1">
              <Clapperboard className="mr-2 h-4 w-4" />
              Upload media
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/placements?new=1">
              <Plus className="mr-2 h-4 w-4" />
              Record a signing
            </Link>
          </Button>
        </>
      }
    >
      {live ? (
        <Card className="mb-6 border-signal/40 bg-gradient-to-br from-signal/15 to-transparent">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <LiveDot label="Live journey" />
              <p className="mt-2 font-display text-2xl font-bold">{live.title}</p>
              <p className="text-sm text-muted-foreground">
                {live.progress}% complete · {live.stops.filter((s) => s.reached).length}/{live.stops.length} stops
              </p>
            </div>
            <Button asChild size="lg">
              <Link href={`/admin/journeys/${live.id}?tab=diary`}>
                <PenLine className="mr-2 h-4 w-4" />
                Post diary update
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Route} label="Journeys" value={journeys.length} href="/admin/journeys" note={live ? "1 live now" : "None live"} />
        <Stat icon={Plane} label="Placements" value={placements.length} href="/admin/placements" note={`${placements.filter((p) => p.verified).length} verified`} />
        <Stat icon={Users} label="Players" value={players.filter((p) => p.role === "Player").length} href="/admin/players" />
        <Stat icon={Inbox} label="New enquiries" value={newEnquiries.length} href="/admin/enquiries" note={`${enquiries.length} total`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Homepage proof strip</CardTitle>
            <Link href="/admin/settings" className="text-sm text-mist/70 hover:text-ivory">
              Edit
            </Link>
          </CardHeader>
          <CardContent>
            <ProofStrip stats={proof} />
            {drafts > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {drafts} draft record{drafts === 1 ? "" : "s"} (journeys, placements, media) aren&apos;t counted until published.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Latest enquiries</CardTitle>
            <Link href="/admin/enquiries" className="text-sm text-mist/70 hover:text-ivory">
              Inbox
            </Link>
          </CardHeader>
          <CardContent>
            {enquiries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No enquiries yet.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {enquiries.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{e.message}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant={e.status === "new" ? "live" : "outline"}>{copy.contact.roles[e.role] ?? e.role}</Badge>
                      <span className="font-mono text-[10px] text-mist/50">{formatDate(e.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/admin/journeys", label: "Plan a journey", body: "Stops, squad, fixtures and the live diary." },
          { href: "/admin/galleries", label: "Publish a photo story", body: "Bulk upload, caption and tag players." },
          { href: "/admin/staff", label: "Update management", body: "Staff profiles shown on the Club page." },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="group flex items-start justify-between rounded-2xl border border-white/10 p-4 hover:border-white/25">
            <div>
              <p className="font-semibold">{a.label}</p>
              <p className="text-sm text-muted-foreground">{a.body}</p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-signal" />
          </Link>
        ))}
      </div>
    </AdminPage>
  )
}
