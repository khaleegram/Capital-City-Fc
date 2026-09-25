"use client"

import { Plus, Trash2 } from "lucide-react"
import { Field } from "@/components/admin/ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { TabProps } from "./types"

export function StoryTab({ draft, set }: TabProps) {
  const quotes = draft.quotes ?? []
  const outcome = draft.outcome ?? { headline: "", body: "", badge: "" }
  const setOutcome = (patch: Partial<typeof outcome>) => set({ outcome: { ...outcome, ...patch } })

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold">Outcome</h2>
          <p className="text-sm text-muted-foreground">Shown at the end of the journey page once it&apos;s completed.</p>
        </div>
        <Field label="Headline">
          <Input value={outcome.headline} onChange={(e) => setOutcome({ headline: e.target.value })} placeholder="Champions. Unbeaten." />
        </Field>
        <Field label="Badge" hint="Short stamp text, e.g. WINNERS, QUARTER-FINAL, UNBEATEN.">
          <Input value={outcome.badge ?? ""} onChange={(e) => setOutcome({ badge: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Body">
          <Textarea rows={5} value={outcome.body ?? ""} onChange={(e) => setOutcome({ body: e.target.value })} />
        </Field>
        {draft.outcome && (
          <Button variant="ghost" size="sm" onClick={() => set({ outcome: null })}>
            Clear outcome
          </Button>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold">Quotes</h2>
          <p className="text-sm text-muted-foreground">Voices from players, coaches, parents and opponents.</p>
        </div>
        {quotes.map((q, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-line/10 p-3">
            <Textarea
              rows={3}
              aria-label="Quote"
              value={q.text}
              onChange={(e) => set({ quotes: quotes.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
            />
            <div className="flex gap-2">
              <Input
                aria-label="Author"
                placeholder="Name"
                value={q.author}
                onChange={(e) => set({ quotes: quotes.map((x, j) => (j === i ? { ...x, author: e.target.value } : x)) })}
              />
              <Input
                aria-label="Role"
                placeholder="Role"
                value={q.role ?? ""}
                onChange={(e) => set({ quotes: quotes.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })}
              />
              <Button variant="ghost" size="icon" aria-label="Remove quote" onClick={() => set({ quotes: quotes.filter((_, j) => j !== i) })}>
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={() => set({ quotes: [...quotes, { text: "", author: "", role: "" }] })}>
          <Plus /> Add quote
        </Button>
      </section>
    </div>
  )
}
