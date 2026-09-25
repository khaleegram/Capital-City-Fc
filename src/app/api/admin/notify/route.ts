import { NextResponse } from "next/server"

import { assertAdmin } from "@/lib/server/verify-admin"
import { sendPushToAll } from "@/lib/server/notify"

/** firebase-admin needs the Node.js runtime, not Edge. */
export const runtime = "nodejs"

/**
 * Sends a push notification to every subscribed device.
 *
 * This replaces the `sendCustomNotification` Cloud Function (called from the admin
 * composer) and the Firestore onCreate triggers for live matches and news, which Vercel
 * cannot run. Callers now request the notification explicitly after a successful write.
 */
export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")

  try {
    await assertAdmin(bearer)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Staff access required."
    const status = message === "Staff access required." ? 403 : 401
    return NextResponse.json({ error: message }, { status })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 })
  }

  const { title, body, url, data } = (payload ?? {}) as {
    title?: unknown
    body?: unknown
    url?: unknown
    data?: unknown
  }

  if (typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Both title and body are required." }, { status: 400 })
  }

  // FCM only accepts string values in a data payload.
  const extra: Record<string, string> = { url: typeof url === "string" && url ? url : "/" }
  if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (typeof value === "string") extra[key] = value
    }
  }

  try {
    const result = await sendPushToAll(title.trim(), body.trim(), extra)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send notifications."
    console.error("[ccfc] push notification failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
