require("dotenv").config()
import type { NextConfig } from "next"

const withPWA = require("next-pwa")({
  dest: "public",
  importScripts: ["/firebase-messaging-sw.js"],
  disable: process.env.NODE_ENV === "development",
})

type RemotePatterns = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>

const https = (hostname: string) => ({ protocol: "https" as const, hostname, port: "", pathname: "/**" })

const remotePatterns: RemotePatterns = [
  https("placehold.co"),
  https("picsum.photos"),
  https("firebasestorage.googleapis.com"),
  https("i.ytimg.com"),
  https("img.youtube.com"),
  https("i.vimeocdn.com"),
  https("lh3.googleusercontent.com"),
  /*
   * R2 public buckets, by wildcard rather than by the configured hostname.
   *
   * The block below derives the host from R2_PUBLIC_URL, which only works where that
   * variable is actually present in the environment doing the build. Vercel builds read
   * their own environment, not a .env.local, so when the variable was scoped to
   * Development and not Production every stored image 400'd with
   * INVALID_IMAGE_OPTIMIZE_REQUEST — the optimizer rejects a host that the loader had
   * happily emitted a /_next/image url for, because the two read different configs.
   *
   * A wildcard cannot drift out of sync with the data. Stored URLs point at whatever
   * bucket was configured when they were uploaded, so a hardcoded host is one bucket
   * migration away from the same outage. Every r2.dev bucket is public read-only, so
   * widening the pattern to all of them costs nothing.
   */
  https("**.r2.dev"),
  /*
   * The club's own domains, so an R2 custom domain can be switched on without a code change.
   *
   * A custom domain in front of the bucket is the main speed fix for images — r2.dev is
   * Cloudflare's development endpoint and serves HTTP/1.1 only, with no edge caching. But the
   * host would arrive through `R2_PUBLIC_URL`, which is exactly the variable that failed to
   * reach the image allowlist and caused the outage this wildcard exists to prevent.
   *
   * These are domains the club owns, so allowing any of their subdomains as an image source
   * is free of risk and means pointing `cdn.` at the bucket is a DNS change rather than a
   * config-and-redeploy change.
   */
  https("**.capitalcityfc.ng"),
  https("**.capitalcity.ng"),
]

for (const url of [process.env.R2_PUBLIC_URL, process.env.NEXT_PUBLIC_R2_PUBLIC_URL]) {
  if (!url) continue
  try {
    const host = new URL(url).hostname
    if (!remotePatterns.some((p) => typeof p === "object" && "hostname" in p && p.hostname === host)) {
      remotePatterns.push(https(host))
    }
  } catch {
    console.warn(`[next.config] Ignoring invalid R2 URL: ${url}`)
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
    formats: ["image/avif", "image/webp"],
    /*
     * Every image in this app is immutable once uploaded: the uploader names objects with a
     * random UUID, so replacing a photo writes a new URL rather than overwriting the old one.
     * The default of four hours with `must-revalidate` therefore bought nothing and cost a
     * round trip — each returning visitor revalidated every optimised variant, and a cold
     * optimiser re-fetched and re-encoded from R2.
     *
     * A year lets Vercel's cache and the browser hold the encoded variants. Nothing is lost
     * when an image is replaced, because the replacement is a different URL.
     */
    minimumCacheTTL: 31536000,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  serverExternalPackages: ["firebase-admin"],
  outputFileTracingIncludes: {
    "/**/opengraph-image*": ["./assets/fonts/**", "./public/ccfc-crest.png"],
  },
  async redirects() {
    /*
     * Both www.capitalcity.ng and capitalcity.ng are attached to this project
     * and serve identical content with no redirect between them, so search
     * engines see two copies of every page and pick a winner themselves.
     * Collapse www onto whichever origin NEXT_PUBLIC_SITE_URL declares as
     * canonical (see src/lib/site-url.ts).
     */
    const canonicalHost = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://capitalcity.ng").hostname
      } catch {
        return "capitalcity.ng"
      }
    })()

    return [
      // Skipped when www is itself the canonical origin, so this can never loop.
      ...(canonicalHost.startsWith("www.")
        ? []
        : [
            {
              source: "/:path*",
              has: [{ type: "host" as const, value: `www.${canonicalHost}` }],
              destination: `https://${canonicalHost}/:path*`,
              permanent: true,
            },
          ]),
      { source: "/videos", destination: "/media", permanent: true },
      { source: "/videos/:id", destination: "/media/:id", permanent: true },
      { source: "/recaps", destination: "/fixtures", permanent: true },
      { source: "/team-settings", destination: "/admin/settings", permanent: true },
      { source: "/formations", destination: "/admin/formations", permanent: true },
      { source: "/scouting", destination: "/admin/scouting", permanent: true },
      { source: "/stories", destination: "/news", permanent: false },
    ]
  },
}

module.exports = withPWA(nextConfig)
