"use client"

import type { JourneyKind, JourneyStatus, MediaAsset } from "@/lib/data"
import { slugify } from "@/lib/admin-client"
import { useCollection } from "@/lib/collections"
import { Field, UploadField } from "@/components/admin/ui"
import { NativeSelect, SwitchRow, numberOrUndefined } from "@/components/admin/form-kit"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import type { TabProps } from "./types"

const STATUSES = [
  ["upcoming", "Upcoming"],
  ["live", "Live, on the road now"],
  ["completed", "Completed"],
] as const

export function DetailsTab({ journeyId, draft, set }: TabProps) {
  const { items: media } = useCollection<MediaAsset>("mediaAssets")
  const own = media.filter((m) => m.journeyId === journeyId)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Subtitle">
            <Input value={draft.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value })} placeholder="The world's biggest youth tournament" />
          </Field>
          <Field label="Status">
            <NativeSelect<JourneyStatus> value={draft.status} onChange={(v) => set({ status: v })} options={STATUSES} />
          </Field>
          <Field label="Kind">
            <NativeSelect<JourneyKind>
              value={draft.kind}
              onChange={(v) => set({ kind: v })}
              options={[
                ["international", "International tour"],
                ["domestic", "Domestic campaign"],
              ]}
            />
          </Field>
          <Field label="Start date">
            <Input type="date" value={draft.startDate ?? ""} onChange={(e) => set({ startDate: e.target.value })} />
          </Field>
          <Field label="End date">
            <Input type="date" value={draft.endDate ?? ""} onChange={(e) => set({ endDate: e.target.value })} />
          </Field>
          <Field label="Season">
            <Input value={draft.season ?? ""} onChange={(e) => set({ season: e.target.value })} placeholder="2026" />
          </Field>
          <Field label="Sort order" hint="Lower shows first among completed journeys.">
            <Input type="number" value={draft.order ?? ""} onChange={(e) => set({ order: numberOrUndefined(e.target.value) })} />
          </Field>
        </div>
        <Field label="Summary" hint="One or two sentences shown on cards and at the top of the journey page.">
          <Textarea rows={4} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} />
        </Field>
        <div className="space-y-3 rounded-2xl border border-line/10 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Journey progress</span>
            <span className="font-mono text-sm tabular-nums">{draft.progress ?? 0}%</span>
          </div>
          <Slider value={[draft.progress ?? 0]} min={0} max={100} step={5} onValueChange={([v]) => set({ progress: v })} />
          <p className="text-xs text-muted-foreground">Drives the progress rail on the public page. Set to 100 when the squad is home.</p>
        </div>
        <Field label="URL slug">
          <Input value={draft.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} />
        </Field>
      </div>
      <div className="space-y-4">
        <Field label="Cover image">
          <UploadField value={draft.coverImageUrl} onChange={(url) => set({ coverImageUrl: url ?? "" })} prefix="journeys" aspect="aspect-[4/3]" />
        </Field>
        <Field
          label="Mobile cover image (optional)"
          hint={
            draft.coverImageMobileUrl
              ? "Phones use this instead of the cover above."
              : "Leave empty and phones use the cover above. Portrait, 3:4 to 9:16."
          }
        >
          <UploadField
            value={draft.coverImageMobileUrl}
            onChange={(url) => set({ coverImageMobileUrl: url ?? "" })}
            prefix="journeys"
            aspect="aspect-[4/5]"
          />
        </Field>
        <Field label="Hero video" hint="Pick from media tagged to this journey.">
          <NativeSelect value={draft.heroMediaId ?? ""} onChange={(v) => set({ heroMediaId: v || null })} placeholder="None" options={own.map((m) => [m.id, m.title] as const)} />
        </Field>
        <SwitchRow label="Featured" hint="Promote on the homepage." checked={!!draft.featured} onChange={(v) => set({ featured: v })} />
        <SwitchRow label="Published" hint="Visible on the public site." checked={draft.published} onChange={(v) => set({ published: v })} />
      </div>
    </div>
  )
}
