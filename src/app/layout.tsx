import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Providers } from "@/components/providers"
import { fontBody, fontDisplay, fontMono } from "@/lib/fonts"
import { siteUrl } from "@/lib/site-url"
import { copy } from "@/lib/copy"
import { cn } from "@/lib/utils"

const APP_NAME = "Capital City FC"
const APP_TITLE_TEMPLATE = "%s · Capital City FC"
const APP_DEFAULT_TITLE = `Capital City FC. ${copy.brand.masterLine}`
const APP_DESCRIPTION = copy.brand.descriptor

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: APP_NAME,
  title: { default: APP_DEFAULT_TITLE, template: APP_TITLE_TEMPLATE },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_NAME },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: { default: APP_DEFAULT_TITLE, template: APP_TITLE_TEMPLATE },
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: { default: APP_DEFAULT_TITLE, template: APP_TITLE_TEMPLATE },
    description: APP_DESCRIPTION,
  },
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
}

export const viewport: Viewport = {
  themeColor: "#F5F3EE",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn(fontDisplay.variable, fontBody.variable, fontMono.variable)}>
      <body className="min-h-svh bg-background font-body text-foreground antialiased">
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  )
}
