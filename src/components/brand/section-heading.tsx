import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 font-mono text-[11px] uppercase tracking-stamp text-mist/70",
        className
      )}
    >
      <span aria-hidden className="h-px w-6 bg-signal" />
      {children}
    </p>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  href,
  hrefLabel = "View all",
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string
  title: string
  body?: string
  href?: string
  hrefLabel?: string
  className?: string
  as?: "h1" | "h2" | "h3"
}) {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-2xl space-y-3">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <Tag
          className={cn(
            "font-display font-bold leading-[0.95] tracking-tight text-ivory font-condensed uppercase",
            Tag === "h1" ? "text-5xl sm:text-6xl md:text-7xl" : "text-4xl sm:text-5xl"
          )}
        >
          {title}
        </Tag>
        {body && <p className="max-w-xl text-base leading-relaxed text-mist/80">{body}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-ivory md:self-auto"
        >
          {hrefLabel}
          <ArrowUpRight className="h-4 w-4 text-signal transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}
