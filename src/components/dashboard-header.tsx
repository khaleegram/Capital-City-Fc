"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, LogOut, PanelLeft } from "lucide-react"
import { signOut } from "firebase/auth"
import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { auth } from "@/lib/firebase"

export function DashboardHeader() {
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()
  const { user } = useAuth()

  const crumbs = React.useMemo(() => {
    const parts = pathname.split("/").filter(Boolean)
    return parts.map((part, i) => ({
      href: "/" + parts.slice(0, i + 1).join("/"),
      label: i === 0 ? "Console" : decodeURIComponent(part).replace(/-/g, " "),
    }))
  }, [pathname])

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-white/10 bg-background/80 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={toggleSidebar}>
        <PanelLeft className="h-5 w-5" />
        <span className="sr-only">Toggle sidebar</span>
      </Button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={crumb.href}>
            {i > 0 && <ChevronRight className="mx-1 h-4 w-4 shrink-0" />}
            <Link
              href={crumb.href}
              className={`truncate capitalize transition-colors ${i === crumbs.length - 1 ? "font-medium text-foreground" : "hover:text-foreground"}`}
            >
              {crumb.label}
            </Link>
          </React.Fragment>
        ))}
      </nav>
      {user && (
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs text-mist/60 md:inline">{user.email}</span>
          <Button variant="outline" size="sm" onClick={() => signOut(auth)}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Sign out
          </Button>
        </div>
      )}
    </header>
  )
}
