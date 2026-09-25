import Image from "next/image"
import Link from "next/link"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { copy } from "@/lib/copy"
import { CoordStamp } from "@/components/brand/coord-stamp"
import { moreNav, primaryNav } from "./nav-items"
import type { TeamProfile } from "@/lib/data"

export function SiteFooter({ team }: { team: TeamProfile }) {
  const socials = Object.entries(team.socials ?? {}).filter(([, url]) => !!url) as [string, string][]
  return (
    <footer className="on-dark relative mt-24 overflow-hidden border-t border-line/10 bg-ink pb-28 pt-14 md:pb-14">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-40 mask-fade-b" />
      <div className="container relative">
        <p className="font-display text-[13vw] font-black uppercase leading-[0.85] tracking-tight text-ivory/[0.06] font-condensed md:text-[7rem]">
          {copy.footer.line}
        </p>

        <div className="mt-10 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Image src={TEAM_LOGO_URL} alt="" width={44} height={44} className="h-11 w-11" />
              <div>
                <p className="font-display text-lg font-extrabold uppercase leading-none font-condensed">{copy.brand.name}</p>
                <p className="mt-1 text-sm text-mist/70">{copy.brand.descriptor}</p>
              </div>
            </div>
            <CoordStamp code={copy.brand.origin.code} lat={copy.brand.origin.lat} lng={copy.brand.origin.lng} />
            <address className="space-y-1 text-sm not-italic text-mist/70">
              <p>{copy.brand.address}</p>
              <p>
                <a className="hover:text-ivory" href={`mailto:${copy.brand.email}`}>
                  {copy.brand.email}
                </a>
                {" · "}
                <a className="hover:text-ivory" href={`tel:${copy.brand.phone.replace(/\s/g, "")}`}>
                  {copy.brand.phone}
                </a>
              </p>
            </address>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:col-span-2 md:grid-cols-3">
            {[...primaryNav.slice(1), ...moreNav].map((item) => (
              <Link key={item.href} href={item.href} className="flex min-h-11 items-center text-mist/80 hover:text-ivory">
                {item.label}
              </Link>
            ))}
            <Link href="/admin" className="flex min-h-11 items-center text-mist/72 hover:text-ivory">
              {copy.nav.admin}
            </Link>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line/10 pt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-mist/72 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {copy.brand.legal}. {copy.footer.rights}
          </p>
          {socials.length > 0 && (
            <ul className="flex gap-4">
              {socials.map(([name, url]) => (
                <li key={name}>
                  <a href={url} target="_blank" rel="noreferrer" className="hover:text-ivory">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  )
}
