"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowUpRight } from "lucide-react"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { copy } from "@/lib/copy"
import { cn } from "@/lib/utils"
import { LiveDot } from "@/components/brand/live-dot"
import { isActivePath, moreNav, primaryNav } from "./nav-items"

export type LiveJourneyLink = { slug: string; title: string } | null

/**
 * How far the page has to move before the bar takes on a surface.
 *
 * This used to be 8px, which meant a stray trackpad nudge turned the bar white with a
 * visible hairline while the hero still filled the screen — it read as an unwanted band
 * rather than a scrolled header. Roughly one header height is the point at which the
 * change actually communicates something.
 */
const SOLID_AT_SCROLL_Y = 48

export function SiteHeader({ live }: { live: LiveJourneyLink }) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SOLID_AT_SCROLL_Y)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const desktopLinks = [...primaryNav.slice(1), ...moreNav.filter((i) => i.href !== "/contact")]

  /*
   * The homepage hero is the only dark ground the header floats over — every other public
   * route opens on ivory. At rest that decides whether the bar carries light or ink text;
   * once scrolled it is a solid ivory bar either way, so it always goes back to ink.
   */
  const overDarkHero = pathname === "/"

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        /*
         * At rest the bar is fully transparent — no wash behind it — so it sits on the hero
         * rather than reading as a white band. It only gains a surface once the page moves,
         * at which point ivory text over ivory content would be unreadable anyway.
         */
        scrolled ? "border-b border-line/10 bg-canvas/85 backdrop-blur-xl" : cn("border-b border-transparent", overDarkHero && "on-dark")
      )}
    >
      <div className="container flex h-14 items-center gap-4 md:h-16">
        <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label={`${copy.brand.name} home`}>
          <Image src={TEAM_LOGO_URL} alt="" width={32} height={32} priority className="h-8 w-8" />
          <span className="font-display text-[15px] font-extrabold uppercase leading-none tracking-tight font-condensed">
            Capital City <span className="text-signal">FC</span>
          </span>
        </Link>

        {live && (
          <Link
            href={`/journeys/${live.slug}`}
            className="ml-auto flex min-h-11 items-center gap-2 rounded-full border border-live/40 bg-live/10 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory md:ml-4"
          >
            <LiveDot />
            <span className="max-w-[9rem] truncate md:max-w-[14rem]">{live.title}</span>
          </Link>
        )}

        <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 md:flex">
          {desktopLinks.map((item) => {
            const active = isActivePath(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-3 py-2 text-sm font-medium text-mist/80 transition-colors hover:text-ivory",
                  active && "text-ivory"
                )}
              >
                {item.label}
                {active && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-signal" />}
              </Link>
            )
          })}
          <Link
            href="/contact"
            className="ml-2 inline-flex h-10 items-center gap-1.5 rounded-full bg-signal px-4 text-sm font-semibold text-signal-foreground transition hover:bg-signal-soft"
          >
            {copy.nav.contact}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
