"use client"

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { copy } from "@/lib/copy"
import { cn } from "@/lib/utils"

/** Tap a step to open it. Vertical stack on phones, horizontal track on desktop. */
export function PathwaySteps() {
  const steps = copy.pathway
  const [active, setActive] = useState(0)
  const reduce = useReducedMotion()

  return (
    <div>
      {/* Track */}
      <div className="relative">
        <div aria-hidden className="absolute left-[19px] top-5 bottom-5 w-px bg-line/10 md:left-5 md:right-5 md:top-[19px] md:bottom-auto md:h-px md:w-auto" />
        <ol role="tablist" aria-label={copy.home.pathwayEyebrow} className="relative flex flex-col gap-2 md:grid md:grid-cols-6 md:gap-3">
          {steps.map((step, i) => {
            const on = i === active
            const done = i < active
            return (
              <li key={step.key}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(i)}
                  className="group flex min-h-11 w-full items-center gap-4 text-left md:flex-col md:items-start md:gap-3"
                >
                  <span
                    className={cn(
                      "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold transition-colors",
                      /*
                        A completed step is green and the current one is the brand navy. They used
                        to be the same fill, so "the step you're on" and "the steps you've done"
                        were indistinguishable — the whole point of a numbered track.
                      */
                      on && "border-signal bg-signal text-white",
                      done && "border-win bg-win text-white",
                      !on && !done && "border-line/15 bg-paper text-mist/75 group-hover:border-line/40"
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "font-display text-2xl font-extrabold uppercase tracking-tight transition-colors font-condensed md:text-xl",
                      on ? "text-ivory" : "text-ivory/65 group-hover:text-ivory/80"
                    )}
                  >
                    {step.title}
                  </span>
                </button>
                {/* Mobile: body opens inline under the active step */}
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.p
                      key="body"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden pl-14 pr-2 text-base leading-relaxed text-mist/85 md:hidden"
                    >
                      <span className="block pb-3">{step.body}</span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ol>
      </div>
      {/* Desktop body panel */}
      <div className="mt-8 hidden min-h-[5rem] max-w-2xl md:block" aria-live="polite">
        <p className="font-mono text-[11px] uppercase tracking-stamp text-signal">
          Step {String(active + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
        </p>
        <p className="mt-2 text-xl leading-relaxed text-mist/90">{steps[active].body}</p>
      </div>
    </div>
  )
}
