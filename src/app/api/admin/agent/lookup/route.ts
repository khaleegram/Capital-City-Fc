import { NextResponse } from "next/server"

import { assertAdmin } from "@/lib/server/verify-admin"

/** Wikipedia is reached over `fetch`, but the Firebase verification is easier on Node. */
export const runtime = "nodejs"

/**
 * The assistant's one window onto the outside world.
 *
 * ## Why it is this narrow
 *
 * Everything else the assistant does comes from the club's own database, which means every answer
 * is traceable to a record and every write is covered by Firestore's rules. Opening a general web
 * search would put unverified text into a conversation that ends in database writes — a model that
 * has just read a random page is a model more likely to invent a score or a date with confidence.
 *
 * So this asks a single, named source a single kind of question: what is this football club? The
 * answer is a Wikipedia summary, attributed and linked, and the assistant is instructed to treat it
 * as background rather than as fact about Capital City.
 *
 * ## Why it lives on the server
 *
 * Two reasons. The request goes to a third party and carries this deployment's identity, which is
 * not something a browser should be doing on the club's behalf. And the results are cached per
 * query for a day, which is only possible where the cache lives — a client-side call would hit
 * Wikipedia again for every operator who asked the same question.
 */

/** Wikipedia asks callers to identify themselves; requests without this are rate-limited. */
const USER_AGENT = "CapitalCityFC-Assistant/1.0 (https://capitalcityfc.com; staff console lookup)"

const MAX_QUERY = 120

type WikipediaSummary = {
  title?: string
  description?: string
  extract?: string
  type?: string
  thumbnail?: { source?: string }
  coordinates?: { lat?: number; lon?: number }
  content_urls?: { desktop?: { page?: string } }
}

/** Searches Wikipedia and returns the best page title for the query. */
async function findTitle(query: string): Promise<string | null> {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: "1",
      format: "json",
      origin: "*",
    }).toString()

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // A day. Club names and their countries do not change; the same question asked by five staff
    // members should cost one request.
    next: { revalidate: 86_400 },
  })
  if (!res.ok) return null

  const data = (await res.json().catch(() => null)) as
    | { query?: { search?: { title?: string }[] } }
    | null
  return data?.query?.search?.[0]?.title ?? null
}

/** The plain-text summary of a page, if it is a real article rather than a disambiguation list. */
async function summaryFor(title: string): Promise<WikipediaSummary | null> {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 86_400 },
  })
  if (!res.ok) return null
  return (await res.json().catch(() => null)) as WikipediaSummary | null
}

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  try {
    await assertAdmin(bearer)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Staff access required."
    const status = message === "Staff access required." ? 403 : 401
    return NextResponse.json({ error: message }, { status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const query = String((body as { query?: unknown })?.query ?? "").trim()
  if (!query) return NextResponse.json({ error: "`query` is required." }, { status: 400 })
  if (query.length > MAX_QUERY) return NextResponse.json({ error: "That query is too long." }, { status: 400 })

  try {
    const title = await findTitle(query)
    if (!title) return NextResponse.json({ found: false, query })

    const summary = await summaryFor(title)
    if (!summary || summary.type === "disambiguation" || !summary.extract) {
      // A disambiguation page is not an answer, and neither is an empty one. Reported as "not
      // found" so the assistant says it could not confirm rather than quoting a list of clubs.
      return NextResponse.json({ found: false, query })
    }

    return NextResponse.json({
      found: true,
      query,
      title: summary.title ?? title,
      // Usually one line placing the club, e.g. "Football club in Gothenburg, Sweden" — which is
      // often where the country the person asked about actually comes from.
      description: summary.description ?? null,
      extract: summary.extract,
      url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      thumbnail: summary.thumbnail?.source ?? null,
      coordinates: summary.coordinates ?? null,
      source: "Wikipedia",
    })
  } catch (err) {
    console.error("[ccfc] club lookup failed:", err)
    // 502: the assistant is fine, the thing it depends on is not.
    return NextResponse.json({ error: "The lookup service could not be reached." }, { status: 502 })
  }
}
