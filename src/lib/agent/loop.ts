"use client"

/**
 * The agent loop.
 *
 * Reads the model's intent from the server, executes the tools in the browser, feeds the results
 * back, and repeats until the model answers in prose. This is the piece that turns a chat model
 * into something that can actually finish a job, and it is deliberately small and linear so the
 * control flow is auditable: every step is either a model call, a tool call, or a stop.
 *
 * ## Three stops, and why each matters
 *
 *   - **final text** — the model is done.
 *   - **a tool failed** — recorded, and handed back to the model as text so it can correct itself.
 *     An agent that dies on the first bad argument is useless; one that silently retries forever is
 *     worse. It gets the error and a bounded number of further attempts.
 *   - **a destructive tool** — the loop stops and asks. Nothing irreversible happens without a
 *     person clicking, whatever the model says or however the conversation is phrased. This is
 *     enforced here, in the loop, and not by instruction in the prompt: the model is asked nicely
 *     to call the tool and let the console gate it, but the gate does not depend on that.
 *
 * ## The step ceiling
 *
 * `MAX_STEPS` bounds a single request. It exists because the two failure modes of a loop — a model
 * that keeps re-reading the same data, and a bug that makes a tool always fail — both look like a
 * hang and both cost money per iteration. Hitting the ceiling is reported to the person rather than
 * passed off as an answer.
 */

import { auth } from "@/lib/firebase"
import { EXECUTORS, ToolFailure } from "./tool-executors"
import { TOOL_BY_NAME, type AgentMessage, type ToolCall, type ToolOutcome } from "./tools"

/** How many model↔tool rounds one request may take before the loop gives up and says so. */
const MAX_STEPS = 12

export type AgentEvent =
  /** The model replied in prose. */
  | { type: "reply"; text: string }
  /** About to run a tool. `risk` is what the UI styles it by. */
  | { type: "tool-start"; name: string; label: string; risk: string; args: unknown }
  /** A tool finished. `summary` is the human-readable outcome. */
  | { type: "tool-end"; name: string; summary: string; ok: boolean }
  /** A tool needs the person's approval before it may run. */
  | { type: "confirm"; call: ToolCall; name: string; label: string; args: unknown; description: string }
  /** The loop stopped without a final answer. */
  | { type: "error"; message: string }

export type AgentRunOptions = {
  /** Prior conversation, minus the system prompt. */
  history: AgentMessage[]
  /** The person's new message. */
  input: string
  operator?: { name?: string; role?: string }
  /** Gate for irreversible actions. Returning false skips the call and tells the model so. */
  confirm: (request: { name: string; label: string; args: unknown; description: string }) => Promise<boolean>
  onEvent: (event: AgentEvent) => void
  signal?: AbortSignal
}

/** A tool's arguments may arrive as malformed JSON; that is a message for the model, not a crash. */
function parseArgs(raw: string): unknown {
  if (!raw?.trim()) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new ToolFailure(`The arguments were not valid JSON: ${raw.slice(0, 200)}`)
  }
}

/** One line describing a call, for the activity feed before it runs. */
function describeCall(name: string, parsed: unknown): string {
  if (!parsed || typeof parsed !== "object") return name
  const a = parsed as Record<string, unknown>
  const key = ["fixture", "player", "article", "opponent", "headline"].find((k) => typeof a[k] === "string")
  return key ? `${name} · ${a[key]}` : name
}

async function callModel(messages: AgentMessage[], operator: AgentRunOptions["operator"], signal?: AbortSignal) {
  const res = await fetch("/api/admin/agent", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      // Same token the rest of the admin uses; the route checks it against `admins/{uid}`.
      Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
    },
    body: JSON.stringify({ messages, operator }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    kind?: "text" | "tools"
    text?: string
    calls?: ToolCall[]
    error?: string
  }

  if (!res.ok) throw new Error(data.error || `The assistant request failed (${res.status}).`)
  return data
}

