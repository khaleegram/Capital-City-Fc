"use client"

import { cn } from "@/lib/utils"

/** Horizontal scrollable chip group, 44px tall targets. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; count?: number }[]
  className?: string
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("-mx-5 flex gap-2 overflow-x-auto px-5 scrollbar-none md:mx-0 md:px-0", className)}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
              on ? "border-signal bg-signal text-white" : "border-line/15 text-mist/80 hover:border-line/40 hover:text-ivory"
            )}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span className={cn("font-mono text-[10px]", on ? "text-signal-foreground/80" : "text-mist/72")}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
