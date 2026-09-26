"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, ArrowUp, Bot, Check, Eye, Loader2, Send, Sparkles, Square, Trash2, Wrench, X } from "lucide-react"

import { AdminPage } from "@/components/admin/ui"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAdmin } from "@/hooks/use-admin"
import { auth } from "@/lib/firebase"
import { runAgent } from "@/lib/agent/loop"
import type { AgentMessage } from "@/lib/agent/tools"

/**
 * The staff console's AI assistant.
 *
 * Talk to it in plain language and it acts on the club's database — records results, drafts match
 * reports, sets lineups, fixes statistics. Two things about this screen are deliberate:
 *
 * ## It shows its work
 *
 * Every tool call appears in the transcript as it happens, with what it acted on and what came
 * back. That is not decoration. The failure mode this guards against is an assistant that says
 * "done" and nothing happened, and the defence is that you can see each step. The prose is the
 * summary; the activity lines are the evidence. A declined or failed step is shown just as
 * prominently as a successful one.
 *
 * ## It refuses to do irreversible things alone
 *
 * When the model asks for a destructive tool the loop stops and a card appears here instead of
 * anything happening. The gate is in the loop, not in the prompt — see `src/lib/agent/loop.ts`.
 */

type Item =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "tool"; name: string; label: string; risk: string; summary?: string; ok?: boolean }
  | { id: string; kind: "error"; text: string }

type PendingConfirm = { name: string; label: string; args: unknown; description: string }

/** What each gated action actually does, in the operator's terms rather than the model's. */
const CONSEQUENCE: Record<string, string> = {
  delete_fixture: "Permanently removes the match, its report, its timeline and the player records it produced.",
  delete_article: "Permanently deletes the article and its image. This cannot be undone.",
  publish_article: "Puts the article on the public site immediately, where anyone can read it.",
  send_announcement: "Sends a push notification to every subscribed device right now. It cannot be recalled.",
}

const EXAMPLES = [
  "What needs doing today?",
  "Record the Sundbybergs IK match as 3-0 to us",
  "Draft a report for every match that's missing one",
  "How many appearances does Baba Saidu Audu have?",
  "Send an announcement that tickets for Saturday are on sale",
]

let seq = 0
const nextId = () => `item-${++seq}`

/** "record_result" → "Record result", for the activity line. */
const humanise = (name: string) => name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())

