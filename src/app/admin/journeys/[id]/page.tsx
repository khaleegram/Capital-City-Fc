"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ExternalLink, Flag, Loader2, Radio, Save } from "lucide-react"
import type { Journey } from "@/lib/data"
import { removeDoc, saveDoc, useDocument } from "@/lib/collections"
import { refreshPublic } from "@/lib/admin-client"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { AdminPage, ConfirmDelete, LoadingBlock } from "@/components/admin/ui"
import { JourneyStatusBadge } from "@/components/site/cards"
import { Button } from "@/components/ui/button"
import type { JourneyDraft } from "./_components/types"
import { DetailsTab } from "./_components/details-tab"
import { RouteTab } from "./_components/route-tab"
import { ResultsTab } from "./_components/results-tab"
import { StoryTab } from "./_components/story-tab"
import { SquadTab } from "./_components/squad-tab"
import { DiaryTab } from "./_components/diary-tab"

const TABS = [
  ["details", "Details"],
  ["route", "Route"],
  ["results", "Results"],
  ["squad", "Squad"],
  ["story", "Story"],
  ["diary", "Diary"],
] as const
type Tab = (typeof TABS)[number][0]

const TAB_VIEW = { details: DetailsTab, route: RouteTab, results: ResultsTab, squad: SquadTab, story: StoryTab, diary: DiaryTab }

export default function JourneyEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, loading } = useDocument<Journey>("journeys", id)
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const tab = (TABS.find(([k]) => k === search.get("tab"))?.[0] ?? "details") as Tab
  const { toast } = useToast()
  const [draft, setDraft] = useState<JourneyDraft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data && !dirty) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data
      setDraft({
        ...rest,
        stops: rest.stops ?? [],
        matches: rest.matches ?? [],
        quotes: rest.quotes ?? [],
        playerIds: rest.playerIds ?? [],
        fixtureIds: rest.fixtureIds ?? [],
        squad: rest.squad ?? [],
        progress: rest.progress ?? 0,
      })
    }
  }, [data, dirty])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const set = (patch: Partial<JourneyDraft>) => {
    setDirty(true)
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }

  const persist = async (patch: Partial<JourneyDraft> = {}) => {
    if (!draft) return
    setSaving(true)
    try {
      await saveDoc("journeys", id, { ...draft, ...patch })
      await refreshPublic("journeys", "proof", "players")
      setDraft({ ...draft, ...patch })
      setDirty(false)
      toast({ title: "Journey saved" })
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  if (loading || (data && !draft)) return <LoadingBlock />
  if (!data || !draft) return <AdminPage title="Journey not found">{null}</AdminPage>

  const View = TAB_VIEW[tab]

  return (
    <AdminPage
      title={draft.title || "Untitled journey"}
      actions={
        <>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/admin/journeys">
              <ArrowLeft /> Journeys
            </Link>
          </Button>
          {data.published && (
            <Button variant="outline" asChild>
              <Link href={`/journeys/${data.slug}`} target="_blank">
                <ExternalLink /> View
              </Link>
            </Button>
          )}
          {draft.status === "upcoming" && (
            <Button variant="outline" disabled={saving} onClick={() => persist({ status: "live" })}>
              <Radio /> Go live
            </Button>
          )}
          {draft.status === "live" && (
            <Button variant="outline" disabled={saving} onClick={() => persist({ status: "completed", progress: 100 })}>
              <Flag /> Mark completed
            </Button>
          )}
          {tab !== "diary" && (
            <Button onClick={() => persist()} disabled={saving || !dirty}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} {dirty ? "Save changes" : "Saved"}
            </Button>
          )}
        </>
      }
    >
      <div className="mb-6 flex items-center gap-3">
        <JourneyStatusBadge status={draft.status} />
        {!draft.published && <span className="text-xs text-muted-foreground">Draft. Not visible publicly until published (Details tab).</span>}
      </div>
      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line/10 px-4 sm:mx-0 sm:px-0" aria-label="Journey sections">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => router.replace(`${pathname}?tab=${key}`, { scroll: false })}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "-mb-px h-11 shrink-0 border-b-2 px-4 text-sm font-semibold transition-colors",
              tab === key ? "border-signal text-ivory" : "border-transparent text-mist/70 hover:text-ivory"
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      <View journeyId={id} draft={draft} set={set} />

      {tab === "details" && (
        <div className="mt-10 flex items-center gap-2 border-t border-line/10 pt-6 text-sm text-muted-foreground">
          <ConfirmDelete
            label="Delete journey"
            what={draft.title}
            onConfirm={async () => {
              await removeDoc("journeys", id)
              await refreshPublic("journeys", "proof")
              router.push("/admin/journeys")
            }}
          />
          Delete this journey (diary entries stay in the database).
        </div>
      )}
    </AdminPage>
  )
}
