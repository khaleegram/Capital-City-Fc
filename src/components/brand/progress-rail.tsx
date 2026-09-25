import { cn } from "@/lib/utils"

export type RailStep = {
  key: string
  title: string
  caption?: string
  state: "done" | "current" | "next"
}

/** Vertical on mobile, horizontal from md up. */
export function ProgressRail({
  steps,
  className,
  forceVertical = false,
}: {
  steps: RailStep[]
  className?: string
  forceVertical?: boolean
}) {
  return (
    <ol
      className={cn(
        "relative flex flex-col gap-0",
        !forceVertical && "md:flex-row md:gap-0",
        className
      )}
    >
      {steps.map((step, i) => {
        const last = i === steps.length - 1
        return (
          <li
            key={step.key}
            className={cn(
              "relative flex gap-4 pb-7",
              !forceVertical && "md:flex-1 md:flex-col md:gap-3 md:pb-0 md:pr-4",
              last && "pb-0"
            )}
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-px",
                  !forceVertical && "md:left-6 md:top-[11px] md:h-px md:w-[calc(100%-1.5rem)]",
                  step.state === "done" ? "bg-signal" : "bg-line/15"
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                step.state === "done" && "border-signal bg-signal",
                step.state === "current" && "border-signal bg-paper",
                step.state === "next" && "border-line/20 bg-paper"
              )}
            >
              {step.state === "current" && (
                <>
                  <span className="absolute h-2.5 w-2.5 rounded-full bg-signal animate-live-pulse" />
                  <span className="h-2.5 w-2.5 rounded-full bg-signal" />
                </>
              )}
              {step.state === "done" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "font-display text-base font-semibold leading-tight",
                  step.state === "next" ? "text-ivory/70" : "text-ivory"
                )}
              >
                {step.title}
              </p>
              {step.caption && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-mist/75">
                  {step.caption}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
