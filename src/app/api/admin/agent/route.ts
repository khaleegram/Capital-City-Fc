import { NextResponse } from "next/server"

import { assertAdmin } from "@/lib/server/verify-admin"
import { completeChat, hasModelKey, ModelUnavailable, type ChatMessage } from "@/lib/server/agent-model"
import { openAiTools } from "@/lib/agent/tools"
import { systemPrompt } from "@/lib/agent/system-prompt"

/** DeepSeek is reached over `fetch`, but the Firebase verification is easier on Node. */
export const runtime = "nodejs"

/**
 * One turn of the admin assistant. Stateless by design.
 *
 * The browser sends the whole conversation and gets back either a final reply or the next batch of
 * tool calls. The tools themselves are executed in the browser — see `src/lib/agent/loop.ts` for
 * why — so this route only ever brokers the model call. That keeps the DeepSeek key server-side
 * while every database write still happens under the operator's own Firestore permissions, which
 * is what stops the assistant from being more powerful than the person using it.
 *
 * ## Request size is bounded
 *
 * The conversation is attacker-controlled in the sense that it arrives from a browser, and it is
 * paid for on every turn. So it is capped before it reaches the model. The limits are generous for
 * real use — a long working session is nowhere near them — and only exist so a runaway loop cannot
 * bill an unbounded amount.
 */

const MAX_MESSAGES = 60
const MAX_CONTENT = 20_000
const MAX_TOTAL = 200_000

const ROLES = new Set(["user", "assistant", "tool"])

type IncomingMessage = { role: string; content?: unknown; tool_call_id?: unknown; tool_calls?: unknown }

function parseMessages(raw: unknown): ChatMessage[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "`messages` must be an array." }
  if (raw.length > MAX_MESSAGES) return { error: `A conversation may carry at most ${MAX_MESSAGES} messages.` }

  let total = 0
  const out: ChatMessage[] = []

  for (const entry of raw as IncomingMessage[]) {
    if (!entry || typeof entry !== "object") return { error: "Each message must be an object." }
    const role = String(entry.role ?? "")
    if (!ROLES.has(role)) return { error: `Unsupported role "${role}".` }
    const content = typeof entry.content === "string" ? entry.content : ""
    if (content.length > MAX_CONTENT) return { error: "A message was too long." }
    total += content.length
    if (total > MAX_TOTAL) return { error: "The conversation is too long." }

    if (role === "tool") {
      if (typeof entry.tool_call_id !== "string" || !entry.tool_call_id) {
        return { error: "A tool message must carry `tool_call_id`." }
      }
      out.push({ role: "tool", content, tool_call_id: entry.tool_call_id })
      continue
    }

    if (role === "assistant" && Array.isArray(entry.tool_calls) && entry.tool_calls.length) {
      // Echoed straight back to the model as the assistant's own turn, so the shape has to survive
      // the round trip intact or the tool results won't line up with their calls.
      out.push({ role: "assistant", content, tool_calls: entry.tool_calls as unknown[] })
      continue
    }

    out.push({ role: role as "user" | "assistant", content })
  }

  return out
}

/** Whether the assistant is usable, so the console can say so before the first message. */
export async function GET(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  try {
    await assertAdmin(bearer)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Staff access required."
    return NextResponse.json({ error: message }, { status: message === "Staff access required." ? 403 : 401 })
  }
  return NextResponse.json({ configured: hasModelKey() })
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

  const parsed = parseMessages((body as { messages?: unknown })?.messages)
  if ("error" in parsed) return NextResponse.json(parsed, { status: 400 })

  const operator = (body as { operator?: { name?: string; role?: string } })?.operator ?? {}

  try {
    const result = await completeChat(
      [{ role: "system", content: systemPrompt(new Date().toISOString().slice(0, 10), operator) }, ...parsed],
      openAiTools()
    )

    return NextResponse.json(
      result.kind === "tools"
        ? { kind: "tools", text: result.text, calls: result.calls }
        : { kind: "text", text: result.text }
    )
  } catch (err) {
    const message = err instanceof ModelUnavailable ? err.message : "The assistant could not reach the model."
    if (!(err instanceof ModelUnavailable)) console.error("[ccfc] agent model call failed:", err)
    // 502: the assistant is fine, the thing it depends on is not. The console shows this verbatim.
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
