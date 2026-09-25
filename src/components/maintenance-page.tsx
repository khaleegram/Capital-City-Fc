import Image from "next/image"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { copy } from "@/lib/copy"
import { CoordStamp } from "@/components/brand/coord-stamp"
import { RouteLine } from "@/components/brand/route-line"

export function MaintenancePage() {
  return (
    <main className="on-dark relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center">
      <div aria-hidden className="absolute inset-0 bg-grid opacity-40" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-2/3 opacity-60">
        <RouteLine showLabels={false} />
      </div>
      <div className="relative space-y-6">
        <Image src={TEAM_LOGO_URL} alt={copy.brand.name} width={96} height={96} priority className="mx-auto h-24 w-24" />
        <h1 className="font-display text-5xl font-black uppercase leading-[0.9] tracking-tight font-condensed">
          {copy.maintenance.title}
        </h1>
        <p className="mx-auto max-w-sm text-mist/80">{copy.maintenance.body}</p>
        <CoordStamp code={copy.brand.origin.code} lat={copy.brand.origin.lat} lng={copy.brand.origin.lng} className="justify-center" />
      </div>
    </main>
  )
}
