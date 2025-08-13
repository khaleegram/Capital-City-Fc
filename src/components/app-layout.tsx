"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Newspaper, Users, Video, Calendar, Trophy, Shield, Bot, Search } from "lucide-react"
import Image from "next/image"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Chatbot } from "@/components/chatbot"
import { useAuth } from "@/hooks/use-auth"
import { useFcm } from "@/hooks/use-fcm"
import { useEffect, useState } from "react"
import { getTeamProfile } from "@/lib/team"
import { TeamProfile } from "@/lib/data"

const publicMenuItems = [
  { href: "/", label: "Home", icon: Home, tooltip: "Home" },
  { href: "/players", label: "Players", icon: Users, tooltip: "Players" },
  { href: "/news", label: "News", icon: Newspaper, tooltip: "News" },
  { href: "/videos", label: "Videos", icon: Video, tooltip: "Videos" },
  { href: "/fixtures", label: "Fixtures", icon: Calendar, tooltip: "Fixtures" },
];

const adminMenuItems = [
  { href: "/", label: "Dashboard", icon: Home, tooltip: "Dashboard" },
  { href: "/players", label: "Players", icon: Users, tooltip: "Players" },
  { href: "/news", label: "News", icon: Newspaper, tooltip: "News" },
  { href: "/videos", label: "Videos", icon: Video, tooltip: "Videos" },
  { href: "/fixtures", label: "Fixtures", icon: Calendar, tooltip: "Fixtures" },
  { href: "/recaps", label: "Recaps", icon: Trophy, tooltip: "Recaps" },
  { href: "/team", label: "Team", icon: Shield, tooltip: "Team Profile" },
];

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const { user } = useAuth()
  const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(null)
  useFcm();

  useEffect(() => {
    const fetchProfile = async () => {
      const profile = await getTeamProfile();
      setTeamProfile(profile);
    }
    fetchProfile();
  }, [])

  const menuItems = user ? adminMenuItems : publicMenuItems;

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  const handleLinkClick = () => {
    setOpenMobile(false)
  }

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4">
          <Link href="/" onClick={handleLinkClick} className="flex items-center gap-2.5">
            <Image src={teamProfile?.logoUrl || "/icon.png"} alt="Team Logo" width={28} height={28} className="size-7" />
            <h1 className="text-xl font-headline font-semibold text-primary group-data-[collapsible=icon]:hidden">
              Capital City Hub
            </h1>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} onClick={handleLinkClick}>
                  <SidebarMenuButton 
                    isActive={isActive(item.href)}
                    tooltip={{ children: item.tooltip, side: "right", align: "center" }}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <DashboardHeader />
        <main>{children}</main>
        <Chatbot />
      </SidebarInset>
    </>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </SidebarProvider>
  )
}
