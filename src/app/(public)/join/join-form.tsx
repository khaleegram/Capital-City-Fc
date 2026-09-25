"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Plus, Send, X } from "lucide-react"
import { copy } from "@/lib/copy"
import { ageFrom, cn } from "@/lib/utils"
import { SIGNUP_STORAGE_LIMIT } from "@/lib/signup-limits"
import { submitPlayerSignup, type ClubEntryInput, type SignupFoot, type SignupPosition } from "@/lib/player-signup"
import { fetchStorageUsage, newSignupSessionId, type UploadedFile } from "@/lib/signup-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PhotoGuidance } from "@/components/site/photo-guidance"
import { ClubHistoryEditor, blankClub } from "./club-history-editor"
import { FilePicker, StorageMeter, type Usage } from "./upload-controls"

const POSITIONS: [SignupPosition, string][] = [
  ["Goalkeeper", "Goalkeeper"],
  ["Defender", "Defender"],
  ["Midfielder", "Midfielder"],
  ["Forward", "Forward"],
]

const FEET: [SignupFoot, string][] = [
  ["Right", "Right"],
  ["Left", "Left"],
  ["Both", "Both"],
]

const MAX_GALLERY = 8
const MAX_VIDEOS = 4
const MAX_CHIPS = 12

function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden className="ml-1 text-signal">
            *
          </span>
        )}
      </Label>
      {children}
      {hint && <p className="text-xs text-mist/70">{hint}</p>}
    </div>
  )
}

