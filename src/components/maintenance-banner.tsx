import { AlertTriangle } from "lucide-react"

export function MaintenanceBanner() {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 flex md:bottom-0 items-center justify-center gap-2 bg-signal px-3 py-2 text-center text-xs font-semibold text-white">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>Maintenance mode is on. The public sees a holding page.</span>
    </div>
  )
}
