import { readFile } from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"

export const OG_SIZE = { width: 1200, height: 630 }

type Assets = { logo: string; display: Buffer; body: Buffer }
let assets: Promise<Assets> | null = null
function loadAssets() {
  const file = (p: string) => readFile(path.join(process.cwd(), p))
  assets ??= Promise.all([file("public/ccfc-crest.png"), file("assets/fonts/archivo-condensed-900.ttf"), file("assets/fonts/archivo-600.ttf")]).then(
    ([logo, display, body]) => ({ logo: `data:image/png;base64,${logo.toString("base64")}`, display, body })
  )
  return assets
}

async function fetchImage(url?: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    const type = res.headers.get("content-type") ?? ""
    if (!res.ok || !/^image\/(png|jpe?g|gif)/.test(type)) return null
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`
  } catch {
    return null
  }
}

/** Branded 1200×630 share card: ink background, optional photo on the right, big condensed title. */
export async function ogCard({
  eyebrow,
  title,
  sub,
  image: imageUrl,
  score,
}: {
  eyebrow: string
  title: string
  sub?: string
  image?: string | null
  /**
   * A result to lead with, e.g. `9–10`. Rendered as a red line above the title.
   *
   * Written from Capital City's point of view. The direction is readable from the card itself: the
   * crest at the top names the club and the title names the opponent, so the score between them
   * reads as home–away.
   */
  score?: string
}) {
  const [{ logo, display, body }, image] = await Promise.all([loadAssets(), fetchImage(imageUrl)])
  // Longer titles wrap, so they step down to keep the card balanced rather than filling it.
  const titleSize = title.length > 40 ? 64 : title.length > 28 ? 84 : 112
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#07142E", color: "#F5F3EE", fontFamily: "Archivo" }}>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" width={560} height={630} style={{ position: "absolute", right: 0, top: 0, width: 560, height: 630, objectFit: "cover" }} />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: image ? "linear-gradient(90deg, #07142E 45%, rgba(7,20,46,0.55) 70%, rgba(7,20,46,0.1))" : "radial-gradient(circle at 85% 20%, #13295B 0%, #07142E 60%)",
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, width: 820 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="" width={72} height={72} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: 1 }}>CAPITAL CITY FC</span>
              <span style={{ fontSize: 18, color: "#9DB0D3", letterSpacing: 4 }}>FROM ABUJA. BUILT FOR THE WORLD.</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 24, color: "#E3262F", letterSpacing: 6, fontWeight: 600 }}>{eyebrow.toUpperCase()}</span>
            {score && (
              <span style={{ fontFamily: "Archivo Condensed", fontSize: 76, fontWeight: 900, lineHeight: 1.05, color: "#E3262F", letterSpacing: 2 }}>{score}</span>
            )}
            <span style={{ fontFamily: "Archivo Condensed", fontSize: titleSize, fontWeight: 900, lineHeight: 0.95, marginTop: score ? 4 : 12, textTransform: "uppercase" }}>{title}</span>
            {sub && <span style={{ fontSize: 30, color: "#C9D3E6", marginTop: 20 }}>{sub}</span>}
          </div>
          <div style={{ display: "flex", height: 6, width: 160, background: "#E3262F" }} />
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Archivo Condensed", data: display, weight: 900, style: "normal" },
        { name: "Archivo", data: body, weight: 600, style: "normal" },
      ],
    }
  )
}
