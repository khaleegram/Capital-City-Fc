"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { CheckCircle2, Loader2, Send } from "lucide-react"
import { db } from "@/lib/firebase"
import { copy } from "@/lib/copy"
import type { EnquiryRole } from "@/lib/data"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const ROLES = Object.entries(copy.contact.roles) as [EnquiryRole, string][]

const PROMPTS: Record<EnquiryRole, string> = {
  scout: "Which players, positions or age groups are you looking at? Tell us the club and what you need (footage, data, trial dates).",
  parent: "Tell us about your child (age, position, current team) and what you'd like to know about the programme.",
  player: "Your age, position, current team and a link to any footage.",
  partner: "Tell us about your organisation and how you'd like to support the next journey.",
  media: "Your outlet, deadline and what you're working on.",
}

export function EnquiryForm() {
  const params = useSearchParams()
  const initialRole = (params.get("role") as EnquiryRole) || "scout"
  const playerId = params.get("player")
  const playerName = params.get("name")
  const [role, setRole] = useState<EnquiryRole>(copy.contact.roles[initialRole] ? initialRole : "scout")
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    organisation: "",
    message: playerName ? `I'd like the full profile for ${playerName}.` : "",
    website: "",
  })
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState("")

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.website) return setState("sent")
    if (form.message.trim().length < 10) {
      setError("Please add a little more detail (at least 10 characters).")
      return
    }
    setState("sending")
    setError("")
    try {
      await addDoc(collection(db, "enquiries"), {
        role,
        name: form.name.trim(),
        email: form.email.trim(),
        ...(form.phone.trim() && { phone: form.phone.trim() }),
        ...(form.organisation.trim() && { organisation: form.organisation.trim() }),
        message: form.message.trim(),
        ...(playerId && { playerId, playerName: playerName ?? null }),
        status: "new",
        createdAt: serverTimestamp(),
      })
      setState("sent")
    } catch (err) {
      console.error(err)
      setError(`Something went wrong. Email us at ${copy.brand.email} instead.`)
      setState("error")
    }
  }

  if (state === "sent") {
    return (
      <div className="on-dark rounded-3xl border border-line/10 bg-navy-deep p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-signal" />
        <p className="mt-4 font-display text-3xl font-black uppercase font-condensed">Message received</p>
        <p className="mt-2 text-mist/85">{copy.contact.success}</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset>
        <legend className="mb-3 text-sm font-medium">I am a…</legend>
        <div className="flex flex-wrap gap-2">
          {ROLES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRole(key)}
              aria-pressed={role === key}
              className={cn(
                "h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                role === key ? "border-signal bg-signal text-white" : "border-line/15 text-mist/80 hover:border-line/40"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {playerName && (
        <p className="rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm">
          About: <span className="font-semibold">{playerName}</span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" required minLength={2} maxLength={120} value={form.name} onChange={set("name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required maxLength={200} value={form.email} onChange={set("email")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone / WhatsApp (optional)</Label>
          <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
        </div>
        {(role === "scout" || role === "partner" || role === "media") && (
          <div className="space-y-1.5">
            <Label htmlFor="org">{role === "scout" ? "Club / agency" : role === "media" ? "Outlet" : "Organisation"}</Label>
            <Input id="org" autoComplete="organization" value={form.organisation} onChange={set("organisation")} />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" required rows={6} maxLength={4000} placeholder={PROMPTS[role]} value={form.message} onChange={set("message")} />
      </div>
      <div className="hidden" aria-hidden>
        <label>
          Website <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </label>
      </div>
      {error && <p className="text-sm text-signal-soft">{error}</p>}
      <Button type="submit" size="xl" className="w-full sm:w-auto" disabled={state === "sending"}>
        {state === "sending" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
        Send enquiry
      </Button>
    </form>
  )
}
