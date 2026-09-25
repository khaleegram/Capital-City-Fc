import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { Providers } from "@/components/providers"
import { fontBody, fontDisplay, fontMono } from "@/lib/fonts"
import {
  BING_SITE_VERIFICATION,
  GOOGLE_SITE_VERIFICATION,
  HOME_DESCRIPTION,
  HOME_TITLE,
  SITE_GEO,
  SITE_KEYWORDS,
  SITE_LOCALE,
  SITE_NAME,
  YANDEX_SITE_VERIFICATION,
  absoluteUrl,
} from "@/lib/seo"
import { siteUrl } from "@/lib/site-url"
import { cn } from "@/lib/utils"

const APP_NAME = SITE_NAME
const APP_TITLE_TEMPLATE = `%s · ${SITE_NAME}`
const APP_DEFAULT_TITLE = HOME_TITLE
const APP_DESCRIPTION = HOME_DESCRIPTION

/**
 * Root metadata. Note: no `openGraph.images` / `twitter.images` here on purpose —
 * that lets Next inject the file-based `app/opengraph-image.tsx` card, and any
 * page that sets its own image still wins.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: APP_NAME,
  title: { default: APP_DEFAULT_TITLE, template: APP_TITLE_TEMPLATE },
  description: APP_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  category: "Sports",
  authors: [{ name: SITE_NAME, url: absoluteUrl("/") }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_NAME },
  formatDetection: { telephone: false },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Search Console / Bing / Yandex ownership tokens. Only emitted when set.
  verification: {
    google: GOOGLE_SITE_VERIFICATION,
    other: {
      ...(BING_SITE_VERIFICATION ? { "msvalidate.01": BING_SITE_VERIFICATION } : {}),
      ...(YANDEX_SITE_VERIFICATION ? { "yandex-verification": YANDEX_SITE_VERIFICATION } : {}),
    },
  },
  // Legacy geo meta tags: still read by some local/AI crawlers.
  other: {
    "geo.region": SITE_GEO.regionCode,
    "geo.placename": SITE_GEO.city,
    "geo.position": `${SITE_GEO.lat};${SITE_GEO.lng}`,
    ICBM: `${SITE_GEO.lat}, ${SITE_GEO.lng}`,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    // No `title.template` here on purpose: page helpers pass `{ absolute }` titles,
    // and a template would append `· Capital City FC` a second time.
    title: APP_DEFAULT_TITLE,
    description: APP_DESCRIPTION,
    locale: SITE_LOCALE,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_DEFAULT_TITLE,
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
