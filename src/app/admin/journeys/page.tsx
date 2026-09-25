"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, NotebookPen, Plus, Route } from "lucide-react"
import type { Journey, JourneyKind } from "@/lib/data"
import { saveDoc, useCollection } from "@/lib/collections"
import { slugify } from "@/lib/admin-client"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { AdminPage, EmptyState, Field, LoadingBlock, PublishBadge } from "@/components/admin/ui"
import { EditorSheet, NativeSelect } from "@/components/admin/form-kit"
import { JourneyStatusBadge } from "@/components/site/cards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const RANK = { live: 0, upcoming: 1, completed: 2 } as const

export default function JourneysAdmin() {
  const { items, loading } = useCollection<Journey>("journeys", (a, b) => RANK[a.status] - RANK[b.status] || (b.startDate ?? "").localeCompare(a.startDate ?? ""))
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<JourneyKind>("international")
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      const base = slugify(title)
      const slug = items.some((j) => j.slug === base) ? `${base}-${Date.now().toString(36).slice(-4)}` : base
      const id = await saveDoc("journeys", null, {
        slug,
        title: title.trim(),
        kind,
        status: "upcoming",
        summary: "",
        stops: [],
        progress: 0,
        playerIds: [],
        fixtureIds: [],
        matches: [],
        quotes: [],
        published: false,
      })
      router.push(`/admin/journeys/${id}`)
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't create journey", description: (err as Error).message })
      setBusy(false)
    }
  }

  return (
    <AdminPage
      title="Journeys"
      description="Tours abroad and domestic campaigns. Go live while you travel and post to the diary from your phone."
      actions={
        <Button onClick={() => setOpen(true)}>
          <Plus /> New journey
        </Button>
      }
    >
      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState icon={Route} title="No journeys yet" body="Create the Gothia Cup, Dana Cup or the Abuja preseason run." />
      ) : (
        <div className="space-y-3">
          {items.map((j) => (
            <div key={j.id} className="flex items-center gap-4 rounded-2xl border border-white/10 p-3">
              <Link href={`/admin/journeys/${j.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-navy-deep">
                  {j.coverImageUrl && <Image src={j.coverImageUrl} alt="" fill sizes="96px" className="object-cover" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{j.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {j.kind === "international" ? "International" : "Domestic"}
                    {j.startDate ? ` · ${formatDate(j.startDate)}` : ""} · {j.progress ?? 0}%
                  </p>
                </div>
              </Link>
              <JourneyStatusBadge status={j.status} />
              <PublishBadge published={j.published} />
              {j.status === "live" && (
                <Button size="sm" asChild>
                  <Link href={`/admin/journeys/${j.id}?tab=diary`}>
                    <NotebookPen /> Post
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <EditorSheet
        open={open}
        onOpenChange={setOpen}
        title="New journey"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy || !title.trim()}>
              {busy && <Loader2 className="animate-spin" />} Create
            </Button>
          </>
        }
      >
        <Field label="Title">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gothia Cup 2026" />
        </Field>
        <Field label="Kind">
          <NativeSelect<JourneyKind>
            value={kind}
            onChange={setKind}
            options={[
              ["international", "International tour"],
              ["domestic", "Domestic campaign"],
            ]}
          />
        </Field>
      </EditorSheet>
    </AdminPage>
  )
}
