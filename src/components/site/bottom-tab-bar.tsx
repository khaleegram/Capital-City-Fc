"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { LayoutGrid, Lock } from "lucide-react"
import { copy } from "@/lib/copy"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { CoordStamp } from "@/components/brand/coord-stamp"
import { isActivePath, moreNav, primaryNav } from "./nav-items"

export function BottomTabBar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const moreActive = moreNav.some((i) => isActivePath(pathname, i.href))

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line/10 bg-canvas/90 pb-safe backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {primaryNav.map((item) => {
            const active = isActivePath(pathname, item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                    active ? "text-ivory" : "text-mist/74"
                  )}
                >
                  {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-signal" />}
                  <item.icon className={cn("h-5 w-5", active && "text-signal")} strokeWidth={active ? 2.4 : 1.8} />
                  {item.label}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              className={cn(
                "relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                moreActive ? "text-ivory" : "text-mist/74"
              )}
            >
              {moreActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-signal" />}
              <LayoutGrid className={cn("h-5 w-5", moreActive && "text-signal")} strokeWidth={moreActive ? 2.4 : 1.8} />
              {copy.nav.more}
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="px-5 pt-5">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line/20" aria-hidden />
          <SheetTitle className="font-condensed text-2xl uppercase">{copy.nav.more}</SheetTitle>
          <SheetDescription className="sr-only">More destinations</SheetDescription>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {moreNav.map((item) => {
              const active = isActivePath(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-[4.5rem] flex-col justify-between rounded-2xl border p-3 transition-colors",
                      active ? "border-signal/60 bg-signal/10" : "border-line/10 bg-line/[0.03] active:bg-line/[0.07]"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", active ? "text-signal" : "text-mist")} />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </Link>
                </li>
              )
            })}
            <li>
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex min-h-[4.5rem] flex-col justify-between rounded-2xl border border-dashed border-line/15 p-3 text-mist/70"
              >
                <Lock className="h-5 w-5" />
                <span className="text-sm font-semibold">{copy.nav.admin}</span>
              </Link>
            </li>
          </ul>
          <div className="mt-6 flex items-center justify-between border-t border-line/10 pt-4">
            <CoordStamp code={copy.brand.origin.code} lat={copy.brand.origin.lat} lng={copy.brand.origin.lng} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mist/72">{copy.brand.short}</span>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
