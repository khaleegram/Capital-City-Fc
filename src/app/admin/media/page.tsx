"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Clapperboard, Link2, Loader2, Plus, Star, UploadCloud } from "lucide-react"
import type { FixtureKind, Journey, MediaAsset, MediaType } from "@/lib/data"
import { copy } from "@/lib/copy"
import { removeDoc, saveDoc, useCollection } from "@/lib/collections"
import { deleteFile, refreshPublic, uploadFile } from "@/lib/admin-client"
import { byNewest, cn, embedUrlFor, formatDate, formatDuration, youtubePoster } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { AdminPage, ConfirmDelete, EmptyState, Field, LoadingBlock, PublishBadge, UploadField } from "@/components/admin/ui"
import { EditorSheet, NativeSelect, PlayerMultiSelect, SwitchRow, numberOrUndefined } from "@/components/admin/form-kit"
import { VideoFrame } from "@/components/site/video-thumb"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

const { all: _all, ...categoryLabels } = copy.media.categories
const TYPES = Object.entries(categoryLabels) as [MediaType, string][]
const KINDS = Object.entries(copy.media.fixtureKinds) as [FixtureKind, string][]

type Draft = Omit<MediaAsset, "id" | "createdAt"> & { id?: string }

/**
 * "CAPITAL CITY FC VS MALANTARKI (1-2)" — the shape the club was already typing into the
 * Title box by hand. Opponent first, score appended once both sides are filled in.
 */
function autoTitleFor(d: Pick<Draft, "opponent" | "scoreFor" | "scoreAgainst">) {
  const opponent = (d.opponent ?? "").trim()
  if (!opponent) return ""
  const score = d.scoreFor != null && d.scoreAgainst != null ? ` (${d.scoreFor}-${d.scoreAgainst})` : ""
  return `CAPITAL CITY FC VS ${opponent.toUpperCase()}${score}`
}

const blank = (): Draft => ({
  type: "highlight",
  title: "",
  description: "",
  url: "",
  poster: "",
  playerIds: [],
  taggedPlayers: [],
  journeyId: null,
  fixtureId: null,
  fixtureKind: "friendly",
  opponent: "",
  scoreFor: undefined,
  scoreAgainst: undefined,
  year: new Date().getFullYear(),
  vertical: false,
  featured: false,
  published: false,
})

/**
 * Reads duration and orientation from a video file.
 *
 * Never rejects, and never hangs. Some clips — iPhone HEVC .MOVs especially — fire neither
 * `loadedmetadata` nor `error`, which used to leave the caller's `Promise.all` pending
 * forever and stranded the editor at 100% with the file already sitting in the bucket.
 */
function readVideoMeta(file: File, timeoutMs = 8000): Promise<{ duration?: number; vertical?: boolean }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement("video")
    v.preload = "metadata"
    let settled = false
    const finish = (meta: { duration?: number; vertical?: boolean }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      v.onloadedmetadata = null
      v.onerror = null
      v.removeAttribute("src")
      URL.revokeObjectURL(url)
      resolve(meta)
    }
    const timer = setTimeout(() => finish({}), timeoutMs)
    v.onloadedmetadata = () =>
      finish({
        duration: Number.isFinite(v.duration) ? Math.round(v.duration) : undefined,
        vertical: v.videoHeight > v.videoWidth,
      })
    v.onerror = () => finish({})
    v.src = url
  })
}

/**
 * Grabs a still from a video so its card has a thumbnail.
 *
 * Runs after the video has landed, never before: a poster is decoration, and it must not be
 * able to fail an upload that already succeeded. Frame zero is very often black, so the
 * browser is asked for a second in — capped at halfway for clips shorter than that.
 *
 * Returns null rather than throwing, because every failure here is non-fatal.
 */
async function captureVideoPoster(file: File, atSeconds = 1): Promise<File | null> {
  const url = URL.createObjectURL(file)
  const v = document.createElement("video")
  v.preload = "metadata"
  v.muted = true
  v.playsInline = true

  /** Resolves false on error or timeout, so a clip the browser can't decode can't hang this. */
  const waitFor = (attach: (done: (ok: boolean) => void) => void, timeoutMs = 8000) =>
    new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs)
      attach((ok) => {
        clearTimeout(timer)
        resolve(ok)
      })
    })

  try {
    const loaded = await waitFor((done) => {
      v.onloadedmetadata = () => done(true)
      v.onerror = () => done(false)
      v.src = url
    })
    if (!loaded || !v.videoWidth) return null

    const target = Number.isFinite(v.duration) && v.duration > 0 ? Math.min(atSeconds, v.duration / 2) : 0
    const seeked = await waitFor((done) => {
      v.onseeked = () => done(true)
      v.onerror = () => done(false)
      v.currentTime = target
    })
    if (!seeked || !v.videoWidth) return null

    // Cap the still at 1280px wide; cards never draw it larger than that.
    const scale = Math.min(1, 1280 / v.videoWidth)
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(v.videoWidth * scale)
    canvas.height = Math.round(v.videoHeight * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height)

    let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82))
    if (!blob || blob.type !== "image/webp") blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85))
    if (!blob) return null

    const ext = blob.type === "image/webp" ? ".webp" : ".jpg"
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ext, { type: blob.type })
  } catch {
    return null
  } finally {
    v.removeAttribute("src")
    URL.revokeObjectURL(url)
  }
}

