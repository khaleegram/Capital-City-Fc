"use client"

import { useMemo, useState } from "react"
import { Loader2, Plus, Search, X } from "lucide-react"
import type { Player } from "@/lib/data"
import { cn } from "@/lib/utils"
import { useCollection } from "@/lib/collections"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

/*
 * Every control in this file reads through the contextual brand tokens — `paper`, `line`,
 * `ivory`, `mist`, `signal` — instead of fixed ink/white values. The old hardcoded
 * `bg-ink/40` + `text-ivory` pairing and `bg-ivory text-ink` pills were written for the
 * dark theme; once the site went light, `ivory` became ink, so those pills rendered
 * navy-on-navy and the selects ink-on-ink.
 */

export const selectClass =
  "flex h-11 w-full rounded-xl border border-input bg-paper px-3 text-sm text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"

export function NativeSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  className,
  id,
}: {
  value: T | "" | null | undefined
  onChange: (v: T) => void
  options: readonly (readonly [T, string])[]
  placeholder?: string
  className?: string
  id?: string
}) {
  return (
    <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value as T)} className={cn(selectClass, className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(([v, label]) => (
        <option key={v} value={v} className="bg-popover text-popover-foreground">
          {label}
        </option>
      ))}
    </select>
  )
}

export function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line/10 px-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

export function numberOrUndefined(v: string) {
  if (v.trim() === "") return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** Players (role Player) for tagging, sorted by name. */
export function useSquad() {
  const { items, loading } = useCollection<Player>("players", (a, b) => a.name.localeCompare(b.name))
  return { players: items.filter((p) => p.role === "Player"), loading }
}

export function PlayerMultiSelect({ value, onChange, label = "Players" }: { value: string[]; onChange: (ids: string[], players: Player[]) => void; label?: string }) {
  const { players, loading } = useSquad()
  const [q, setQ] = useState("")
  const selected = new Set(value)
  const filtered = useMemo(
    () => players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || String(p.jerseyNumber) === q),
    [players, q]
  )
  const toggle = (id: string) => {
    const next = selected.has(id) ? value.filter((v) => v !== id) : [...value, id]
    onChange(next, players.filter((p) => next.includes(p.id)))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{value.length} selected</span>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist/60" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or number" className="pl-9" />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-line/10 p-2">
        {loading ? (
          <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-mist" />
        ) : filtered.length === 0 ? (
          <p className="p-3 text-center text-sm text-muted-foreground">No players found.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={selected.has(p.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selected.has(p.id) ? "border-signal bg-signal text-signal-foreground" : "border-line/15 text-mist/85 hover:border-line/40"
                )}
              >
                <span className="font-mono opacity-70">#{p.jerseyNumber}</span> {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Editable list of short strings (licences, strengths, tags). */
export function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("")
  const add = () => {
    const v = draft.trim()
    if (!v || value.includes(v)) return
    onChange([...value, v])
    setDraft("")
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add} aria-label="Add">
          <Plus />
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v} className="flex items-center gap-1 rounded-full border border-line/15 py-1 pl-3 pr-1 text-xs">
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full p-1 hover:bg-line/10" aria-label={`Remove ${v}`}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function EditorSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer: React.ReactNode
  className?: string
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* `bg-paper` overrides the sheet's fixed `bg-navy-deep`, so the editor matches the
          new light console instead of dropping a legacy navy panel over it. */}
      <SheetContent side="right" className={cn("flex w-full flex-col gap-0 bg-paper p-0 text-ivory sm:max-w-xl", className)}>
        <SheetHeader className="border-b border-line/10 p-5 text-left">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        <div className="flex justify-end gap-2 border-t border-line/10 p-4">{footer}</div>
      </SheetContent>
    </Sheet>
  )
}