/** The args, as a compact one-liner, so the activity line says what it acted on. */
function argsLine(args: unknown): string {
  if (!args || typeof args !== "object") return ""
  return Object.entries(args as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join(" · ")
    .slice(0, 220)
}

function riskIcon(name: string, risk: string) {
  if (risk === "destructive") {
    if (name.startsWith("delete")) return Trash2
    if (name === "publish_article") return Eye
    return AlertTriangle
  }
  if (risk === "read") return Eye
  return Wrench
}

export default function AssistantPage() {
  const { admin } = useAdmin()
  const { toast } = useToast()

  const [items, setItems] = useState<Item[]>([])
  const [input, setInput] = useState("")
  const [running, setRunning] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  /** The wire transcript. Kept out of state because it is only ever read by the next request. */
  const history = useRef<AgentMessage[]>([])
  /** Resolves the promise the loop is awaiting while a confirmation card is on screen. */
  const approval = useRef<((ok: boolean) => void) | null>(null)
  const abort = useRef<AbortController | null>(null)
  const bottom = useRef<HTMLDivElement | null>(null)
  const composer = useRef<HTMLTextAreaElement | null>(null)

  const append = useCallback((item: Item) => setItems((prev) => [...prev, item]), [])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [items, pending])

  // Whether the model is reachable, so the screen can say so before the first message rather than
  // failing on it.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/agent", {
          headers: { Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
        })
        const data = (await res.json().catch(() => ({}))) as { configured?: boolean }
        if (!cancelled) setConfigured(res.ok ? Boolean(data.configured) : false)
      } catch {
        if (!cancelled) setConfigured(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const confirm = useCallback(
    (request: PendingConfirm) =>
      new Promise<boolean>((resolve) => {
        approval.current = resolve
        setPending(request)
      }),
    []
  )

  const answer = (ok: boolean) => {
    approval.current?.(ok)
    approval.current = null
    setPending(null)
    // A decline needs no line of its own: the loop reports it back as the tool's outcome, and a
    // second entry here would say the same thing twice.
  }

  const send = async () => {
    const text = input.trim()
    if (!text || running) return

    setInput("")
    append({ id: nextId(), kind: "user", text })
    setRunning(true)
    const controller = new AbortController()
    abort.current = controller

    // The loop is sequential: tool-start is always followed by its tool-end, so the last running
    // line is the one being resolved.
    const settle = (summary: string, ok: boolean) =>
      setItems((prev) => {
        const idx = [...prev].reverse().findIndex((i) => i.kind === "tool" && i.summary === undefined)
        if (idx === -1) return [...prev, { id: nextId(), kind: "tool", name: "", label: summary, risk: "write", ok, summary }]
        const at = prev.length - 1 - idx
        const copy = [...prev]
        copy[at] = { ...(copy[at] as Item & { kind: "tool" }), summary: `"${summary}"`, ok }
        return copy
      })

    try {
      const transcript = await runAgent({
        history: history.current,
        input: text,
        operator: { name: auth.currentUser?.displayName || auth.currentUser?.email || undefined, role: admin?.role },
        signal: controller.signal,
        confirm,
        onEvent: (event) => {
          switch (event.type) {
            case "reply":
              append({ id: nextId(), kind: "assistant", text: event.text })
              break
            case "tool-start":
              append({
                id: nextId(),
                kind: "tool",
                name: event.name,
                label: `${humanise(event.name)} — ${argsLine(event.args)}`,
                risk: event.risk,
              })
              break
            case "tool-end":
              settle(event.summary, event.ok)
              break
            case "error":
              append({ id: nextId(), kind: "error", text: event.message })
              break
            default:
              break
          }
        },
      })
      // The transcript already opens with the user's message, so it appends cleanly.
      history.current = [...history.current, ...transcript]
    } catch (err) {
      append({ id: nextId(), kind: "error", text: (err as Error).message })
    } finally {
      setRunning(false)
      abort.current = null
      setPending(null)
      approval.current = null
      composer.current?.focus()
    }
  }

  const stop = () => {
    abort.current?.abort()
    // A destructive call waiting on approval must not be left hanging when the run is stopped.
    approval.current?.(false)
    approval.current = null
    setPending(null)
  }

  const reset = () => {
    stop()
    setItems([])
    history.current = []
    setInput("")
  }

  return (
    <AdminPage
      title="Assistant"
      description="Ask for anything the console can do — record a result, draft a report, set a lineup, fix statistics. Every action it takes is listed below as it happens."
      actions={
        items.length > 0 ? (
          <Button variant="outline" size="sm" onClick={reset} disabled={running}>
            Clear
          </Button>
        ) : null
      }
    >
      {configured === false && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-loss" />
          <p>
            The assistant has no model configured. Add <code className="rounded bg-muted px-1">DEEPSEEK_API_KEY</code> to
            this deployment&apos;s environment and redeploy.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-line/15 bg-card">
        <div className="max-h-[62vh] min-h-[280px] space-y-3 overflow-y-auto p-4 sm:p-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Sparkles className="mb-3 h-7 w-7 text-signal" />
              <p className="font-display text-lg font-semibold">What should I do?</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                I act on the live database as you. Anything that can&apos;t be undone will ask you first.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setInput(example)
                      composer.current?.focus()
                    }}
                    className="min-h-9 rounded-full border border-line/20 px-3 text-xs text-mist/85 hover:border-line/45"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            items.map((item) => <ItemRow key={item.id} item={item} />)
          )}

          {pending && (
            <div className="rounded-xl border border-loss/45 bg-loss/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-loss" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Confirm before this runs</p>
                  <p className="mt-1 text-sm text-mist/85">
                    {CONSEQUENCE[pending.name] ?? "This action cannot be undone."}
                  </p>
                  <p className="mt-2 break-words font-mono text-[11px] uppercase tracking-stamp text-mist/70">
                    {argsLine(pending.args) || humanise(pending.name)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="destructive" onClick={() => answer(true)}>
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Yes, do it
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => answer(false)}>
                      <X className="mr-1.5 h-3.5 w-3.5" /> No
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {running && !pending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Working…
            </div>
          )}

          <div ref={bottom} />
        </div>

        <div className="border-t border-line/15 p-3 sm:p-4">
          <div className="flex items-end gap-2">
            <Textarea
              ref={composer}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder={pending ? "Answer the confirmation above first…" : "Record a result, draft a report, set a lineup…"}
              rows={2}
              disabled={running || Boolean(pending)}
              className="min-h-[52px] resize-none"
            />
            {running ? (
              <Button variant="outline" onClick={stop} title="Stop">
                <Square className="h-4 w-4" />
                <span className="sr-only">Stop</span>
              </Button>
            ) : (
              <Button onClick={() => void send()} disabled={!input.trim() || Boolean(pending)}>
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Enter to send, Shift+Enter for a new line. It acts as you, so it can only do what you can.
          </p>
        </div>
      </div>
    </AdminPage>
  )
}

/** One bubble or one activity line. */
function ItemRow({ item }: { item: Item }) {
  if (item.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-signal/15 px-4 py-2.5 text-sm whitespace-pre-wrap">
          {item.text}
        </div>
      </div>
    )
  }

  if (item.kind === "assistant") {
    return (
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <Bot className="h-4 w-4 text-signal" />
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-line/15 bg-muted/40 px-4 py-2.5 text-sm whitespace-pre-wrap">
          {item.text}
        </div>
      </div>
    )
  }

  if (item.kind === "error") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-loss/40 bg-loss/10 px-3 py-2.5 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-loss" />
        <p className="whitespace-pre-wrap">{item.text}</p>
      </div>
    )
  }

  const Icon = riskIcon(item.name, item.risk)
  const done = item.summary !== undefined
  // A failure and a success must not look alike: one is evidence, the other is a correction to make.
  const failed = done && item.ok === false

  return (
    <div className="flex items-start gap-3 pl-10 text-xs">
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          failed ? "bg-loss/20" : done ? "bg-win/20" : "bg-muted"
        }`}
      >
        {done && !failed ? (
          <Check className="h-3 w-3 text-win" />
        ) : failed ? (
          <X className="h-3 w-3 text-loss" />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Icon className="h-3 w-3" />
          <span className="break-words">{item.label}</span>
          {item.risk === "destructive" && (
            <Badge variant="outline" className="border-loss/50 text-[9px] text-loss">
              irreversible
            </Badge>
          )}
        </p>
        {done && <p className={`mt-1 whitespace-pre-wrap ${failed ? "text-loss" : "text-mist/85"}`}>{item.summary}</p>}
      </div>
    </div>
  )
}