/**
 * Runs one request to completion, emitting events as it goes.
 *
 * Returns the full transcript including the assistant's tool turns, so the caller can keep the
 * conversation — the model needs its own prior calls in context or it will repeat work it has
 * already done.
 */
export async function runAgent({
  history,
  input,
  operator,
  confirm,
  onEvent,
  signal,
}: AgentRunOptions): Promise<AgentMessage[]> {
  // `assistant` is the running transcript for this request only.
  const assistant: AgentMessage[] = [{ role: "user", content: input }]

  for (let step = 0; step < MAX_STEPS; step++) {
    let response
    try {
      response = await callModel([...history, ...assistant], operator, signal)
    } catch (err) {
      // A stop is a deliberate act, not a failure — reporting it as an error would be noise.
      if (signal?.aborted) return assistant
      onEvent({ type: "error", message: (err as Error).message })
      return assistant
    }

    if (response.kind === "text" || !response.calls?.length) {
      const text = (response.text ?? "").trim()
      if (text) onEvent({ type: "reply", text })
      // The assistant's final turn carries no tool_calls, so it is safe to replay verbatim.
      if (text) assistant.push({ role: "assistant", content: text })
      return assistant
    }

    // Record the model's own call turn before answering it, so the next request is consistent.
    assistant.push({ role: "assistant", content: response.text ?? "", tool_calls: response.calls })

    for (const call of response.calls) {
      const spec = TOOL_BY_NAME.get(call.name)
      let outcome: ToolOutcome
      let parsed: unknown = undefined

      if (!spec) {
        // A tool that doesn't exist. Reported, not guessed at, so a model that misremembers a
        // name corrects itself on the next turn.
        outcome = { ok: false, summary: `There is no tool called "${call.name}".` }
      } else {
        try {
          parsed = parseArgs(call.arguments)
        } catch (err) {
          outcome = { ok: false, summary: (err as Error).message }
        }

        if (parsed !== undefined) {
          const label = describeCall(call.name, parsed)

          if (spec.risk === "destructive") {
            const approved = await confirm({
              name: call.name,
              label,
              args: parsed,
              description: spec.description,
            })
            if (!approved) {
              outcome = {
                ok: false,
                summary: `The person declined to run "${call.name}". Do not retry it unless they ask again.`,
              }
            } else {
              onEvent({ type: "tool-start", name: call.name, label, risk: spec.risk, args: parsed })
              outcome = await execute(call.name, parsed)
            }
          } else {
            onEvent({ type: "tool-start", name: call.name, label, risk: spec.risk, args: parsed })
            outcome = await execute(call.name, parsed)
          }
        } else {
          outcome = outcome!
        }
      }

      onEvent({ type: "tool-end", name: call.name, summary: outcome.summary, ok: outcome.ok })
      assistant.push({
        role: "tool",
        tool_call_id: call.id,
        // The model reads this, so it carries the outcome as text plus any structured detail it
        // needs for a follow-up call. Kept terse: this is charged per token, every turn.
        content: JSON.stringify({
          ok: outcome.ok,
          summary: outcome.summary,
          ...(outcome.data !== undefined ? { data: outcome.data } : {}),
        }),
      })
    }
  }

  onEvent({
    type: "error",
    message: `The assistant stopped after ${MAX_STEPS} steps without finishing. What it did is in the activity log above.`,
  })
  return assistant
}

/** Runs one tool, converting any throw into an outcome the model can read and act on. */
async function execute(name: string, parsed: unknown): Promise<ToolOutcome> {
  const executor = EXECUTORS[name]
  if (!executor) return { ok: false, summary: `"${name}" is described but not implemented.` }
  try {
    return await executor(parsed)
  } catch (err) {
    if (err instanceof ToolFailure) return { ok: false, summary: err.message }
    // A real bug. Logged for us, reported to the model so it doesn't retry blindly.
    console.error(`[ccfc] tool ${name} failed:`, err)
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, summary: `That failed: ${message}` }
  }
}
