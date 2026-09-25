"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BadgeCheck, Loader2, Plane, Plus } from "lucide-react"
import type { Placement, PlacementType, Player } from "@/lib/data"
import { removeDoc, saveDoc, useCollection } from "@/lib/collections"
import { refreshPublic } from "@/lib/admin-client"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { AdminPage, ConfirmDelete, EmptyState, Field, LoadingBlock, PublishBadge, UploadField } from "@/components/admin/ui"
import { EditorSheet, NativeSelect, SwitchRow, useSquad } from "@/components/admin/form-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const TYPES = [
  ["signed", "Signed"],
  ["loan", "Loan"],
  ["trial", "Trial"],
] as const

type Draft = Omit<Placement, "id" | "createdAt"> & { id?: string }

const blank = (): Draft => ({
  playerId: null,
  playerName: "",
  club: "",
  country: "",
  league: "",
  type: "signed",
  date: "",
  verified: false,
  sourceUrl: "",
  published: false,
})

export default function PlacementsAdmin() {
  const { items, loading } = useCollection<Placement>("placements", (a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
  const { players } = useSquad()
  const params = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (params.get("new") === "1") {
      setDraft(blank())
      router.replace("/admin/placements")
    }
  }, [params, router])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  const pickPlayer = (id: string) => {
    const p = players.find((x) => x.id === id) as Player | undefined
    setDraft((d) =>
      d
        ? {
            ...d,
            playerId: id || null,
            playerName: p?.name ?? d.playerName,
            position: p?.position ?? d.position,
            playerImageUrl: p?.imageUrl || d.playerImageUrl,
          }
        : d
    )
  }

  const save = async () => {
    if (!draft) return
    if (!draft.playerName.trim() || !draft.club.trim() || !draft.country.trim()) {
      toast({ variant: "destructive", title: "Player, club and country are required." })
      return
    }
    setSaving(true)
    try {
      const { id, ...data } = draft
      await saveDoc("placements", id ?? null, data)
      await refreshPublic("placements", "proof")
      toast({ title: "Placement saved" })
      setDraft(null)
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPage
      title="Placements"
      description="Players who have signed, gone on loan or trialled abroad. Only verified, published placements count toward the public proof numbers."
      actions={
        <Button onClick={() => setDraft(blank())}>
          <Plus /> Add placement
        </Button>
      }
    >
      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState icon={Plane} title="No placements yet" body="Add the first player signed abroad." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line/10">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-4 border-b border-line/5 p-3 last:border-0">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-navy-deep">
                {p.playerImageUrl && <Image src={p.playerImageUrl} alt="" fill sizes="48px" className="object-cover" />}
              </div>
              <button className="min-w-0 flex-1 text-left" onClick={() => setDraft({ ...blank(), ...p })}>
                <p className="flex items-center gap-2 font-semibold">
                  {p.playerName}
                  {p.verified && <BadgeCheck className="h-4 w-4 text-signal" aria-label="Verified" />}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {p.club} · {p.country}
                  {p.league ? ` · ${p.league}` : ""} {p.date ? ` · ${formatDate(p.date, { month: "short", year: "numeric" })}` : ""}
                </p>
              </button>
              <Badge variant="outline" className="hidden capitalize sm:inline-flex">
                {p.type}
              </Badge>
              <PublishBadge published={p.published} />
              <ConfirmDelete
                what="this placement"
                onConfirm={async () => {
                  await removeDoc("placements", p.id)
                  await refreshPublic("placements", "proof")
                }}
              />
            </div>
          ))}
        </div>
      )}

      <EditorSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit placement" : "New placement"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Save
            </Button>
          </>
        }
      >
        {draft && (
          <>
            <Field label="Link to a squad player" hint="Optional. Picks up their photo and position.">
              <NativeSelect value={draft.playerId ?? ""} onChange={pickPlayer} placeholder="Not in squad list" options={players.map((p) => [p.id, p.name] as const)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Player name">
                <Input value={draft.playerName} onChange={(e) => set("playerName", e.target.value)} />
              </Field>
              <Field label="Position">
                <Input value={draft.position ?? ""} onChange={(e) => set("position", e.target.value)} />
              </Field>
              <Field label="Club">
                <Input value={draft.club} onChange={(e) => set("club", e.target.value)} />
              </Field>
              <Field label="Country">
                <Input value={draft.country} onChange={(e) => set("country", e.target.value)} />
              </Field>
              <Field label="League">
                <Input value={draft.league ?? ""} onChange={(e) => set("league", e.target.value)} />
              </Field>
              <Field label="Type">
                <NativeSelect<PlacementType> value={draft.type} onChange={(v) => set("type", v)} options={TYPES} />
              </Field>
              <Field label="Date">
                <Input type="date" value={draft.date ?? ""} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label="Source link" hint="Club announcement or news article.">
                <Input type="url" value={draft.sourceUrl ?? ""} onChange={(e) => set("sourceUrl", e.target.value)} />
              </Field>
            </div>
            <Field label="Photo">
              <UploadField value={draft.playerImageUrl} onChange={(url) => set("playerImageUrl", url ?? "")} prefix="placements" aspect="aspect-[4/5] max-w-[200px]" />
            </Field>
            <SwitchRow label="Verified" hint="Confirmed by the club or an official source." checked={draft.verified} onChange={(v) => set("verified", v)} />
            <SwitchRow label="Published" hint="Show on the public site." checked={draft.published} onChange={(v) => set("published", v)} />
          </>
        )}
      </EditorSheet>
    </AdminPage>
  )
}
