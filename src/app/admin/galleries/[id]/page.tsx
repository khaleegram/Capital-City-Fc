"use client"

import Image from "next/image"
import Link from "next/link"
import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, ImagePlus, Loader2, Save, Tag, Trash2 } from "lucide-react"
import type { Gallery, GalleryPhoto, Journey } from "@/lib/data"
import { removeDoc, saveDoc, useCollection, useDocument } from "@/lib/collections"
import { deleteFile, imageSize, refreshPublic, slugify, uploadFile } from "@/lib/admin-client"
import { useToast } from "@/hooks/use-toast"
import { AdminPage, ConfirmDelete, Field, LoadingBlock } from "@/components/admin/ui"
import { NativeSelect, PlayerMultiSelect, SwitchRow, numberOrUndefined } from "@/components/admin/form-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Draft = Omit<Gallery, "id" | "createdAt">

export default function GalleryEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, loading } = useDocument<Gallery>("galleries", id)
  const { items: journeys } = useCollection<Journey>("journeys")
  const router = useRouter()
  const { toast } = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploads, setUploads] = useState<{ done: number; total: number } | null>(null)
  const [tagging, setTagging] = useState<number | null>(null)
  const [removed, setRemoved] = useState<string[]>([])
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (data && !dirty) {
      const { id: _id, createdAt: _c, ...rest } = data
      setDraft({ ...rest, photos: rest.photos ?? [] })
    }
  }, [data, dirty])

  const set = (patch: Partial<Draft>) => {
    setDirty(true)
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }
  const setPhoto = (i: number, patch: Partial<GalleryPhoto>) => draft && set({ photos: draft.photos.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const move = (i: number, dir: -1 | 1) => {
    if (!draft) return
    const photos = [...draft.photos]
    const j = i + dir
    if (j < 0 || j >= photos.length) return
    ;[photos[i], photos[j]] = [photos[j], photos[i]]
    set({ photos })
  }

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || !draft) return
    const list = Array.from(files)
    setUploads({ done: 0, total: list.length })
    const added: GalleryPhoto[] = []
    for (const file of list) {
      try {
        const [size, url] = await Promise.all([imageSize(file), uploadFile(file, "galleries")])
        added.push({ url, w: size.w, h: size.h, caption: "", playerIds: [] })
      } catch (err) {
        toast({ variant: "destructive", title: `Couldn't upload ${file.name}`, description: (err as Error).message })
      }
      setUploads((u) => (u ? { ...u, done: u.done + 1 } : u))
    }
    setUploads(null)
    setDirty(true)
    setDraft((d) => (d ? { ...d, photos: [...d.photos, ...added] } : d))
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      await saveDoc("galleries", id, { ...draft, slug: draft.slug || slugify(`${draft.chapter ? `chapter-${draft.chapter}-` : ""}${draft.title}`) })
      await refreshPublic("galleries", "journeys", "players")
      await Promise.all(removed.map((url) => deleteFile(url)))
      setRemoved([])
      setDirty(false)
      toast({ title: "Gallery saved" })
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !draft) return <LoadingBlock />
  if (!data) return <AdminPage title="Gallery not found">{null}</AdminPage>

  return (
    <AdminPage
      title={draft.title || "Untitled chapter"}
      actions={
        <>
          <Button variant="ghost" asChild>
            <Link href="/admin/galleries">
              <ArrowLeft /> All galleries
            </Link>
          </Button>
          {data.published && data.slug && (
            <Button variant="outline" asChild>
              <Link href={`/gallery/${data.slug}`} target="_blank">
                <ExternalLink /> View
              </Link>
            </Button>
          )}
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} {dirty ? "Save changes" : "Saved"}
          </Button>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Field label="Title">
            <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Chapter">
              <Input type="number" value={draft.chapter ?? ""} onChange={(e) => set({ chapter: numberOrUndefined(e.target.value) })} />
            </Field>
            <Field label="Date">
              <Input type="date" value={draft.date ?? ""} onChange={(e) => set({ date: e.target.value })} />
            </Field>
          </div>
          <Field label="Location">
            <Input value={draft.location ?? ""} onChange={(e) => set({ location: e.target.value })} placeholder="Gothenburg, Sweden" />
          </Field>
          <Field label="Journey">
            <NativeSelect value={draft.journeyId ?? ""} onChange={(v) => set({ journeyId: v || null })} placeholder="None" options={journeys.map((j) => [j.id, j.title] as const)} />
          </Field>
          <Field label="Story" hint="A short intro shown above the photos.">
            <Textarea rows={5} value={draft.story ?? ""} onChange={(e) => set({ story: e.target.value })} />
          </Field>
          <Field label="URL slug" hint="Generated from the title if left empty.">
            <Input value={draft.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} />
          </Field>
          <SwitchRow label="Published" checked={draft.published} onChange={(v) => set({ published: v })} />
          <div className="border-t border-line/10 pt-4">
            <ConfirmDelete
              label="Delete gallery"
              what="this gallery and its photos"
              onConfirm={async () => {
                await removeDoc("galleries", id)
                await Promise.all(draft.photos.map((p) => deleteFile(p.url)))
                await refreshPublic("galleries")
                router.push("/admin/galleries")
              }}
            />
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={!!uploads}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line/20 py-8 text-sm text-mist/80 hover:border-line/40 hover:text-ivory"
          >
            {uploads ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Uploading {uploads.done}/{uploads.total}…
              </>
            ) : (
              <>
                <ImagePlus className="h-5 w-5" /> Add photos (select many at once)
              </>
            )}
          </button>
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

          <ol className="space-y-3">
            {draft.photos.map((p, i) => (
              <li key={p.url} className="flex gap-3 rounded-2xl border border-line/10 p-2">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-navy-deep sm:h-28 sm:w-36">
                  <Image src={p.url} alt="" fill sizes="144px" className="object-cover" />
                  {i === 0 && <span className="absolute left-1 top-1 rounded bg-signal px-1.5 py-0.5 text-[10px] font-bold">COVER</span>}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Textarea rows={2} placeholder="Caption" value={p.caption ?? ""} onChange={(e) => setPhoto(i, { caption: e.target.value })} className="min-h-0 text-sm" />
                  <button type="button" onClick={() => setTagging(i)} className="flex items-center gap-1.5 self-start text-xs text-mist/75 hover:text-ivory">
                    <Tag className="h-3.5 w-3.5" /> {p.playerIds?.length ? `${p.playerIds.length} players tagged` : "Tag players"}
                  </button>
                </div>
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === draft.photos.length - 1} aria-label="Move down">
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove photo"
                    className="text-mist/70 hover:text-signal"
                    onClick={() => {
                      setRemoved((r) => [...r, p.url])
                      set({ photos: draft.photos.filter((_, j) => j !== i) })
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <Dialog open={tagging !== null} onOpenChange={(o) => !o && setTagging(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tag players in this photo</DialogTitle>
          </DialogHeader>
          {tagging !== null && draft.photos[tagging] && (
            <PlayerMultiSelect value={draft.photos[tagging].playerIds ?? []} onChange={(ids) => setPhoto(tagging, { playerIds: ids })} />
          )}
        </DialogContent>
      </Dialog>
    </AdminPage>
  )
}