function Section({
  step,
  title,
  body,
  children,
}: {
  step: string
  title: string
  body?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-line/10 p-5 sm:p-6">
      <div className="mb-5">
        <p className="font-mono text-[10px] uppercase tracking-stamp text-signal">{step}</p>
        <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-tight font-condensed">{title}</h2>
        {body && <p className="mt-1.5 text-sm leading-relaxed text-mist/75">{body}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

/** Free-text chips for strengths and highlights. */
function ChipList({
  id,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  hint?: string
}) {
  const [draft, setDraft] = useState("")
  const full = value.length >= MAX_CHIPS

  const add = () => {
    const v = draft.trim()
    if (!v || full || value.includes(v)) return
    onChange([...value, v])
    setDraft("")
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          maxLength={40}
          placeholder={full ? `Limit of ${MAX_CHIPS} reached` : placeholder}
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add} disabled={full} aria-label={`Add to ${id}`}>
          <Plus />
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v} className="flex items-center gap-1 rounded-full border border-line/20 py-1 pl-3 pr-1 text-xs">
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="rounded-full p-1 hover:bg-white/10"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {hint && <p className="text-xs text-mist/70">{hint}</p>}
    </div>
  )
}

export function JoinForm() {
  const [form, setForm] = useState({
    name: "",
    nickname: "",
    dob: "",
    nationality: "Nigeria",
    position: "Forward" as SignupPosition,
    strongFoot: "Right" as SignupFoot,
    heightCm: "",
    jerseyNumber: "",
    bio: "",
  })
  // Starts with one blank block so the club fields are visible without a tap.
  const [clubHistory, setClubHistory] = useState<ClubEntryInput[]>([blankClub()])
  const [strengths, setStrengths] = useState<string[]>([])
  const [highlights, setHighlights] = useState<string[]>([])
  const [photo, setPhoto] = useState<UploadedFile[]>([])
  const [gallery, setGallery] = useState<UploadedFile[]>([])
  const [videos, setVideos] = useState<UploadedFile[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [showGuidance, setShowGuidance] = useState(false)
  const [guidanceSeen, setGuidanceSeen] = useState(false)
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState("")

  // One id per form load. Every file this player uploads lands under it, which is what
  // lets staff approve or discard the whole submission in one move.
  const [sessionId] = useState(() => newSignupSessionId())

  useEffect(() => {
    let cancelled = false
    fetchStorageUsage(sessionId)
      .then((u) => !cancelled && setUsage(u))
      .catch(() => !cancelled && setUsage({ usedBytes: 0, remainingBytes: SIGNUP_STORAGE_LIMIT, limitBytes: SIGNUP_STORAGE_LIMIT }))
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const fail = (message: string) => {
      setError(message)
      setState("error")
    }

    const name = form.name.trim()
    const bio = form.bio.trim()
    const heightCm = Number(form.heightCm)
    const jerseyNumber = Number(form.jerseyNumber)
    const age = ageFrom(form.dob)

    if (name.length < 2) return fail("Enter your full name.")
    if (age === null) return fail("Enter your date of birth.")
    if (age < 8 || age > 50) return fail("Enter a valid date of birth — this form is for players aged 8 to 50.")
    if (!form.heightCm.trim() || !Number.isFinite(heightCm) || heightCm < 100 || heightCm > 230)
      return fail("Enter your height in centimetres (between 100 and 230).")
    if (!form.jerseyNumber.trim() || !Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 99)
      return fail("Pick a preferred squad number between 0 and 99.")
    if (bio.length < 20) return fail("Add a short bio of at least 20 characters.")
    if (strengths.length === 0) return fail("Add at least one strength.")
    if (photo.length === 0) return fail("Upload a profile photo — it's what appears on your player page.")
    if (!consent) return fail("Please confirm you're happy for the club to publish this profile.")

    setState("sending")
    try {
      await submitPlayerSignup({
        name,
        nickname: form.nickname,
        dob: form.dob,
        nationality: form.nationality || "Nigeria",
        position: form.position,
        strongFoot: form.strongFoot,
        heightCm,
        jerseyNumber,
        clubHistory,
        bio,
        strengths,
        careerHighlights: highlights,
        sessionId,
        photo: photo[0],
        gallery,
        videos,
      })
      setState("sent")
    } catch (err) {
      console.error("[ccfc] player signup failed:", err)
      fail(`Something went wrong. Email us at ${copy.brand.email} instead.`)
    }
  }

  if (state === "sent") {
    return (
      <div className="on-dark rounded-3xl border border-line/10 bg-navy-deep p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-signal" />
        <h2 className="mt-4 font-display text-3xl font-black uppercase font-condensed">Profile submitted</h2>
        <p className="mx-auto mt-3 max-w-md text-mist/85">
          Thanks {form.name.trim().split(" ")[0]}. Your details and your files are with the club. A staff member will
          check everything, confirm your squad number, then publish your profile.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/players">See the squad</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section step="01 · About you" title="Your details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name" required hint="As you want it to appear on your profile.">
            <Input id="name" autoComplete="name" required minLength={2} maxLength={80} value={form.name} onChange={set("name")} />
          </Field>
          <Field label="Nickname" htmlFor="nickname" hint="Optional — shown under your name.">
            <Input id="nickname" maxLength={40} value={form.nickname} onChange={set("nickname")} />
          </Field>
          <Field label="Date of birth" htmlFor="dob" required>
            <Input id="dob" type="date" required value={form.dob} onChange={set("dob")} />
          </Field>
          <Field label="Nationality" htmlFor="nationality" required>
            <Input id="nationality" autoComplete="country-name" maxLength={60} value={form.nationality} onChange={set("nationality")} />
          </Field>
        </div>
      </Section>

      <Section step="02 · On the pitch" title="Football details">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Position" htmlFor="position" required>
            <select
              id="position"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value as SignupPosition }))}
              className="flex h-11 w-full rounded-xl border border-input bg-ink/60 px-3 text-sm"
            >
              {POSITIONS.map(([v, label]) => (
                <option key={v} value={v} className="bg-ink">
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Preferred foot" htmlFor="strongFoot" required>
            <select
              id="strongFoot"
              value={form.strongFoot}
              onChange={(e) => setForm((f) => ({ ...f, strongFoot: e.target.value as SignupFoot }))}
              className="flex h-11 w-full rounded-xl border border-input bg-ink/60 px-3 text-sm"
            >
              {FEET.map(([v, label]) => (
                <option key={v} value={v} className="bg-ink">
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Height (cm)" htmlFor="heightCm" required>
            <Input id="heightCm" type="number" inputMode="numeric" min={100} max={230} required value={form.heightCm} onChange={set("heightCm")} />
          </Field>
          <Field label="Preferred squad number" htmlFor="jerseyNumber" required hint="The club confirms this on review.">
            <Input id="jerseyNumber" type="number" inputMode="numeric" min={0} max={99} required value={form.jerseyNumber} onChange={set("jerseyNumber")} />
          </Field>
        </div>

        <div className="mt-6 space-y-3 border-t border-line/10 pt-6">
          <div>
            <p className="text-sm font-medium">Clubs you&apos;ve played for</p>
            <p className="mt-1 text-xs text-mist/70">
              Start with the club you&apos;re at now and work backwards. Only the club name is needed —
              add what you know. The club verifies these before they appear on your profile.
            </p>
          </div>
          <ClubHistoryEditor value={clubHistory} onChange={setClubHistory} />
        </div>
      </Section>

      <Section
        step="03 · Your profile"
        title="How you play"
        body="This is what scouts read first, so write it the way you'd say it out loud."
      >
        <Field label="Bio" htmlFor="bio" required hint={`${form.bio.trim().length}/1200 characters — minimum 20.`}>
          <Textarea
            id="bio"
            required
            rows={5}
            maxLength={1200}
            placeholder="Left-footed winger who likes to attack the full-back. Strong in one-v-ones, comfortable on both sides."
            value={form.bio}
            onChange={set("bio")}
          />
        </Field>
        <Field label="Strengths" htmlFor="strengths" required hint="Press Enter or the + to add each one.">
          <ChipList id="strengths" value={strengths} onChange={setStrengths} placeholder="e.g. Aerial duels" />
        </Field>
        <Field label="Career highlights" htmlFor="highlights" hint="Optional — tournaments, trophies, notable matches.">
          <ChipList id="highlights" value={highlights} onChange={setHighlights} placeholder="e.g. Gothia Cup 2026" />
        </Field>
      </Section>

      <Section step="04 · Photos" title="Your photo" body="Uploaded straight to the club. You can replace or remove it before you submit.">
        {showGuidance ? (
          <PhotoGuidance
            onContinue={() => {
              setShowGuidance(false)
              setGuidanceSeen(true)
            }}
            onCancel={() => setShowGuidance(false)}
          />
        ) : (
          <FilePicker
            sessionId={sessionId}
            kind="photo"
            accept="image/*"
            label={photo.length ? "Replace profile photo" : "Upload your profile photo"}
            hint="One clear photo of you in club kit. This becomes your player page photo."
            max={1}
            value={photo}
            onChange={setPhoto}
            onUsage={setUsage}
            onBeforePick={() => {
              // Show the standard once. After that, the player just picks normally.
              if (guidanceSeen || photo.length > 0) return true
              setShowGuidance(true)
              return false
            }}
            previewAspect="aspect-[4/5]"
          />
        )}
      </Section>

      <Section
        step="05 · Gallery"
        title="More photos"
        body="Optional. Action shots, training, or you in the kit — up to 8. These go into your profile gallery."
      >
        <FilePicker
          sessionId={sessionId}
          kind="gallery"
          accept="image/*"
          label="Add photos"
          max={MAX_GALLERY}
          value={gallery}
          onChange={setGallery}
          onUsage={setUsage}
          previewAspect="aspect-square"
        />
      </Section>

      <Section
        step="06 · Footage"
        title="Video highlights"
        body="Optional, but the biggest thing you can do for your profile. Real match footage is what clubs ask for."
      >
        <FilePicker
          sessionId={sessionId}
          kind="video"
          accept="video/*"
          label="Add a video"
          hint={`Up to ${MAX_VIDEOS} clips. Watch your storage — video fills it fastest.`}
          max={MAX_VIDEOS}
          value={videos}
          onChange={setVideos}
          onUsage={setUsage}
        />
      </Section>

      <StorageMeter usage={usage} />

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line/10 p-4">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-signal"
        />
        <span className="text-sm leading-relaxed text-mist/85">
          I&apos;m happy for Capital City FC to publish this profile — including my photos, video, position and stats —
          on the club website and social channels.
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-ivory">
          {error}
        </p>
      )}

      <Button type="submit" size="xl" className="w-full sm:w-auto" disabled={state === "sending"}>
        {state === "sending" ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
        Submit my profile
      </Button>

      <p className={cn("text-xs text-mist/70", state === "sending" && "opacity-60")}>
        Nothing goes live until a staff member reviews it. If the club can&apos;t use your submission, the files you
        uploaded are deleted.
      </p>
    </form>
  )
}
