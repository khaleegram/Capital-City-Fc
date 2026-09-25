"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, RotateCcw, Save } from "lucide-react"
import type { Achievement, Journey, Placement, ProofStats, TeamProfile } from "@/lib/data"
import { useCollection } from "@/lib/collections"
import { applyProofOverride, computeProofStats } from "@/lib/proof"
import { updateTeamProfile } from "@/lib/team"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/admin/ui"
import { ProofStrip } from "@/components/site/proof-strip"

const FIELDS: { key: keyof ProofStats; label: string }[] = [
  { key: "playersAbroad", label: "Signed abroad" },
  { key: "countries", label: "Countries reached" },
  { key: "tournaments", label: "Tournaments played" },
  { key: "unbeatenRuns", label: "Unbeaten campaigns" },
]

export function ProofStatsEditor({ profile }: { profile: TeamProfile }) {
  const { toast } = useToast()
  const { items: placements } = useCollection<Placement>("placements")
  const { items: journeys } = useCollection<Journey>("journeys")
  const { items: achievements } = useCollection<Achievement>("achievements")
  const [override, setOverride] = useState<Record<keyof ProofStats, string>>({
    playersAbroad: "",
    countries: "",
    tournaments: "",
    unbeatenRuns: "",
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const o = profile.proofStats ?? {}
    setOverride({
      playersAbroad: o.playersAbroad?.toString() ?? "",
      countries: o.countries?.toString() ?? "",
      tournaments: o.tournaments?.toString() ?? "",
      unbeatenRuns: o.unbeatenRuns?.toString() ?? "",
    })
  }, [profile.proofStats])

  // Only published records count, exactly like the public site.
  const computed = useMemo(
    () =>
      computeProofStats(
        placements.filter((p) => p.published),
        journeys.filter((j) => j.published),
        achievements.filter((a) => a.published)
      ),
    [placements, journeys, achievements]
  )

  const parsed = useMemo(() => {
    const out: Partial<ProofStats> = {}
    for (const f of FIELDS) {
      const n = parseInt(override[f.key], 10)
      if (!Number.isNaN(n) && n >= 0) out[f.key] = n
    }
    return out
  }, [override])

  const preview = applyProofOverride(computed, parsed)

  const save = async (value: Partial<ProofStats> | null) => {
    setBusy(true)
    try {
      await updateTeamProfile({ proofStats: value })
      toast({ title: "Saved", description: "Homepage proof strip updated." })
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't save", description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proof stats</CardTitle>
        <CardDescription>
          By default these numbers are counted from published placements, journeys and achievements. Enter a number only to override
          one; leave it blank to keep it automatic.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mist/60">Homepage preview</p>
          <ProofStrip stats={preview} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={`Automatic: ${computed[f.key]}`}>
              <Input
                inputMode="numeric"
                placeholder={String(computed[f.key])}
                value={override[f.key]}
                onChange={(e) => setOverride((o) => ({ ...o, [f.key]: e.target.value.replace(/[^0-9]/g, "") }))}
              />
            </Field>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => save(null)} disabled={busy}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Use automatic numbers
          </Button>
          <Button onClick={() => save(Object.keys(parsed).length ? parsed : null)} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save overrides
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
