import { Building2, CalendarDays, Clapperboard, Home, Images, Mail, Newspaper, Route, Users, type LucideIcon } from "lucide-react"
import { copy } from "@/lib/copy"

export type NavItem = { href: string; label: string; icon: LucideIcon }

export const primaryNav: NavItem[] = [
  { href: "/", label: copy.nav.home, icon: Home },
  { href: "/journeys", label: copy.nav.journeys, icon: Route },
  { href: "/players", label: copy.nav.players, icon: Users },
  { href: "/media", label: copy.nav.media, icon: Clapperboard },
]

export const moreNav: NavItem[] = [
  { href: "/club", label: copy.nav.club, icon: Building2 },
  { href: "/fixtures", label: copy.nav.fixtures, icon: CalendarDays },
  { href: "/news", label: copy.nav.stories, icon: Newspaper },
  { href: "/gallery", label: copy.nav.gallery, icon: Images },
  { href: "/contact", label: copy.nav.contact, icon: Mail },
]

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}
