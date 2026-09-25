import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site-url"

/**
 * Crawl policy. `/admin` and `/api` stay out of the index; everything else is
 * open so Google can see the `noindex` directives we set per page (a blocked
 * URL can still get indexed "without content", so we allow + noindex instead).
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/admin/", "/api/"] },
      // Let the big crawlers spend their budget on real pages, not the dashboard.
      { userAgent: "Googlebot", allow: "/", disallow: ["/admin", "/api/"] },
      { userAgent: "Bingbot", allow: "/", disallow: ["/admin", "/api/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
