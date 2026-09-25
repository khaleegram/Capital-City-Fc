import type { Achievement, Journey, Placement, ProofStats } from "./data"

export function computeProofStats(placements: Placement[], journeys: Journey[], achievements: Achievement[]): ProofStats {
  const abroad = placements.filter((p) => p.type === "signed" || p.type === "loan")
  return {
    playersAbroad: new Set(abroad.map((p) => p.playerId || p.playerName)).size,
    countries: new Set(placements.map((p) => p.country.trim().toLowerCase())).size,
    tournaments: journeys.filter((j) => j.kind === "international" && j.status !== "upcoming").length,
    unbeatenRuns: achievements.filter((a) => a.kind === "unbeaten").length,
  }
}

export function applyProofOverride(computed: ProofStats, override?: Partial<ProofStats> | null): ProofStats {
  const pick = (k: keyof ProofStats) => {
    const v = override?.[k]
    return typeof v === "number" && !Number.isNaN(v) ? v : computed[k]
  }
  return {
    playersAbroad: pick("playersAbroad"),
    countries: pick("countries"),
    tournaments: pick("tournaments"),
    unbeatenRuns: pick("unbeatenRuns"),
  }
}
