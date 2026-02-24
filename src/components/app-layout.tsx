
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Newspaper, Users, Video, Calendar, Trophy, Shield, Bot, LayoutDashboard, Building, Menu, X, Loader2 } from "lucide-react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"

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
import { Button } from "./ui/button"
import { LoginDialog } from "./login-dialog"
import { cn } from "@/lib/utils"
import { MaintenancePage } from "./maintenance-page"
import { MaintenanceBanner } from "./maintenance-banner"
import { Separator } from "./ui/separator"

const publicMenuItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/club", label: "Club", icon: Building },
  { href: "/players", label: "Players", icon: Users },
  { href: "/fixtures", label: "Fixtures", icon: Calendar },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/videos", label: "Videos", icon: Video },
];

const adminMenuItems = [
  { href: "/", label: "Dashboard", icon: Home, tooltip: "Dashboard" },
  { href: "/players", label: "Players", icon: Users, tooltip: "Players" },
  { href: "/news", label: "News", icon: Newspaper, tooltip: "News" },
  { href: "/videos", label: "Videos", icon: Video, tooltip: "Videos" },
  { href: "/fixtures", label: "Fixtures", icon: Calendar, tooltip: "Fixtures" },
  { href: "/recaps", label: "Recaps", icon: Trophy, tooltip: "Recaps" },
  { href: "/formations", label: "Formations", icon: LayoutDashboard, tooltip: "Formations" },
  { href: "/scouting", label: "Scouting", icon: Bot, tooltip: "Scouting" },
  { href: "/team-settings", label: "Team Settings", icon: Shield, tooltip: "Team Profile" },
];


function PublicNavbar({ teamProfile }: { teamProfile: TeamProfile | null }) {
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={cn(
            "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
            isScrolled || isMobileMenuOpen ? "bg-background/80 backdrop-blur-lg border-b" : "bg-transparent border-b border-transparent"
        )}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-20">
                    <Link href="/" className="flex items-center gap-2">
                        <Image src={teamProfile?.logoUrl || "/icon.png"} alt="Team Logo" width={32} height={32} />
                        <span className="font-headline text-2xl font-semibold">{teamProfile?.name}</span>
                    </Link>

                    <div className="hidden md:flex items-center gap-2">
                        {publicMenuItems.map(item => (
                            <Button key={item.href} asChild variant={pathname === item.href ? "secondary" : "ghost"}>
                                <Link href={item.href}>{item.label}</Link>
                            </Button>
                        ))}
                         <div className="ml-4">
                             <LoginDialog />
                         </div>
                    </div>
                    
                    <div className="md:hidden">
                        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                            {isMobileMenuOpen ? <X/> : <Menu/>}
                            <span className="sr-only">Toggle Menu</span>
                        </Button>
                    </div>
                </div>
            </div>
            
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="md:hidden border-t"
                    >
                        <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
                            {publicMenuItems.map(item => (
                                <Button key={item.href} asChild variant={pathname === item.href ? "secondary" : "ghost"} onClick={() => setIsMobileMenuOpen(false)}>
                                    <Link href={item.href} className="flex justify-start gap-4 text-lg py-6">
                                        <item.icon />
                                        {item.label}
                                    </Link>
                                </Button>
                            ))}
                            <Separator className="my-4" />
                            <LoginDialog />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
}

function AdminLayout({ children, teamProfile }: { children: React.ReactNode, teamProfile: TeamProfile | null }) {
    const pathname = usePathname()
    const { setOpenMobile } = useSidebar()
    
    const isActive = (href: string) => {
        if (href === "/") return pathname === href
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
                        {adminMenuItems.map((item) => (
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
                {teamProfile?.maintenanceMode && <MaintenanceBanner />}
                <DashboardHeader />
                <main>{children}</main>
                <Chatbot />
            </SidebarInset>
        </>
    )
}

function PublicLayout({ children, teamProfile }: { children: React.ReactNode, teamProfile: TeamProfile | null }) {
    return (
        <div className="flex flex-col min-h-svh">
            <PublicNavbar teamProfile={teamProfile} />
            <main className="flex-1 pt-20">{children}</main>
            <Chatbot />
        </div>
    )
}

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true);
  useFcm();

  useEffect(() => {
    const fetchProfile = async () => {
      const profile = await getTeamProfile();
      setTeamProfile(profile);
      setProfileLoading(false);
    }
    fetchProfile();
  }, [])

  if (authLoading || profileLoading) {
      return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )
  }
  
  if (teamProfile?.maintenanceMode && !user) {
    return <MaintenancePage profile={teamProfile} />;
  }

  if (user) {
    return <AdminLayout teamProfile={teamProfile}>{children}</AdminLayout>
  }
  
  return <PublicLayout teamProfile={teamProfile}>{children}</PublicLayout>
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </SidebarProvider>
  )
}
