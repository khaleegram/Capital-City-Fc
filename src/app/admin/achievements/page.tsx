"use client"

import { useState } from "react"
import { Award, Loader2, Plus } from "lucide-react"
import type { Achievement, Journey } from "@/lib/data"
import { removeDoc, saveDoc, useCollection } from "@/lib/collections"
import { refreshPublic } from "@/lib/admin-client"
import { useToast } from "@/hooks/use-toast"
import { AdminPage, ConfirmDelete, EmptyState, Field, LoadingBlock, PublishBadge } from "@/components/admin/ui"
import { EditorSheet, NativeSelect, SwitchRow, numberOrUndefined } from "@/components/admin/form-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

const KINDS = [
  ["trophy", "Trophy"],
  ["unbeaten", "Unbeaten run"],
  ["milestone", "Milestone"],
] as const

type Draft = Omit<Achievement, "id"> & { id?: string }

const blank = (): Draft => ({ title: "", year: new Date().getFullYear(), competition: "", detail: "", kind: "trophy", journeyId: null, published: false })

export default function AchievementsAdmin() {
  const { items, loading } = useCollection<Achievement>("achievements", (a, b) => b.year - a.year)
  const { items: journeys } = useCollection<Journey>("journeys")
  const { toast } = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  const save = async () => {
    if (!draft?.title.trim()) {
      toast({ variant: "destructive", title: "Title is required." })
      return
    }
    setSaving(true)
    try {
      const { id, ...data } = draft
      await saveDoc("achievements", id ?? null, data)
      await refreshPublic("achievements", "proof")
      toast({ title: "Achievement saved" })
      setDraft(null)
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPage
      title="Achievements"
      description="Trophies, unbeaten runs and milestones. Published unbeaten runs feed the public proof numbers."
      actions={
        <Button onClick={() => setDraft(blank())}>
          <Plus /> Add achievement
        </Button>
      }
    >
      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState icon={Award} title="No achievements yet" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line/10">
          {items.map((a) => (
            <div key={a.id} className="flex items-center gap-4 border-b border-line/5 p-3 last:border-0">
              <span className="w-14 font-mono text-sm text-mist/70">{a.year}</span>
              <button className="min-w-0 flex-1 text-left" onClick={() => setDraft({ ...blank(), ...a })}>
                <p className="truncate font-semibold">{a.title}</p>
                {a.competition && <p className="truncate text-sm text-muted-foreground">{a.competition}</p>}
              </button>
              <Badge variant="outline" className="hidden sm:inline-flex">
                {KINDS.find(([k]) => k === a.kind)?.[1]}
              </Badge>
              <PublishBadge published={a.published} />
              <ConfirmDelete
                what={a.title}
                onConfirm={async () => {
                  await removeDoc("achievements", a.id)
                  await refreshPublic("achievements", "proof")
                }}
              />
            </div>
          ))}
        </div>
      )}

      <EditorSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit achievement" : "New achievement"}
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
            <Field label="Title">
              <Input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Abuja Preseason Champions, unbeaten" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Year">
                <Input type="number" value={draft.year} onChange={(e) => set("year", numberOrUndefined(e.target.value) ?? new Date().getFullYear())} />
              </Field>
              <Field label="Kind">
                <NativeSelect value={draft.kind} onChange={(v) => set("kind", v)} options={KINDS} />
              </Field>
            </div>
            <Field label="Competition">
              <Input value={draft.competition ?? ""} onChange={(e) => set("competition", e.target.value)} />
            </Field>
            <Field label="Linked journey">
              <NativeSelect value={draft.journeyId ?? ""} onChange={(v) => set("journeyId", v || null)} placeholder="None" options={journeys.map((j) => [j.id, j.title] as const)} />
            </Field>
            <Field label="Detail">
              <Textarea rows={3} value={draft.detail ?? ""} onChange={(e) => set("detail", e.target.value)} placeholder="P6 W5 D1 L0 · 17 scored, 3 conceded" />
            </Field>
            <SwitchRow label="Published" checked={draft.published} onChange={(v) => set("published", v)} />
          </>
        )}
      </EditorSheet>
    </AdminPage>
  )
}