function VideoSource({ draft, onChange }: { draft: Draft; onChange: (patch: Partial<Draft>) => void }) {
  const [mode, setMode] = useState<"upload" | "link">(draft.url && embedUrlFor(draft.url) ? "link" : "upload")
  const [progress, setProgress] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const pick = async (file?: File) => {
    if (!file) return
    setProgress(0)
    /*
     * Metadata is a nicety — duration and orientation. It runs *alongside* the upload
     * rather than gating it, so a clip whose codec the browser can't parse can no longer
     * leave this panel stuck on a spinner after the bytes have already landed.
     */
    const meta = readVideoMeta(file)
    try {
      const url = await uploadFile(file, "media", setProgress)
      onChange({ url, title: draft.title || file.name.replace(/\.[^.]+$/, "") })
      // The video itself is safe now; everything after this is decoration, so stop showing
      // a progress bar that would otherwise sit at 100% while the still is generated.
      setProgress(null)
      const m = await meta
      onChange(m)
      if (!m.duration) {
        toast({
          title: "Uploaded — but this clip may not play",
          description: "Its length couldn't be read, which usually means the browser can't decode the codec. Re-export as MP4 (H.264) if playback fails.",
        })
      }
      // Thumbnail for the cards. Best effort — a failure here leaves the video intact.
      const frame = await captureVideoPoster(file)
      if (frame) onChange({ poster: await uploadFile(frame, "media") })
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: (err as Error).message })
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(["upload", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors",
              mode === m ? "border-signal bg-signal text-signal-foreground" : "border-line/15 text-mist/80 hover:border-line/40"
            )}
          >
            {m === "upload" ? <UploadCloud className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            {m === "upload" ? "Upload file" : "YouTube / Vimeo link"}
          </button>
        ))}
      </div>
      {mode === "link" ? (
        <Input
          type="url"
          placeholder="https://youtube.com/watch?v=…"
          value={draft.url}
          onChange={(e) => {
            const url = e.target.value
            onChange({ url, ...(!draft.poster && youtubePoster(url) ? { poster: youtubePoster(url)! } : {}) })
          }}
        />
      ) : draft.url && !embedUrlFor(draft.url) ? (
        <div className="space-y-2">
          <video src={draft.url} controls preload="metadata" className="aspect-video w-full rounded-xl bg-navy-deep" />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ url: "" })}>
            Replace video
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={progress !== null}
          onClick={() => input.current?.click()}
          className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line/20 bg-line/[0.03] text-sm text-mist/70 transition-colors hover:border-line/40 hover:text-ivory"
        >
          {progress !== null ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="font-mono text-xs">{progress}%</span>
            </>
          ) : (
            <>
              <UploadCloud className="h-6 w-6" /> Choose a video (MP4 / MOV)
            </>
          )}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Clear the input so re-picking the *same* file still fires a change event.
          e.target.value = ""
          void pick(file)
        }}
      />
    </div>
  )
}

