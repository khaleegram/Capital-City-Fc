"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Home, Newspaper, Search, Users, Video } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Icons } from "@/components/icons"
import { Chatbot } from "@/components/chatbot"

const menuItems = [
  { href: "/", label: "Dashboard", icon: Home, tooltip: "Dashboard" },
  { href: "/players", label: "Players", icon: Users, tooltip: "Players" },
  { href: "/news", label: "News", icon: Newspaper, tooltip: "News" },
  { href: "/videos", label: "Videos", icon: Video, tooltip: "Videos" },
  { href: "/summaries", label: "Summaries", icon: FileText, tooltip: "Summaries" },
  { href: "/scouting", label: "Scouting", icon: Search, tooltip: "Scouting" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Icons.logo className="size-7 text-primary" />
            <h1 className="text-xl font-headline font-semibold text-primary group-data-[collapsible=icon]:hidden">
              Capital City Hub
            </h1>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href}>
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
    </SidebarProvider>
  )
}
