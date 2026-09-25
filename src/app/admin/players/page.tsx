"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { Loader2, Plus, Search, UserPlus, Users } from "lucide-react"
import type { Player, SquadStatus } from "@/lib/data"
import { removeDoc, saveDoc, useCollection } from "@/lib/collections"
import { deleteFile, refreshPublic } from "@/lib/admin-client"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { AdminPage, ConfirmDelete, EmptyState, Field, LoadingBlock, PublishBadge, UploadField } from "@/components/admin/ui"
import { EditorSheet, ListInput, NativeSelect, SwitchRow, numberOrUndefined } from "@/components/admin/form-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const POSITIONS = [
  ["Goalkeeper", "Goalkeeper"],
  ["Defender", "Defender"],
  ["Midfielder", "Midfielder"],
  ["Forward", "Forward"],
  ["Coach", "Coach"],
  ["Staff", "Staff"],
] as const

const ROLES = [
  ["Player", "Player"],
  ["Coach", "Coach"],
  ["Staff", "Staff"],
] as const

const STATUSES = [
  ["Active", "Active"],
  ["Injured", "Injured"],
  ["On Loan", "On loan"],
  ["Former Player", "Former player"],
] as const

const FEET = [
  ["", "Not set"],
  ["Left", "Left"],
  ["Right", "Right"],
  ["Both", "Both"],
] as const

type Draft = {
  id?: string
  name: string
  nickname: string
  position: Player["position"]
  role: Player["role"]
  jerseyNumber: number
  imageUrl: string
  bio: string
  stats: { appearances: number; goals: number; assists: number }
  status: NonNullable<Player["status"]>
  strongFoot: NonNullable<Player["strongFoot"]> | ""
  careerHighlights: string[]
  squadStatus: SquadStatus
  cohort: string
  dob: string
  heightCm?: number
  nationality: string
  currentClub: string
  strengths: string[]
  readyForNextStep: boolean
  published: boolean
  // Captured when the player submits the public /join form.
  photoLink: string
  videoLinks: string[]
  contact: { email: string; phone: string }
  source?: Player["source"]
}

const blank = (): Draft => ({
  name: "",
  nickname: "",
  position: "Forward",
  role: "Player",
  jerseyNumber: 0,
  imageUrl: "",
  bio: "",
  stats: { appearances: 0, goals: 0, assists: 0 },
  status: "Active",
  strongFoot: "",
  careerHighlights: [],
  squadStatus: "current",
  cohort: "",
  dob: "",
  heightCm: undefined,
  nationality: "Nigeria",
  currentClub: "",
  strengths: [],
  readyForNextStep: false,
  published: true,
  photoLink: "",
  videoLinks: [],
  contact: { email: "", phone: "" },
})

function fromPlayer(p: Player): Draft {
  return {
    id: p.id,
    name: p.name ?? "",
    nickname: p.nickname ?? "",
    position: p.position ?? "Forward",
    role: p.role ?? "Player",
    jerseyNumber: p.jerseyNumber ?? 0,
    imageUrl: p.imageUrl ?? "",
    bio: p.bio ?? "",
    stats: {
      appearances: p.stats?.appearances ?? 0,
      goals: p.stats?.goals ?? 0,
      assists: p.stats?.assists ?? 0,
    },
    status: p.status ?? "Active",
    strongFoot: p.strongFoot ?? "",
    careerHighlights: p.careerHighlights ?? [],
    squadStatus: p.squadStatus ?? (p.status === "Former Player" ? "alumni" : "current"),
    cohort: p.cohort ?? "",
    dob: p.dob ?? "",
    heightCm: p.heightCm,
    nationality: p.nationality ?? "Nigeria",
    currentClub: p.currentClub ?? "",
    strengths: p.strengths ?? [],
    readyForNextStep: !!p.readyForNextStep,
    published: p.published !== false,
    photoLink: p.photoLink ?? "",
    videoLinks: p.videoLinks ?? [],
    contact: { email: p.contact?.email ?? "", phone: p.contact?.phone ?? "" },
    source: p.source,
  }
}

