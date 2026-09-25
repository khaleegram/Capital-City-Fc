"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ExternalLink } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
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
import { MaintenanceBanner } from "@/components/maintenance-banner"
import { TEAM_LOGO_URL } from "@/lib/brand"
import { useFcm } from "@/hooks/use-fcm"
import { adminNav } from "./admin-nav"
import { useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

function AdminSidebar() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/admin" onClick={() => setOpenMobile(false)} className="flex items-center gap-2.5">
          <Image src={TEAM_LOGO_URL} alt="" width={28} height={28} className="size-7" />
          <span className="font-display text-lg font-extrabold uppercase leading-none font-condensed group-data-[collapsible=icon]:hidden">
            CCFC <span className="text-signal">Staff</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {adminNav.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.2em]">{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="View public site">
              <Link href="/" target="_blank">
                <ExternalLink />
                <span>View public site</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  useFcm()
  const [maintenance, setMaintenance] = useState(false)
  useEffect(
    () => onSnapshot(doc(db, "teamProfile", "main_profile"), (s) => setMaintenance(!!s.data()?.maintenanceMode), () => {}),
    []
  )

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="bg-background">
        <DashboardHeader />
        <main className="pb-16">{children}</main>
        {maintenance && <MaintenanceBanner />}
        <Chatbot />
      </SidebarInset>
    </SidebarProvider>
  )
}
