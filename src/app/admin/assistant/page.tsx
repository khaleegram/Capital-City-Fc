"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  Bot,
  Check,
  Eye,
  History,
  Loader2,
  MessageSquarePlus,
  Mic,
  MoreVertical,
  Paperclip,
  Send,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Wrench,
  X,
} from "lucide-react"

import { AdminPage } from "@/components/admin/ui"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { useAdmin } from "@/hooks/use-admin"
import { auth } from "@/lib/firebase"
import { uploadFile } from "@/lib/admin-client"
import { runAgent } from "@/lib/agent/loop"
import type { AgentMessage } from "@/lib/agent/tools"
import type { Attachment } from "@/lib/agent/tool-executors"
import {
  createSession,
  deleteSession,
  listSessions,
  loadSession,
  renameSession,
  saveTurn,
  titleFrom,
  type Session,
  type StoredItem,
} from "@/lib/agent/sessions"
import { getAction, isUndoable, listActions, undoAction, undoNote, type JournalEntry } from "@/lib/agent/journal"

/**
 * The staff console's AI assistant.
 *
 * Talk to it in plain language and it acts on the club's database — records results, drafts match
 * reports, attaches footage, sets lineups, fixes statistics. Four things about this screen are
 * deliberate:
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
 *
 * ## Everything it changes can be taken back
 *
 * Each change is journalled before it happens, so undo restores the records involved to exactly
 * what they were. The button sits on the line for the change it reverses, and the history dialog
 * lists everything from this conversation — including the changes that genuinely cannot be
 * reversed, which say so rather than offering a button that would lie.
 *
 * ## Conversations are kept
 *
 * The transcript and the model's own history are written to Firestore as each turn completes, so
 * closing the tab, reloading, or coming back tomorrow loses nothing. The sidebar is those saved
 * conversations, and reopening one resumes a usable context rather than a read-only transcript.
 */

type Item =
  | { id: string; kind: "user"; text: string; files?: string[] }
  | { id: string; kind: "assistant"; text: string }
  | {
      id: string
      kind: "tool"
      name: string
      label: string
      risk: string
      summary?: string
      ok?: boolean
      /** Set once the change has been journalled and can be reversed. */
      actionId?: string
      undoable?: boolean
      undoNote?: string
      undone?: boolean
    }
  | { id: string; kind: "error"; text: string }

type PendingConfirm = { name: string; label: string; args: unknown; description: string }