export default function PlayersAdmin() {
  const { items, loading } = useCollection<Player>("players", (a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99))
  const { toast } = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState("")
  const [draftsOnly, setDraftsOnly] = useState(false)

  const awaitingReview = items.filter((p) => p.published === false)

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const rows = draftsOnly ? items.filter((p) => p.published === false) : items
    if (!needle) return rows
    return rows.filter(
      (p) => p.name.toLowerCase().includes(needle) || String(p.jerseyNumber) === needle || (p.nickname ?? "").toLowerCase().includes(needle)
    )
  }, [items, q, draftsOnly])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  const save = async () => {
    if (!draft?.name.trim()) {
      toast({ variant: "destructive", title: "Name is required." })
      return
    }
    setSaving(true)
    try {
      const { id, strongFoot, photoLink, videoLinks, contact, source, ...rest } = draft
      const email = contact.email.trim()
      const phone = contact.phone.trim()
      await saveDoc("players", id ?? null, {
        ...rest,
        name: rest.name.trim(),
        nickname: rest.nickname.trim() || undefined,
        imageUrl: rest.imageUrl || "",
        bio: rest.bio.trim(),
        strongFoot: strongFoot || undefined,
        cohort: rest.cohort.trim() || undefined,
        dob: rest.dob || undefined,
        nationality: rest.nationality.trim() || undefined,
        currentClub: rest.currentClub.trim() || undefined,
        photoLink: photoLink.trim() || undefined,
        videoLinks: videoLinks.length ? videoLinks : undefined,
        contact: email || phone ? { email: email || undefined, phone: phone || undefined } : undefined,
        source,
      })
      await refreshPublic("players", "journeys")
      toast({ title: draft.id ? "Player saved" : "Player added" })
      setDraft(null)
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPage
      title="Players"
      description="Edit profiles, add photos, and keep the public squad current. Photo is optional."
      actions={
        <Button onClick={() => setDraft(blank())}>
          <Plus /> Add player
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist/60" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, nickname or number" className="pl-9" />
        </div>
        <button
          type="button"
          onClick={() => setDraftsOnly((v) => !v)}
          aria-pressed={draftsOnly}
          className={cn(
            "h-11 rounded-xl border px-4 text-xs font-semibold",
            draftsOnly ? "border-ivory bg-ivory text-ink" : "border-white/15 text-mist/80 hover:border-white/40"
          )}
        >
          Awaiting review{awaitingReview.length ? ` (${awaitingReview.length})` : ""}
        </button>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q || draftsOnly ? "No match" : "No players yet"}
          body={
            draftsOnly
              ? "Self sign-ups from the /join page land here until you publish them."
              : q
                ? "Try another name or number."
                : "Add the first player to the public squad."
          }
          action={
            !q && !draftsOnly ? (
              <Button onClick={() => setDraft(blank())}>
                <Plus /> Add player
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-white/10 p-3">
              <button type="button" onClick={() => setDraft(fromPlayer(p))} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-navy-deep">
                <Image src={p.imageUrl || TEAM_LOGO_URL} alt="" fill sizes="64px" className={p.imageUrl ? "object-cover object-top" : "object-contain p-2 opacity-40"} />
              </button>
              <button type="button" onClick={() => setDraft(fromPlayer(p))} className="min-w-0 flex-1 text-left">
                <p className="truncate font-semibold">
                  <span className="mr-1.5 font-mono text-xs text-mist/60">#{p.jerseyNumber}</span>
                  {p.name}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {p.position}
                  {p.nickname && ` · ${p.nickname}`}
                  {p.source === "signup" && " · self sign-up"}
                  {p.readyForNextStep && " · Ready"}
                </p>
              </button>
              <PublishBadge published={p.published !== false} />
              <ConfirmDelete
                what={p.name}
                onConfirm={async () => {
                  await removeDoc("players", p.id)
                  await deleteFile(p.imageUrl)
                  await refreshPublic("players", "journeys")
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <EditorSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit player" : "New player"}
        description="Name, photo, pathway notes and record. Save writes straight to the public profile."
        className="sm:max-w-2xl"
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
              <div className="space-y-2">
                <UploadField value={draft.imageUrl || null} onChange={(url) => set("imageUrl", url ?? "")} prefix="players" aspect="aspect-[3/4]" label="Add photo" />
                <Field label="Or paste photo URL" hint="Use this if the file upload is not set up yet.">
                  <Input
                    value={draft.imageUrl}
                    onChange={(e) => set("imageUrl", e.target.value)}
                    placeholder="https://"
                  />
                </Field>
              </div>
              <div className="space-y-4">
                <Field label="Full name">
                  <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Nickname">
                  <Input value={draft.nickname} onChange={(e) => set("nickname", e.target.value)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Role">
                    <NativeSelect<Player["role"]> value={draft.role} onChange={(v) => set("role", v)} options={ROLES} />
                  </Field>
                  <Field label="Status">
                    <NativeSelect<NonNullable<Player["status"]>> value={draft.status} onChange={(v) => set("status", v)} options={STATUSES} />
                  </Field>
                </div>
              </div>
            </div>

            {draft.source === "signup" && (
              <div className="space-y-3 rounded-2xl border border-signal/30 bg-signal/5 p-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-signal" />
                  <p className="text-sm font-semibold">Submitted by the player from /join</p>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Add the official photo, confirm the squad number, then switch on &ldquo;Show on public site&rdquo; to publish.
                </p>
                <dl className="space-y-2 text-sm">
                  {draft.photoLink && (
                    <div className="flex flex-wrap items-baseline gap-2">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Photo link</dt>
                      <dd>
                        <a href={draft.photoLink} target="_blank" rel="noreferrer" className="break-all text-signal-soft underline">
                          {draft.photoLink}
                        </a>
                      </dd>
                    </div>
                  )}
                  {draft.videoLinks.length > 0 && (
                    <div className="flex flex-wrap items-baseline gap-2">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Footage</dt>
                      <dd className="min-w-0 space-y-1">
                        {draft.videoLinks.map((link) => (
                          <a key={link} href={link} target="_blank" rel="noreferrer" className="block break-all text-signal-soft underline">
                            {link}
                          </a>
                        ))}
                      </dd>
                    </div>
                  )}
                  {(draft.contact.email || draft.contact.phone) && (
                    <div className="flex flex-wrap items-baseline gap-2">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Contact</dt>
                      <dd>{[draft.contact.email, draft.contact.phone].filter(Boolean).join(" · ")}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Shirt number">
                <Input type="number" min={0} value={draft.jerseyNumber} onChange={(e) => set("jerseyNumber", numberOrUndefined(e.target.value) ?? 0)} />
              </Field>
              <Field label="Position">
                <NativeSelect<Player["position"]> value={draft.position} onChange={(v) => set("position", v)} options={POSITIONS} />
              </Field>
              <Field label="Preferred foot">
                <NativeSelect<NonNullable<Player["strongFoot"]> | ""> value={draft.strongFoot} onChange={(v) => set("strongFoot", v)} options={FEET} />
              </Field>
            </div>

            <Field label="Bio">
              <Textarea rows={5} value={draft.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Who they are, how they play, where they are going." />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Squad">
                <NativeSelect<SquadStatus>
                  value={draft.squadStatus}
                  onChange={(v) => set("squadStatus", v)}
                  options={[
                    ["current", "Current squad"],
                    ["alumni", "Alumni"],
                  ]}
                />
              </Field>
              <Field label="Cohort">
                <Input value={draft.cohort} onChange={(e) => set("cohort", e.target.value)} placeholder="2026" />
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={draft.dob} onChange={(e) => set("dob", e.target.value)} />
              </Field>
              <Field label="Height (cm)">
                <Input
                  type="number"
                  min={100}
                  max={230}
                  value={draft.heightCm ?? ""}
                  onChange={(e) => set("heightCm", numberOrUndefined(e.target.value))}
                />
              </Field>
              <Field label="Nationality">
                <Input value={draft.nationality} onChange={(e) => set("nationality", e.target.value)} />
              </Field>
              <Field label="Current club">
                <Input value={draft.currentClub} onChange={(e) => set("currentClub", e.target.value)} placeholder="If signed or on trial abroad" />
              </Field>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Strengths</span>
              <ListInput value={draft.strengths} onChange={(v) => set("strengths", v)} placeholder="e.g. Aerial duels" />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Career highlights</span>
              <ListInput value={draft.careerHighlights} onChange={(v) => set("careerHighlights", v)} placeholder="e.g. Gothia Cup 2026" />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Appearances">
                <Input type="number" min={0} value={draft.stats.appearances} onChange={(e) => set("stats", { ...draft.stats, appearances: numberOrUndefined(e.target.value) ?? 0 })} />
              </Field>
              <Field label="Goals">
                <Input type="number" min={0} value={draft.stats.goals} onChange={(e) => set("stats", { ...draft.stats, goals: numberOrUndefined(e.target.value) ?? 0 })} />
              </Field>
              <Field label="Assists">
                <Input type="number" min={0} value={draft.stats.assists} onChange={(e) => set("stats", { ...draft.stats, assists: numberOrUndefined(e.target.value) ?? 0 })} />
              </Field>
            </div>

            <SwitchRow label="Ready for next step" hint="Shows the scout badge on the public card." checked={draft.readyForNextStep} onChange={(v) => set("readyForNextStep", v)} />
            <SwitchRow label="Show on public site" checked={draft.published} onChange={(v) => set("published", v)} />
          </>
        )}
      </EditorSheet>
    </AdminPage>
  )
}
