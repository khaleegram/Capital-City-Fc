"use client"

import { usePathname } from "next/navigation"
import { ChevronRight, PanelLeft } from "lucide-react"

import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import React from "react"

export function DashboardHeader() {
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()

  const breadcrumbs = React.useMemo(() => {
    const pathParts = pathname.split('/').filter(part => part);
    const crumbs = pathParts.map((part, index) => {
      const href = '/' + pathParts.slice(0, index + 1).join('/');
      const label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
      return { href, label };
    });
    return [{ href: '/', label: 'Home' }, ...crumbs];
  }, [pathname]);


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={toggleSidebar}
      >
        <PanelLeft className="h-5 w-5" />
        <span className="sr-only">Toggle sidebar</span>
      </Button>
      
      <div className="flex items-center text-sm text-muted-foreground">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.href}>
            {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
            <Link 
              href={crumb.href}
              className={`transition-colors ${index === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'hover:text-foreground'}`}
            >
              {crumb.label}
            </Link>
          </React.Fragment>
        ))}
      </div>
    </header>
  )
}
