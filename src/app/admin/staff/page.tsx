"use client"

import Image from "next/image"
import { useState } from "react"
import { Building2, Loader2, Plus } from "lucide-react"
import type { StaffGroup, StaffMember } from "@/lib/data"
import { removeDoc, saveDoc, useCollection } from "@/lib/collections"
import { deleteFile, refreshPublic } from "@/lib/admin-client"
import { useToast } from "@/hooks/use-toast"
import { AdminPage, ConfirmDelete, EmptyState, Field, LoadingBlock, PublishBadge, UploadField } from "@/components/admin/ui"
import { EditorSheet, ListInput, NativeSelect, SwitchRow, numberOrUndefined } from "@/components/admin/form-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const GROUPS = [
  ["management", "Management"],
  ["coaching", "Coaching"],
  ["operations", "Operations"],
  ["medical", "Medical & performance"],
] as const

type Draft = Omit<StaffMember, "id"> & { id?: string }

const blank = (rank: number): Draft => ({ name: "", role: "", group: "coaching", rank, bio: "", quote: "", licences: [], published: false })

export default function StaffAdmin() {
  const { items, loading } = useCollection<StaffMember>("staff", (a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  const { toast } = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  const save = async () => {
    if (!draft?.name.trim() || !draft.role.trim()) {
      toast({ variant: "destructive", title: "Name and role are required." })
      return
    }
    setSaving(true)
    try {
      const { id, ...data } = draft
      await saveDoc("staff", id ?? null, data)
      await refreshPublic("staff")
      toast({ title: "Staff member saved" })
      setDraft(null)
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPage
      title="Management & staff"
      description="The people behind the pathway. Lower rank numbers appear first within each group."
      actions={
        <Button onClick={() => setDraft(blank(items.length + 1))}>
          <Plus /> Add person
        </Button>
      }
    >
      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState icon={Building2} title="No staff yet" body="Until you add staff here, the public Club page shows coaches from the legacy player list." />
      ) : (
        <div className="space-y-8">
          {GROUPS.map(([group, label]) => {
            const people = items.filter((s) => s.group === group)
            if (!people.length) return null
            return (
              <section key={group}>
                <h2 className="mb-3 font-mono text-[11px] uppercase tracking-stamp text-mist/70">{label}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {people.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-white/10 p-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-navy-deep">
                        {s.imageUrl && <Image src={s.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                      </div>
                      <button className="min-w-0 flex-1 text-left" onClick={() => setDraft({ ...blank(s.rank), ...s })}>
                        <p className="truncate font-semibold">{s.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{s.role}</p>
                      </button>
                      <PublishBadge published={s.published} />
                      <ConfirmDelete
                        what={s.name}
                        onConfirm={async () => {
                          await removeDoc("staff", s.id)
                          await deleteFile(s.imageUrl)
                          await refreshPublic("staff")
                        }}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <EditorSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit staff member" : "New staff member"}
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
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <UploadField value={draft.imageUrl} onChange={(url) => set("imageUrl", url ?? "")} prefix="staff" aspect="aspect-[4/5]" label="Portrait" />
              <div className="space-y-4">
                <Field label="Name">
                  <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Role" hint="e.g. Head Coach, Technical Director">
                  <Input value={draft.role} onChange={(e) => set("role", e.target.value)} />
                </Field>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Group">
                <NativeSelect<StaffGroup> value={draft.group} onChange={(v) => set("group", v)} options={GROUPS} />
              </Field>
              <Field label="Rank">
                <Input type="number" min={1} value={draft.rank} onChange={(e) => set("rank", numberOrUndefined(e.target.value) ?? 99)} />
              </Field>
            </div>
            <Field label="Bio">
              <Textarea rows={4} value={draft.bio ?? ""} onChange={(e) => set("bio", e.target.value)} />
            </Field>
            <Field label="Quote">
              <Textarea rows={2} value={draft.quote ?? ""} onChange={(e) => set("quote", e.target.value)} />
            </Field>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Licences & qualifications</span>
              <ListInput value={draft.licences ?? []} onChange={(v) => set("licences", v)} placeholder="e.g. CAF B Licence" />
            </div>
            <SwitchRow label="Published" checked={draft.published} onChange={(v) => set("published", v)} />
          </>
        )}
      </EditorSheet>
    </AdminPage>
  )
}