/** What each gated action actually does, in the operator's terms rather than the model's. */
const CONSEQUENCE: Record<string, string> = {
  delete_fixture:
    "Removes the match, its report, its timeline and the player records it produced. You can undo this afterwards, but the opponent's crest file will be gone for good.",
  delete_article: "Deletes the article and its image. You can undo this afterwards.",
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

/** A one-line label for a saved conversation. */
function whenLabel(value: unknown): string {
  const ms =
    value && typeof value === "object" && "seconds" in (value as Record<string, unknown>)
      ? Number((value as { seconds: number }).seconds) * 1000
      : typeof value === "string"
        ? Date.parse(value)
        : NaN
  if (Number.isNaN(ms)) return ""
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export default function AssistantPage() {
  const { admin } = useAdmin()
  const { toast } = useToast()

  const [items, setItems] = useState<Item[]>([])
  const [input, setInput] = useState("")
  const [running, setRunning] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loadingSession, setLoadingSession] = useState(false)

  const [files, setFiles] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState("")

  const [historyOpen, setHistoryOpen] = useState(false)
  const [actions, setActions] = useState<JournalEntry[]>([])
  const [busyAction, setBusyAction] = useState<string | null>(null)

  /** The wire transcript. Kept out of state because it is only ever read by the next request. */
  const history = useRef<AgentMessage[]>([])
  /** Resolves the promise the loop is awaiting while a confirmation card is on screen. */
  const approval = useRef<((ok: boolean) => void) | null>(null)
  const abort = useRef<AbortController | null>(null)
  const bottom = useRef<HTMLDivElement | null>(null)
  const composer = useRef<HTMLTextAreaElement | null>(null)
  const picker = useRef<HTMLInputElement | null>(null)
  const recognition = useRef<{ stop: () => void; start: () => void } | null>(null)
  /** The activity line a tool-end resolves, so the saved transcript matches what is on screen. */
  const runningRow = useRef<{ name: string; label: string; risk: string } | null>(null)

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

  /* ── saved conversations ────────────────────────────────────────────────── */

  const refreshSessions = useCallback(async () => {
    const uid = auth.currentUser?.uid
    try {
      setSessions(await listSessions(uid))
    } catch (err) {
      console.warn("[ccfc] could not list conversations:", err)
    }
  }, [])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  const openSession = useCallback(
    async (id: string) => {
      if (running) return
      setLoadingSession(true)
      try {
        const { wire, items: stored } = await loadSession(id)
        history.current = wire
        setItems(
          stored.map((s) => {
            // Stored items have no client id; the sequence restarts each load, which is fine —
            // these are only React keys.
            const base = { id: nextId() }
            return { ...(s as Omit<StoredItem, never>), ...base } as unknown as Item
          })
        )
        setSessionId(id)
        setFiles([])
        setInput("")
      } catch (err) {
        toast({ variant: "destructive", title: "Could not open that conversation", description: (err as Error).message })
      } finally {
        setLoadingSession(false)
      }
    },
    [running, toast]
  )

  const newConversation = () => {
    if (running) return
    // Created on the first message rather than here, so an abandoned "New chat" leaves no empty
    // row in the sidebar.
    setSessionId(null)
    setItems([])
    history.current = []
    setFiles([])
    setInput("")
    composer.current?.focus()
  }

  const removeConversation = async (id: string) => {
    try {
      await deleteSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (sessionId === id) newConversation()
      toast({ title: "Conversation deleted" })
    } catch (err) {
      toast({ variant: "destructive", title: "Could not delete it", description: (err as Error).message })
    }
  }

  const rename = async (id: string, current: string) => {
    const title = window.prompt("Name this conversation", current)
    if (!title || title === current) return
    try {
      await renameSession(id, title)
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)))
    } catch (err) {
      toast({ variant: "destructive", title: "Could not rename it", description: (err as Error).message })
    }
  }

  /* ── confirmation gate ──────────────────────────────────────────────────── */

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

  /* ── attachments ────────────────────────────────────────────────────────── */

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return
    setUploading(true)
    try {
      /*
       * Uploaded here rather than by a tool, because the model cannot transmit a file.
       *
       * By the time the message is sent every file has a URL, so a tool only has to name it and
       * receive that URL — the alternative would put whole videos in the conversation transcript,
       * charged per token on every subsequent turn.
       */
      for (const file of Array.from(list)) {
        const url = await uploadFile(file, "assistant")
        setFiles((prev) => [
          ...prev,
          {
            name: file.name,
            url,
            type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file",
          },
        ])
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Upload failed", description: (err as Error).message })
    } finally {
      setUploading(false)
      if (picker.current) picker.current.value = ""
    }
  }

  /* ── voice ──────────────────────────────────────────────────────────────── */

  const toggleVoice = () => {
    if (listening) {
      recognition.current?.stop()
      setListening(false)
      return
    }

    /*
     * Uses the browser's own speech recognition, which in Chrome sends audio to a Google service.
     * That is worth knowing before pressing the button, so the tooltip says so rather than leaving
     * someone to discover it.
     */
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike
      webkitSpeechRecognition?: new () => SpeechRecognitionLike
    }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Ctor) {
      toast({
        variant: "destructive",
        title: "This browser can't take dictation",
        description: "Chrome and Edge can. Type instead, or use your system's own dictation.",
      })
      return
    }

    const rec = new Ctor()
    rec.lang = "en-NG"
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (event) => {
      let text = ""
      for (let i = event.resultIndex; i < event.results.length; i++) text += event.results[i][0].transcript
      /*
       * Only finalised speech is committed to the box.
       *
       * With `interimResults` on, the engine re-sends its current guess for the phrase in progress
       * as it changes its mind. Appending every one of those would leave "record the, record the
       * match, record the match against" in the composer; so interim guesses show as a preview
       * below the box and only settled words are added to it.
       */
      const isFinal = event.results[event.results.length - 1]?.isFinal
      if (isFinal) setInput((prev) => `${prev}${text} `)
      else setInterim(text)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => {
      setListening(false)
      setInterim("")
    }
    recognition.current = rec
    rec.start()
    setListening(true)
  }

  /* ── undo ───────────────────────────────────────────────────────────────── */

  const loadActions = useCallback(async () => {
    // A conversation with no id has no changes of its own yet, so the dialog shows nothing rather
    // than every change made in the console — which would read as if they belonged to this chat.
    if (!sessionId) {
      setActions([])
      return
    }
    try {
      setActions(await listActions({ sessionId, limit: 60 }))
    } catch (err) {
      console.warn("[ccfc] could not read the change history:", err)
    }
  }, [sessionId])

  useEffect(() => {
    if (historyOpen) void loadActions()
  }, [historyOpen, loadActions])

  /**
   * Reverses one journalled change and marks the transcript line it belongs to.
   *
   * A line in the transcript only carries the entry's id, so the entry itself is fetched first —
   * undo needs the recorded before-images, and the id is all the UI kept.
   */
  const runUndoById = async (actionId: string) => {
    setBusyAction(actionId)
    try {
      const entry = await getAction(actionId)
      if (!entry) {
        toast({ variant: "destructive", title: "That change is no longer recorded" })
        setActions((prev) => prev.filter((a) => a.id !== actionId))
        return
      }
      await runUndo(entry)
    } finally {
      setBusyAction(null)
    }
  }

  const runUndo = async (entry: JournalEntry) => {
    setBusyAction(entry.id)
    try {
      const result = await undoAction(entry)
      if (!result.ok) {
        toast({ variant: "destructive", title: "Could not undo that", description: result.message })
        return
      }
      setItems((prev) =>
        prev.map((i) => (i.kind === "tool" && i.actionId === entry.id ? { ...i, undone: true } : i))
      )
      setActions((prev) => prev.map((a) => (a.id === entry.id ? { ...a, undone: true } : a)))
      toast({ title: "Undone", description: result.message })
      // The model's transcript no longer describes the database, so it is told. Without this it
      // would answer follow-ups from a picture that undo has just contradicted.
      history.current = [
        ...history.current,
        {
          role: "user",
          content: `[Console note: the change "${entry.summary}" was just undone from the history panel. The database has been restored to how it was before it. Do not repeat it unless asked again.]`,
        },
      ]
    } catch (err) {
      toast({ variant: "destructive", title: "Could not undo that", description: (err as Error).message })
    } finally {
      setBusyAction(null)
    }
  }

  /* ── sending ────────────────────────────────────────────────────────────── */

  const send = async () => {
    const text = input.trim()
    if ((!text && !files.length) || running) return

    // The visible message says what was attached, so the transcript still makes sense when read
    // back later and the files themselves are long gone from the composer.
    //
    // One object, used for both the screen and the saved copy, so the two cannot drift apart.
    //
    // The `files` key is omitted rather than set to `undefined` when nothing is attached. Firestore
    // rejects an `undefined` value outright, and since a turn is saved as a single atomic batch, one
    // unset optional field loses the whole turn — the reply, the activity log and the wire
    // transcript a resumed conversation depends on. `{ files?: string[] }` permits an explicit
    // `files: undefined`, so the type checker cannot catch this.
    const attached = files
    const attachedNames = attached.map((f) => f.name)
    const userItem: StoredItem =
      attachedNames.length > 0 ? { kind: "user", text, files: attachedNames } : { kind: "user", text }
    append({ id: nextId(), ...userItem })
    setInput("")
    setFiles([])
    setRunning(true)

    /*
     * Everything visible in this turn is collected here as it happens, then written once.
     *
     * Reading it back out of React state afterwards would need the state to have settled, and a
     * turn that is stopped half-way would save a different transcript than the one on screen.
     */
    const turnItems: StoredItem[] = [userItem]
    const controller = new AbortController()
    abort.current = controller

    /*
     * The row a tool-end belongs to, held by reference rather than found in state.
     *
     * `settle` used to push into `turnItems` from inside a `setItems` updater. React invokes an
     * updater more than once in development, so the saved transcript would have contained duplicate
     * activity lines while the screen showed one — a stored conversation that disagreed with the
     * one that was on screen when it was written.
     */
    const settle = (summary: string, ok: boolean) => {
      const row = runningRow.current ?? { name: "", label: summary, risk: "write" }
      turnItems.push({ kind: "tool", name: row.name, label: row.label, risk: row.risk, summary, ok })
      runningRow.current = null
      setItems((prev) => {
        const idx = [...prev].reverse().findIndex((i) => i.kind === "tool" && i.summary === undefined)
        if (idx === -1) {
          return [...prev, { id: nextId(), kind: "tool", name: row.name, label: row.label, risk: row.risk, ok, summary }]
        }
        const at = prev.length - 1 - idx
        const copy = [...prev]
        copy[at] = { ...(copy[at] as Item & { kind: "tool" }), summary, ok }
        return copy
      })
    }

    /** Attaches a journal id to the line for the call it belongs to. */
    const markUndoable = (event: {
      id: string
      summary: string
      undoable: boolean
      note: string
    }) => {
      setItems((prev) => {
        const idx = [...prev].reverse().findIndex((i) => i.kind === "tool" && i.actionId === undefined)
        if (idx === -1) return prev
        const at = prev.length - 1 - idx
        const copy = [...prev]
        copy[at] = { ...(copy[at] as Item & { kind: "tool" }), actionId: event.id, undoable: event.undoable, undoNote: event.note }
        return copy
      })
    }

    let target = sessionId
    let createdId: string | null = null
    try {
      // Created on the first message, named after it, so the sidebar has something readable.
      if (!target) {
        target = await createSession(auth.currentUser?.uid, titleFrom(text || attached[0]?.name || "New conversation"))
        createdId = target
        setSessionId(target)
      }

      const transcript = await runAgent({
        history: history.current,
        input: text || "(see the attached file)",
        attachments: attached,
        sessionId: target,
        operator: { name: auth.currentUser?.displayName || auth.currentUser?.email || undefined, role: admin?.role },
        signal: controller.signal,
        confirm,
        onEvent: (event) => {
          switch (event.type) {
            case "reply":
              append({ id: nextId(), kind: "assistant", text: event.text })
              turnItems.push({ kind: "assistant", text: event.text })
              break
            case "tool-start": {
              const label = `${humanise(event.name)} — ${argsLine(event.args)}`
              runningRow.current = { name: event.name, label, risk: event.risk }
              append({ id: nextId(), kind: "tool", name: event.name, label, risk: event.risk })
              break
            }
            case "tool-end":
              settle(event.summary, event.ok)
              break
            case "action":
              markUndoable(event)
              break
            case "error":
              append({ id: nextId(), kind: "error", text: event.message })
              turnItems.push({ kind: "error", text: event.message })
              break
            default:
              break
          }
        },
      })

      // The transcript already opens with the user's message, so it appends cleanly.
      history.current = [...history.current, ...transcript]
      await saveTurn(target, turnItems, transcript, {
        ...(createdId ? { title: titleFrom(text || attached[0]?.name || "New conversation") } : {}),
      })
      void refreshSessions()
    } catch (err) {
      append({ id: nextId(), kind: "error", text: (err as Error).message })
      // A turn that failed this early may still have been created, so it is kept rather than left
      // as an orphan the sidebar cannot reach.
      if (createdId) void refreshSessions()
    } finally {
      setRunning(false)
      abort.current = null
      runningRow.current = null
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

  const undoableCount = actions.filter(isUndoable).length

  return (
    <AdminPage
      title="Assistant"
      description="Ask for anything the console can do — record a result, draft a report, attach footage, set a lineup. Every action it takes is listed below as it happens, and can be undone."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="mr-1.5 h-3.5 w-3.5" />
            Changes
          </Button>
          <Button variant="outline" size="sm" onClick={newConversation} disabled={running}>
            <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
            New
          </Button>
        </div>
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

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Conversations
          sessions={sessions}
          activeId={sessionId}
          disabled={running || loadingSession}
          onOpen={openSession}
          onRename={rename}
          onDelete={removeConversation}
        />

        <div className="min-w-0 rounded-2xl border border-line/15 bg-card">
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
              items.map((item) => <ItemRow key={item.id} item={item} onUndo={runUndoById} busyAction={busyAction} />)
            )}

            {pending && (
              <div className="rounded-xl border border-loss/45 bg-loss/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-loss" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Confirm before this runs</p>
                    <p className="mt-1 text-sm text-mist/85">
                      {CONSEQUENCE[pending.name] ?? "This changes live club data."}
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
            {files.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {files.map((file) => (
                  <span
                    key={file.url}
                    className="flex items-center gap-1.5 rounded-full border border-line/25 bg-muted/40 py-1 pl-2.5 pr-1.5 text-[11px]"
                  >
                    <span className="max-w-[180px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((f) => f.url !== file.url))}
                      className="rounded-full p-0.5 hover:bg-muted"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={picker}
                type="file"
                multiple
                accept="video/*,image/*"
                className="hidden"
                onChange={(e) => void addFiles(e.target.files)}
              />
              <Button
                variant="outline"
                onClick={() => picker.current?.click()}
                disabled={running || uploading || Boolean(pending)}
                title="Attach a clip or photo — the assistant refers to it by name"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                <span className="sr-only">Attach a file</span>
              </Button>
              <Button
                variant={listening ? "default" : "outline"}
                onClick={toggleVoice}
                disabled={running || Boolean(pending)}
                title="Dictate. Chrome and Edge send the audio to Google to transcribe it."
              >
                <Mic className="h-4 w-4" />
                <span className="sr-only">Dictate</span>
              </Button>
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
                placeholder={pending ? "Answer the confirmation above first…" : "Record a result, draft a report, attach footage…"}
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
                <Button onClick={() => void send()} disabled={(!input.trim() && !files.length) || Boolean(pending)}>
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Send</span>
                </Button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Enter to send, Shift+Enter for a new line. It acts as you, so it can only do what you can. Conversations
              are saved.
            </p>
            {interim && <p className="mt-1 text-[11px] italic text-signal">Listening: {interim}…</p>}
          </div>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Changes{undoableCount ? ` — ${undoableCount} can be undone` : ""}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Everything the assistant has changed in this conversation, newest first. Undoing one puts the records it
            touched back exactly as they were.
          </p>
          <div className="mt-2 max-h-[55vh] space-y-2 overflow-y-auto">
            {actions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing has been changed yet.</p>
            ) : (
              actions.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-line/15 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-stamp text-mist/70">{entry.tool}</p>
                    <p className="mt-0.5 text-sm">{entry.summary}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{undoNote(entry)}</p>
                  </div>
                  {isUndoable(entry) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void runUndo(entry)}
                      disabled={busyAction !== null}
                    >
                      {busyAction === entry.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Undo
                    </Button>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                      {entry.undone ? "undone" : "permanent"}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminPage>
  )
}

/** The saved conversations, as a list that can be reopened, renamed or deleted. */
function Conversations({
  sessions,
  activeId,
  disabled,
  onOpen,
  onRename,
  onDelete,
}: {
  sessions: Session[]
  activeId: string | null
  disabled: boolean
  onOpen: (id: string) => void
  onRename: (id: string, current: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <aside className="rounded-2xl border border-line/15 bg-card p-3">
      <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-stamp text-mist/70">Conversations</p>
      <div className="max-h-[62vh] space-y-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            Nothing saved yet. Your first message starts one.
          </p>
        ) : (
          sessions.map((s) => {
            const active = s.id === activeId
            return (
              <div
                key={s.id}
                className={`group flex items-center gap-1 rounded-xl px-2 py-1.5 ${
                  active ? "bg-signal/15" : "hover:bg-muted/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpen(s.id)}
                  disabled={disabled}
                  className="min-w-0 flex-1 text-left disabled:opacity-60"
                >
                  <span className="block truncate text-sm">{s.title || "Untitled"}</span>
                  <span className="block text-[10px] text-muted-foreground">{whenLabel(s.updatedAt)}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                      aria-label="Conversation options"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onRename(s.id, s.title)}>Rename</DropdownMenuItem>
                    <DropdownMenuItem className="text-loss" onClick={() => onDelete(s.id)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

/** One bubble or one activity line. */
function ItemRow({
  item,
  onUndo,
  busyAction,
}: {
  item: Item
  onUndo: (actionId: string) => void
  busyAction: string | null
}) {
  if (item.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-signal/15 px-4 py-2.5 text-sm whitespace-pre-wrap">
          {item.text}
          {item.files?.length ? (
            <span className="mt-1.5 block text-[11px] text-mist/70">Attached: {item.files.join(", ")}</span>
          ) : null}
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
          item.undone ? "bg-muted" : failed ? "bg-loss/20" : done ? "bg-win/20" : "bg-muted"
        }`}
      >
        {item.undone ? (
          <Undo2 className="h-3 w-3 text-muted-foreground" />
        ) : done && !failed ? (
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
              needs approval
            </Badge>
          )}
        </p>
        {done && (
          <p className={`mt-1 whitespace-pre-wrap ${failed ? "text-loss" : item.undone ? "text-muted-foreground line-through" : "text-mist/85"}`}>
            {item.summary}
          </p>
        )}
        {/* Undo sits on the line for the change it reverses, next to the outcome it contradicts. */}
        {item.undoable && item.actionId && !item.undone && (
          <button
            type="button"
            onClick={() => onUndo(item.actionId as string)}
            disabled={busyAction !== null}
            className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-line/25 px-2 py-0.5 text-[10px] text-mist/80 hover:border-line/50 disabled:opacity-50"
          >
            {busyAction === item.actionId ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Undo2 className="h-3 w-3" />
            )}
            Undo
          </button>
        )}
      </div>
    </div>
  )
}

/** The bits of the Web Speech API we use. Not in TypeScript's DOM lib. */
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: (event: {
    resultIndex: number
    results: { length: number; [i: number]: { 0: { transcript: string }; isFinal: boolean } }
  }) => void
  onerror: () => void
  onend: () => void
}
