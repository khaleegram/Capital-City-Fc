"use client"

import type { ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ClubEntryInput, SignupClubLevel } from "@/lib/player-signup"
import { SIGNUP_CLUB_LEVELS, SIGNUP_POSITIONS } from "@/lib/player-signup"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Kept equal to the `clubHistory` size bound in firestore.rules (not below it).
 *
 * That bound is 5 rather than 8 for a rules-budget reason documented in the rule: at 8 the
 * eighth entry was rejected for a realistic payload. If this ever exceeds the rule's bound,
 * a player who fills the form in good faith gets a silent rejection, so the two must move
 * together. `maxLength` on each field is likewise aligned with the rule.
 */
const MAX_CLUBS = 5

export function blankClub(): ClubEntryInput {
  return { club: "", current: false }
}

function numberOrUndefined(value: string) {
  if (value.trim() === "") return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
}

const inputClass =
  "flex h-11 w-full rounded-xl border border-input bg-ink/60 px-3 text-sm placeholder:text-muted-foreground"

function Cell({
  label,
  children,
  className,
  hint,
}: {
  label: string
  children: ReactNode
  className?: string
  hint?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-mist/80">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-mist/60">{hint}</p>}
    </div>
  )
}

/**
 * Repeatable club-history editor.
 *
 * Deliberately a stack of compact blocks rather than a wizard: players fill this in on a
 * phone, and most will only ever add one or two clubs. Everything past the club name is
 * optional so an entry can be as quick as "Kaduna United, 2023/24".
 */
export function ClubHistoryEditor({
  value,
  onChange,
}: {
  value: ClubEntryInput[]
  onChange: (entries: ClubEntryInput[]) => void
}) {
  const update = (index: number, patch: Partial<ClubEntryInput>) =>
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)))

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index))

  /** Only one club can be current, so marking this one clears the flag everywhere else. */
  const markCurrent = (index: number, current: boolean) =>
    onChange(value.map((entry, i) => ({ ...entry, current: i === index ? current : false })))

  const atMax = value.length >= MAX_CLUBS

  return (
    <div className="space-y-4">
      {value.map((entry, index) => (
        <div key={index} className="rounded-2xl border border-line/15 bg-ink/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-stamp text-mist/70">
              Club {index + 1}
              {entry.current && <span className="ml-2 text-signal">· current</span>}
            </p>
            {value.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded-full p-1.5 text-mist/70 hover:bg-white/10 hover:text-signal"
                aria-label={`Remove club ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-3 space-y-3">
            <Cell label="Club name">
              <Input
                value={entry.club}
                maxLength={80}
                placeholder="e.g. Kaduna United"
                onChange={(e) => update(index, { club: e.target.value })}
              />
            </Cell>

            <div className="grid gap-3 sm:grid-cols-2">
              <Cell label="League">
                <Input value={entry.league ?? ""} maxLength={80} placeholder="e.g. NPFL" onChange={(e) => update(index, { league: e.target.value })} />
              </Cell>
              <Cell label="Division / tier">
                <Input
                  value={entry.division ?? ""}
                  maxLength={60}
                  placeholder="e.g. Division One"
                  onChange={(e) => update(index, { division: e.target.value })}
                />
              </Cell>
              <Cell label="Country">
                <Input
                  value={entry.country ?? ""}
                  maxLength={60}
                  placeholder="e.g. Nigeria"
                  onChange={(e) => update(index, { country: e.target.value })}
                />
              </Cell>
              <Cell label="Season(s)">
                <Input
                  value={entry.seasons ?? ""}
                  maxLength={40}
                  placeholder="e.g. 2023/24"
                  onChange={(e) => update(index, { seasons: e.target.value })}
                />
              </Cell>
              <Cell label="Level">
                <select
                  value={entry.level ?? ""}
                  onChange={(e) => update(index, { level: (e.target.value || undefined) as SignupClubLevel | undefined })}
                  className={inputClass}
                >
                  <option value="" className="bg-ink">
                    Not set
                  </option>
                  {SIGNUP_CLUB_LEVELS.map((level) => (
                    <option key={level} value={level} className="bg-ink">
                      {level}
                    </option>
                  ))}
                </select>
              </Cell>
              <Cell label="Position played">
                <select
                  value={entry.position ?? ""}
                  onChange={(e) => update(index, { position: (e.target.value || undefined) as ClubEntryInput["position"] })}
                  className={inputClass}
                >
                  <option value="" className="bg-ink">
                    Not set
                  </option>
                  {SIGNUP_POSITIONS.map((position) => (
                    <option key={position} value={position} className="bg-ink">
                      {position}
                    </option>
                  ))}
                </select>
              </Cell>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Cell label="Apps">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={entry.appearances ?? ""}
                  onChange={(e) => update(index, { appearances: numberOrUndefined(e.target.value) })}
                />
              </Cell>
              <Cell label="Goals">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={entry.goals ?? ""}
                  onChange={(e) => update(index, { goals: numberOrUndefined(e.target.value) })}
                />
              </Cell>
              <Cell label="Assists">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={entry.assists ?? ""}
                  onChange={(e) => update(index, { assists: numberOrUndefined(e.target.value) })}
                />
              </Cell>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line/15 px-3 py-2.5">
              <input
                type="checkbox"
                checked={!!entry.current}
                onChange={(e) => markCurrent(index, e.target.checked)}
                className="h-4 w-4 shrink-0 accent-signal"
              />
              <span className="text-sm">I play here now</span>
            </label>
          </div>
        </div>
      ))}

      {!atMax && (
        <Button type="button" variant="outline" onClick={() => onChange([...value, blankClub()])} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add another club
        </Button>
      )}
    </div>
  )
}
