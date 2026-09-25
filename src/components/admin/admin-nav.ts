import {
  Award,
  Bot,
  Building2,
  CalendarDays,
  Clapperboard,
  Images,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  Newspaper,
  Plane,
  Route,
  Settings,
  ShieldCheck,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react"

export type AdminNavGroup = { label: string; items: { href: string; label: string; icon: LucideIcon }[] }

export const adminNav: AdminNavGroup[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Pathway",
    items: [
      { href: "/admin/journeys", label: "Journeys", icon: Route },
      { href: "/admin/placements", label: "Placements", icon: Plane },
      { href: "/admin/players", label: "Players", icon: Users },
      { href: "/admin/staff", label: "Staff", icon: Building2 },
      { href: "/admin/achievements", label: "Achievements", icon: Award },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/media", label: "Media library", icon: Clapperboard },
      { href: "/admin/galleries", label: "Galleries", icon: Images },
      { href: "/admin/news", label: "Stories", icon: Newspaper },
    ],
  },
  {
    label: "Matchday",
    items: [
      { href: "/admin/fixtures", label: "Fixtures & live", icon: CalendarDays },
      { href: "/admin/recaps", label: "Recaps", icon: Trophy },
      { href: "/admin/formations", label: "Formations", icon: LayoutGrid },
    ],
  },
  {
    label: "Club",
    items: [
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
      { href: "/admin/scouting", label: "Scouting AI", icon: Bot },
      { href: "/admin/settings", label: "Settings & proof", icon: Settings },
      { href: "/admin/users", label: "Admin users", icon: ShieldCheck },
    ],
  },
]
