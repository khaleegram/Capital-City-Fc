"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { Loader2, Plus, Search, UserPlus, Users, CircleCheck } from "lucide-react"
import type { Player, PlayerClubEntry, SquadStatus } from "@/lib/data"
import { removeDoc, saveDoc, useCollection } from "@/lib/collections"
import { approveSignupFiles, deleteFile, discardSignupFiles, refreshPublic } from "@/lib/admin-client"
import { publishSignupMedia } from "@/lib/publish-signup"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { formatBytes } from "@/lib/signup-limits"
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
  /** Player-stated club history. Staff tick `verified` per entry during review. */
  clubHistory: PlayerClubEntry[]
  // Present when the player submitted this profile from the public /join form.
  signupSessionId?: string
  signupGallery: { url: string; bytes: number }[]
  signupVideos: { url: string; bytes: number; name?: string }[]
  storageBytes: number
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
  clubHistory: [],
  signupGallery: [],
  signupVideos: [],
  storageBytes: 0,
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
    clubHistory: p.clubHistory ?? [],
    signupSessionId: p.signupSessionId,
    signupGallery: p.signupGallery ?? [],
    signupVideos: p.signupVideos ?? [],
    storageBytes: p.storageBytes ?? 0,
    source: p.source,
  }
}

export default function PlayersAdmin() {
  const { items, loading } = useCollection<Player>("players", (a, b) => (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99))
  const { toast } = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [promoting, setPromoting] = useState(false)
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

  /**
   * Accepting a self sign-up. The player's files move out of staging into the club's
   * permanent prefixes, then the document is repointed at the new URLs and published.
   *
   * The photo *must* be rewritten to the promoted URL: the staged copy is deleted during
   * the move, so leaving the old URL behind would give the public page a dead image.
   */
  const approveSignup = async () => {
    if (!draft?.id || !draft.signupSessionId) return
    setPromoting(true)
    try {
      const promoted = await approveSignupFiles(draft.signupSessionId, draft.id)
      const first = (kind: "photo" | "gallery" | "video") => promoted.filter((p) => p.kind === kind)

      const photo = first("photo")[0]
      const gallery = first("gallery").map((p) => ({ url: p.url, bytes: p.bytes }))
      const videos = first("video").map((p) => ({ url: p.url, bytes: p.bytes }))

      await saveDoc("players", draft.id, {
        imageUrl: photo?.url ?? draft.imageUrl,
        // Always write the arrays: leaving them out would merge-keep the old values and
        // leave the document pointing at staging URLs that no longer exist.
        signupGallery: gallery,
        signupVideos: videos,
        published: true,
      })

      // The player page reads `galleries` and `mediaAssets`, not the player document, so the
      // promoted files are invisible until we create those rows. Idempotent — safe to re-run.
      const published = await publishSignupMedia({
        playerId: draft.id,
        playerName: draft.name.trim(),
        galleryUrls: gallery.map((g) => g.url),
        videoUrls: videos.map((v) => v.url),
      })

      await refreshPublic("players", "journeys", "media", "galleries")
      toast({
        title: "Approved",
        description: `${draft.name} is live with ${formatBytes(draft.storageBytes)} of media${
          published.clipIds.length ? ` and ${published.clipIds.length} highlight${published.clipIds.length === 1 ? "" : "s"}` : ""
        }.`,
      })
      setDraft(null)
    } catch (err) {
      toast({ variant: "destructive", title: "Approval failed", description: (err as Error).message })
    } finally {
      setPromoting(false)
    }
  }

  /** Rejecting a self sign-up: delete the profile *and* reclaim every byte it uploaded. */
  const discardSignup = async () => {
    if (!draft?.id) return
    try {
      if (draft.signupSessionId) await discardSignupFiles(draft.signupSessionId)
      await removeDoc("players", draft.id)
      await refreshPublic("players", "journeys")
      toast({ title: "Discarded", description: `${draft.name}'s submission and files were deleted.` })
      setDraft(null)
    } catch (err) {
      toast({ variant: "destructive", title: "Discard failed", description: (err as Error).message })
    }
  }

  const save = async () => {
    if (!draft?.name.trim()) {
      toast({ variant: "destructive", title: "Name is required." })
      return
    }
    setSaving(true)
    try {
      const { id, strongFoot, signupSessionId, signupGallery, signupVideos, storageBytes, source, ...rest } = draft
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
            draftsOnly ? "border-signal bg-signal text-signal-foreground" : "border-line/15 text-mist/80 hover:border-line/40"
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
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line/10 p-3">
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
              <div className="space-y-4 rounded-2xl border border-signal/30 bg-signal/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-signal" />
                      <p className="text-sm font-semibold">
                        {draft.published ? "Self sign-up (already published)" : "Submitted by the player from /join"}
                      </p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {draft.published
                        ? `${formatBytes(draft.storageBytes)} of media, promoted into the club's storage.`
                        : `${formatBytes(draft.storageBytes)} uploaded, waiting in staging. Approving moves their files into the club's permanent storage and publishes the profile.`}
                    </p>
                  </div>
                  {!draft.published && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={approveSignup} disabled={promoting || !draft.signupSessionId}>
                        {promoting ? <Loader2 className="animate-spin" /> : <CircleCheck />}
                        Approve &amp; publish
                      </Button>
                      <ConfirmDelete
                        what={`${draft.name}'s submission and uploaded files`}
                        label="Discard"
                        onConfirm={discardSignup}
                      />
                    </div>
                  )}
                </div>

                {draft.signupVideos.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Footage · {draft.signupVideos.length} clip{draft.signupVideos.length === 1 ? "" : "s"}
                    </p>
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                      {draft.signupVideos.map((v) => (
                        <li key={v.url} className="overflow-hidden rounded-xl border border-line/10">
                          <video src={v.url} className="aspect-video w-full bg-navy-deep object-cover" controls muted playsInline preload="metadata" />
                          <p className="truncate px-2 py-1 font-mono text-[10px] text-muted-foreground">
                            {formatBytes(v.bytes)}
                            {v.name ? ` · ${v.name}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {draft.signupGallery.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Gallery · {draft.signupGallery.length} photo{draft.signupGallery.length === 1 ? "" : "s"}
                    </p>
                    <ul className="mt-2 grid grid-cols-4 gap-2">
                      {draft.signupGallery.map((p) => (
                        <li key={p.url} className="relative aspect-square overflow-hidden rounded-lg border border-line/10 bg-navy-deep">
                          <Image src={p.url} alt="" fill sizes="120px" className="object-cover" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {draft.clubHistory.length > 0 && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Club history · {draft.clubHistory.length} {draft.clubHistory.length === 1 ? "club" : "clubs"}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Stated by the player, so nothing here is confirmed yet. Tick each club you can
                      verify, then Save — the public profile only ever shows verified clubs.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {draft.clubHistory.map((club, i) => (
                        <li key={i} className="rounded-xl border border-line/10 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {club.club}
                                {club.current && (
                                  <span className="ml-2 rounded-full bg-signal/20 px-2 py-0.5 text-[10px] font-medium text-signal">current</span>
                                )}
                                {!club.verified && (
                                  <span className="ml-2 text-[10px] font-normal text-muted-foreground">unverified</span>
                                )}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {[club.level, club.position, club.league, club.division, club.country, club.seasons].filter(Boolean).join(" · ") ||
                                  "No further details given"}
                              </p>
                              {(club.appearances != null || club.goals != null || club.assists != null) && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {club.appearances ?? 0} apps · {club.goals ?? 0} goals · {club.assists ?? 0} assists
                                </p>
                              )}
                            </div>
                            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={!!club.verified}
                                onChange={(e) =>
                                  set(
                                    "clubHistory",
                                    draft.clubHistory.map((x, xi) => (xi === i ? { ...x, verified: e.target.checked } : x))
                                  )
                                }
                                className="h-4 w-4 accent-signal"
                              />
                              Verified
                            </label>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
