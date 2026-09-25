"use client"

import { Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { MaintenancePage } from "@/components/maintenance-page"
import { MaintenanceBanner } from "@/components/maintenance-banner"

/**
 * Rendered only when maintenance is on (decided on the server). Signed-in staff
 * can still preview the site; everyone else sees the holding page.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-mist" />
      </div>
    )
  }
  if (!user) return <MaintenancePage />
  return (
    <>
      <MaintenanceBanner />
      {children}
    </>
  )
}