export default function MediaAdmin() {
  const { items, loading } = useCollection<MediaAsset>("mediaAssets", byNewest)
  const { items: journeys } = useCollection<Journey>("journeys")
  const params = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState<MediaType | "all">("all")
  /** Once the title has been typed by hand, auto-fill stops touching it. */
  const titleTouched = useRef(false)

  /** Opening a draft adopts whatever title it already has, so auto-fill won't overwrite it. */
  const openDraft = (d: Draft) => {
    titleTouched.current = Boolean(d.title.trim())
    setDraft(d)
  }

  useEffect(() => {
    if (params.get("new") === "1") {
      openDraft({ ...blank(), journeyId: params.get("journey") })
      router.replace("/admin/media")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, router])

  const set = (patch: Partial<Draft>) =>
    setDraft((d) => {
      if (!d) return d
      const next = { ...d, ...patch }
      // Keep the score-line title in step with the opponent and score, but never clobber a
      // title the user typed themselves.
      if (!titleTouched.current) next.title = autoTitleFor(next) || next.title
      return next
    })
  const rows = useMemo(() => items.filter((m) => type === "all" || m.type === type), [items, type])

  const save = async () => {
    if (!draft) return
    if (!draft.title.trim() || !draft.url.trim()) {
      toast({ variant: "destructive", title: "A title and a video are required." })
      return
    }
    setSaving(true)
    try {
      const { id, ...data } = draft
      await saveDoc("mediaAssets", id ?? null, data)
      await refreshPublic("media", "journeys", "players")
      toast({ title: "Media saved" })
      setDraft(null)
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminPage
      title="Media library"
      description="Full matches, highlights, training and tour footage. Tag players so it shows on their scouting profile."
      actions={
        <Button onClick={() => openDraft(blank())}>
          <Plus /> Add media
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {([["all", "All"], ...TYPES] as [MediaType | "all", string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setType(k)}
            className={cn(
              "h-9 rounded-full border px-4 text-xs font-semibold transition-colors",
              type === k ? "border-signal bg-signal text-signal-foreground" : "border-line/15 text-mist/80 hover:border-line/40"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState icon={Clapperboard} title="No media yet" body="Upload match footage or paste a YouTube link." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-2xl border border-line/10">
              <button className="relative block aspect-video w-full bg-navy-deep" onClick={() => openDraft({ ...blank(), ...m })}>
                {m.poster || youtubePoster(m.url) ? (
                  <Image src={(m.poster || youtubePoster(m.url))!} alt="" fill sizes="33vw" className="object-cover" />
                ) : (
                  // Footage with no still of its own: paint the video's first frame.
                  <VideoFrame src={m.url} />
                )}
                {m.duration ? <span className="on-dark absolute bottom-2 right-2 rounded bg-ink/80 px-1.5 py-0.5 font-mono text-[10px]">{formatDuration(m.duration)}</span> : null}
                {m.featured && <Star className="absolute left-2 top-2 h-4 w-4 fill-signal text-signal" />}
              </button>
              <div className="flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.title}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {categoryLabels[m.type]}
                    </Badge>
                    {m.playerIds?.length ? `${m.playerIds.length} tagged` : ""} {formatDate(m.createdAt)}
                  </p>
                </div>
                <PublishBadge published={m.published} />
                <ConfirmDelete
                  what={m.title}
                  onConfirm={async () => {
                    await removeDoc("mediaAssets", m.id)
                    if (!embedUrlFor(m.url)) await deleteFile(m.url)
                    await deleteFile(m.poster)
                    await refreshPublic("media", "journeys", "players")
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <EditorSheet
        open={!!draft}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit media" : "New media"}
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
            <VideoSource draft={draft} onChange={set} />
            <Field label="Title" hint="Fills itself from the opponent and score below. Type here to take over.">
              <Input
                value={draft.title}
                onChange={(e) => {
                  titleTouched.current = true
                  set({ title: e.target.value })
                }}
              />
            </Field>
            {autoTitleFor(draft) && draft.title !== autoTitleFor(draft) ? (
              <button
                type="button"
                onClick={() => {
                  titleTouched.current = false
                  set({ title: autoTitleFor(draft) })
                }}
                className="text-xs font-semibold text-signal underline underline-offset-2"
              >
                Use &ldquo;{autoTitleFor(draft)}&rdquo;
              </button>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <NativeSelect<MediaType> value={draft.type} onChange={(v) => set({ type: v })} options={TYPES} />
              </Field>
              <Field label="Year">
                <Input type="number" value={draft.year ?? ""} onChange={(e) => set({ year: numberOrUndefined(e.target.value) })} />
              </Field>
              <Field label="Fixture type" hint="Friendly, league, cup, tournament or scouting programme.">
                <NativeSelect<FixtureKind> value={draft.fixtureKind ?? ""} onChange={(v) => set({ fixtureKind: v })} placeholder="Not set" options={KINDS} />
              </Field>
              <Field label="Journey">
                <NativeSelect value={draft.journeyId ?? ""} onChange={(v) => set({ journeyId: v || null })} placeholder="None" options={journeys.map((j) => [j.id, j.title] as const)} />
              </Field>
              <Field label="Opponent" className="sm:col-span-2">
                <Input value={draft.opponent ?? ""} onChange={(e) => set({ opponent: e.target.value })} placeholder="e.g. Malantarki" />
              </Field>
              <Field label="Our score">
                <Input type="number" min={0} inputMode="numeric" value={draft.scoreFor ?? ""} onChange={(e) => set({ scoreFor: numberOrUndefined(e.target.value) })} />
              </Field>
              <Field label="Their score">
                <Input type="number" min={0} inputMode="numeric" value={draft.scoreAgainst ?? ""} onChange={(e) => set({ scoreAgainst: numberOrUndefined(e.target.value) })} />
              </Field>
              <Field label="Duration (seconds)" hint="Filled automatically for uploads.">
                <Input type="number" value={draft.duration ?? ""} onChange={(e) => set({ duration: numberOrUndefined(e.target.value) })} />
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={3} value={draft.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="Poster image" hint="Shown before the video plays. YouTube links fill this automatically.">
              <UploadField value={draft.poster} onChange={(url) => set({ poster: url ?? "" })} prefix="media" />
            </Field>
            <PlayerMultiSelect
              label="Tagged players"
              value={draft.playerIds}
              onChange={(ids, players) => set({ playerIds: ids, taggedPlayers: players.map((p) => ({ id: p.id, name: p.name })) })}
            />
            <SwitchRow label="Vertical (9:16)" hint="Phone-shot clips show in the reel format." checked={!!draft.vertical} onChange={(v) => set({ vertical: v })} />
            <SwitchRow label="Featured" hint="Pinned to the homepage reel." checked={!!draft.featured} onChange={(v) => set({ featured: v })} />
            <SwitchRow label="Published" checked={draft.published} onChange={(v) => set({ published: v })} />
          </>
        )}
      </EditorSheet>
    </AdminPage>
  )
}
