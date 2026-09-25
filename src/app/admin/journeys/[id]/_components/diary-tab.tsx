"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { Loader2, MapPin, Send, Sparkles } from "lucide-react"
import type { JourneyEntry, MediaAsset } from "@/lib/data"
import { auth } from "@/lib/firebase"
import { removeDoc, saveDoc, useCollection } from "@/lib/collections"
import { deleteFile, refreshPublic } from "@/lib/admin-client"
import { byNewest, formatDate, toDate } from "@/lib/utils"
import { generateJourneyEntry } from "@/ai/flows/generate-journey-entry"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDelete, Field, UploadField } from "@/components/admin/ui"
import { numberOrUndefined } from "@/components/admin/form-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { TabProps } from "./types"

function dayOf(startDate?: string) {
  const start = toDate(startDate)
  if (!start) return undefined
  const diff = Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1
  return diff > 0 ? diff : undefined
}

export function DiaryTab({ journeyId, draft }: TabProps) {
  const path = `journeys/${journeyId}/entries`
  const { items: entries } = useCollection<JourneyEntry>(path, byNewest)
  const { items: media } = useCollection<MediaAsset>("mediaAssets")
  const journeyMedia = useMemo(() => media.filter((m) => m.journeyId === journeyId), [media, journeyId])
  const currentStop = draft.stops?.find((s) => s.current)
  const { toast } = useToast()

  const fresh = () => ({
    notes: "",
    title: "",
    body: "",
    location: currentStop ? `${currentStop.city}, ${currentStop.country}` : "",
    day: dayOf(draft.startDate),
    imageUrl: "",
    mediaIds: [] as string[],
  })
  const [form, setForm] = useState(fresh)
  const [writing, setWriting] = useState(false)
  const [posting, setPosting] = useState(false)

  const writeUp = async () => {
    if (!form.notes.trim()) return
    setWriting(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error("Please sign in again.")
      const out = await generateJourneyEntry(token, { journeyTitle: draft.title, location: form.location || undefined, day: form.day, notes: form.notes })
      setForm((f) => ({ ...f, title: out.title, body: out.body }))
    } catch (err) {
      toast({ variant: "destructive", title: "AI write-up failed", description: (err as Error).message })
    } finally {
      setWriting(false)
    }
  }

  const post = async () => {
    const title = form.title.trim() || form.notes.trim().split("\n")[0].slice(0, 80)
    if (!title) {
      toast({ variant: "destructive", title: "Add a title or some notes first." })
      return
    }
    setPosting(true)
    try {
      await saveDoc(path, null, {
        title,
        body: form.body.trim() || form.notes.trim(),
        location: form.location.trim(),
        day: form.day,
        imageUrl: form.imageUrl,
        mediaIds: form.mediaIds,
      })
      await refreshPublic("journeys")
      setForm(fresh())
      toast({ title: "Posted to the diary", description: draft.published ? "It's live on the journey page." : "The journey itself is still a draft." })
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't post", description: (err as Error).message })
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,480px)_1fr]">
      <section className="space-y-4">
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <Field label="Day">
            <Input type="number" inputMode="numeric" value={form.day ?? ""} onChange={(e) => setForm((f) => ({ ...f, day: numberOrUndefined(e.target.value) }))} />
          </Field>
          <Field label="Location">
            <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </Field>
        </div>
        <Field label="Quick notes" hint="Bullet points are fine. Tap “Write it up” to turn them into a diary post.">
          <Textarea
            rows={5}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder={"- landed Gothenburg 14:00\n- light session on the beach\n- Musa back from knock"}
          />
        </Field>
        <Button variant="outline" onClick={writeUp} disabled={writing || !form.notes.trim()} className="w-full">
          {writing ? <Loader2 className="animate-spin" /> : <Sparkles />} Write it up
        </Button>
        <Field label="Title">
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </Field>
        <Field label="Post">
          <Textarea rows={6} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
        </Field>
        <Field label="Photo">
          <UploadField value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url ?? "" }))} prefix="journeys" label="Take or choose a photo" />
        </Field>
        {journeyMedia.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Attach videos</span>
            <div className="flex flex-wrap gap-1.5">
              {journeyMedia.map((m) => {
                const on = form.mediaIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setForm((f) => ({ ...f, mediaIds: on ? f.mediaIds.filter((x) => x !== m.id) : [...f.mediaIds, m.id] }))}
                    className={`rounded-full border px-3 py-1.5 text-xs ${on ? "border-ivory bg-ivory text-ink" : "border-white/15 text-mist/85"}`}
                  >
                    {m.title}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <Button size="xl" className="w-full" onClick={post} disabled={posting}>
          {posting ? <Loader2 className="animate-spin" /> : <Send />} Post to diary
        </Button>
      </section>

      <section>
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-stamp text-mist/70">{entries.length} entries</h2>
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3 rounded-2xl border border-white/10 p-3">
              {e.imageUrl && (
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                  <Image src={e.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mist/60">
                  {e.day ? `Day ${e.day} · ` : ""}
                  {formatDate(e.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="font-semibold">{e.title}</p>
                {e.location && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {e.location}
                  </p>
                )}
                {e.body && <p className="mt-1 line-clamp-2 text-sm text-mist/80">{e.body}</p>}
              </div>
              <ConfirmDelete
                what="this entry"
                onConfirm={async () => {
                  await removeDoc(path, e.id)
                  await deleteFile(e.imageUrl)
                  await refreshPublic("journeys")
                }}
              />
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
