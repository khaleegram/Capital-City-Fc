"use client"

import { useState } from "react"
import type { Journey } from "@/lib/data"
import { Segmented } from "@/components/site/segmented"
import { JourneyCard } from "@/components/site/cards"

type Filter = "all" | "international" | "domestic" | "completed"

export function JourneyGrid({ journeys }: { journeys: Journey[] }) {
  const [filter, setFilter] = useState<Filter>("all")
  const shown = journeys.filter((j) =>
    filter === "all" ? true : filter === "completed" ? j.status === "completed" : j.kind === filter
  )
  return (
    <div className="space-y-6">
      <Segmented
        label="Filter journeys"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: journeys.length },
          { value: "international", label: "International", count: journeys.filter((j) => j.kind === "international").length },
          { value: "domestic", label: "Domestic", count: journeys.filter((j) => j.kind === "domestic").length },
          { value: "completed", label: "Completed", count: journeys.filter((j) => j.status === "completed").length },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((j) => (
          <JourneyCard key={j.id} journey={j} />
        ))}
      </div>
    </div>
  )
}
