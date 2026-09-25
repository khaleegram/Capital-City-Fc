import { cn } from "@/lib/utils"
import { Eyebrow } from "@/components/brand/section-heading"
import { GrainOverlay } from "@/components/brand/grain-overlay"

/** Compact top-of-page header shared by public index pages. */
export function PageHero({
  eyebrow,
  title,
  body,
  children,
  className,
}: {
  eyebrow: string
  title: string
  body?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("relative overflow-hidden border-b border-line/10 bg-horizon pb-10 pt-24 md:pb-14 md:pt-32", className)}>
      <div aria-hidden className="absolute inset-0 bg-grid opacity-50 mask-fade-b" />
      <GrainOverlay />
      <div className="container relative">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 max-w-4xl font-display text-[13vw] font-black uppercase leading-[0.86] tracking-tight font-condensed text-balance sm:text-6xl md:text-7xl lg:text-8xl">
          {title}
        </h1>
        {body && <p className="mt-5 max-w-xl text-base leading-relaxed text-mist/85 sm:text-lg">{body}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  )
}
