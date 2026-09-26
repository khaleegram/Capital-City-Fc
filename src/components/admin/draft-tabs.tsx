"use client"

import { useMemo } from "react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * Published-or-draft switch, shared by every admin list that has both.
 *
 * Drafts used to be either pinned above the published list (News) or mixed in with a badge
 * (everything else), so the answer to "is anything waiting on me?" varied by screen. One control
 * in the same place on each page makes it a habit instead of something to remember.
 */
export type DraftView = "published" | "drafts"

/**
 * Splits a list into what is live and what is waiting.
 *
 * `published` is optional on most of these documents because the field arrived after they were
 * written, and a document without it has always been treated as live. That makes the test
 * `!== false` rather than a truthiness check — `!item.published` would file every one of those
 * older records under Drafts and report a backlog that isn't there.
 */
export function splitByPublished<T extends { published?: boolean | null }>(items: T[]) {
  const published: T[] = []
  const drafts: T[] = []
  for (const item of items) (item.published === false ? drafts : published).push(item)
  return { published, drafts }
}

/**
 * The tab bar itself. Controlled, with no panels of its own: each page already has a list, and
 * wrapping it in `TabsContent` would only add a layer without changing what renders.
 */
export function DraftTabs({
  value,
  onChange,
  published,
  drafts,
  className,
}: {
  value: DraftView
  onChange: (view: DraftView) => void
  published: number
  drafts: number
  className?: string
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as DraftView)} className={className}>
      <TabsList>
        <TabsTrigger value="published">Published ({published})</TabsTrigger>
        {/*
          Gold, and only when there is something in it. Published is the tab you land on, so
          without a mark here a draft would sit unnoticed until someone thought to look — the
          exact failure the old always-visible section was there to prevent.
        */}
        <TabsTrigger value="drafts" className={drafts > 0 ? "text-gold data-[state=active]:text-gold" : undefined}>
          Drafts ({drafts})
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

/**
 * The common shape in one call: the rows for the tab you're on, plus the counts the tabs need.
 *
 * Memoised on `items` so the pair of split arrays isn't rebuilt on every render, which would
 * otherwise invalidate any memo a caller derives from the rows.
 */
export function useDraftView<T extends { published?: boolean | null }>(items: T[], view: DraftView) {
  const { published, drafts } = useMemo(() => splitByPublished(items), [items])
  return {
    rows: view === "drafts" ? drafts : published,
    published: published.length,
    drafts: drafts.length,
  }
}
