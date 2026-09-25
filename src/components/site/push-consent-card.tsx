"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, Check, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { enablePush, pushPermission, pushSupported, refreshPushToken, type PushFailure } from "@/lib/firebase-messaging"
import {
  FIRST_PROMPT_DELAY_MS,
  markDeclined,
  markEnabled,
  readConsent,
  shouldPrompt,
  writeConsent,
  type ConsentState,
} from "@/lib/push-consent"

/** Failures the visitor can't fix by pressing the button again, so it isn't offered. */
const UNFIXABLE: PushFailure[] = ["denied", "ios-needs-install", "no-vapid", "unsupported"]

const GUIDANCE: Record<string, string> = {
  denied:
    "Your browser is blocking notifications for this site. Tap the padlock (or the site settings) in the address bar, allow notifications, then reload this page.",
  "ios-needs-install":
    "On iPhone and iPad, notifications only work once the site is on your Home Screen. Tap Share, choose “Add to Home Screen”, then open it from there.",
  "no-vapid": "Notifications aren't switched on for this site yet. Please check back soon.",
  unsupported: "This browser can't receive notifications. Try Chrome, Edge or Safari on a newer device.",
}

/**
 * Cookie-style consent prompt for push notifications.
 *
 * One decision surface for the whole subscription: explaining what arrives, asking
 * permission, and registering the device. It deliberately does not repeat the native
 * browser prompt — that is only ever triggered by the button, because browsers ignore a
 * permission request that isn't tied to a real user gesture.
 *
 * It never blocks the page, never traps focus and never autofocuses, so a visitor reading
 * the hero isn't interrupted; Escape, the close control and "Not now" all dismiss it.
 */
export function PushConsentCard() {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<ConsentState>({ declined: 0 })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [problem, setProblem] = useState<PushFailure | null>(null)
  /**
   * The library's own explanation for the failure, used when the reason isn't one of the
   * unfixable cases that carry bespoke guidance. Previously this branch read
   * `GUIDANCE.error`, which is not a key that exists — so any unexpected failure rendered an
   * empty paragraph and the visitor was told nothing at all.
   */
  const [problemText, setProblemText] = useState("")

  /* An existing "granted" permission means they already agreed. Re-register quietly rather
     than asking again — but only when the service worker can actually be reached. */
  useEffect(() => {
    if (pushPermission() !== "granted") return
    let cancelled = false
    void (async () => {
      if (!(await pushSupported()) || cancelled) return
      await refreshPushToken(user?.uid ?? null)
      if (cancelled) return
      const next = markEnabled(readConsent())
      writeConsent(next)
      setState(next)
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  /* Decide once per visit, after a beat so the prompt doesn't fight the hero for attention. */
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        const stored = readConsent()
        if (cancelled) return
        setState(stored)

        const permission = pushPermission()
        const blocked = permission === "denied" || permission === "unsupported"
        if (!shouldPrompt(stored, Date.now(), blocked)) return
        // Already granted: the effect above handles it silently, no card needed.
        if (permission === "granted") return

        if (!(await pushSupported())) return
        if (cancelled) return
        setVisible(true)
      })()
    }, FIRST_PROMPT_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const dismiss = useCallback(() => {
    setState((current) => {
      const next = markDeclined(current)
      writeConsent(next)
      return next
    })
    setVisible(false)
  }, [])

  useEffect(() => {
    if (!visible) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [visible, dismiss])

  const turnOn = async () => {
    setBusy(true)
    setProblem(null)
    setProblemText("")
    const result = await enablePush(user?.uid ?? null)
    setBusy(false)

    if (result.ok) {
      const next = markEnabled(state)
      writeConsent(next)
      setState(next)
      setDone(true)
      setTimeout(() => setVisible(false), 3000)
      return
    }

    // Closing the browser's own dialog is a deferral, not a refusal — apply the cooldown.
    if (result.reason === "dismissed") {
      dismiss()
      return
    }
    setProblem(result.reason)
    setProblemText(result.message)
  }

  if (!visible) return null

  const blocked = problem !== null && UNFIXABLE.includes(problem)

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="push-consent-title"
      aria-describedby="push-consent-body"
      className={cn(
        "fixed z-40 inset-x-3",
        // Clears the mobile tab bar (h-16 plus its safe-area padding) and its hairline.
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]",
        "md:inset-x-auto md:bottom-6 md:left-6 md:w-[24rem]",
        "rounded-2xl border border-line/10 bg-paper p-4 shadow-lg"
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-mist transition-colors hover:bg-line/5 hover:text-ivory"
      >
        <X className="h-4 w-4" />
      </button>

      {done ? (
        <div className="flex items-start gap-3 py-1 pr-8">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal text-signal-foreground">
            <Check className="h-4 w-4" />
          </span>
          <div>
            <p id="push-consent-title" className="font-semibold">
              You&apos;re on the list.
            </p>
            <p className="mt-0.5 text-sm text-mist/80">We&apos;ll let you know when something happens.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 pr-8">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal/10 text-signal">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <p id="push-consent-title" className="font-semibold">
                Get club updates
              </p>
              <p id="push-consent-body" className="mt-1 text-sm leading-relaxed text-mist/85">
                Match alerts, new footage and journey news from Abuja, straight to your phone. Turn them off whenever you like.
              </p>
            </div>
          </div>

          {blocked ? (
            <p className="mt-3 rounded-xl border border-line/10 bg-line/[0.03] p-3 text-xs leading-relaxed text-mist/85">
              {GUIDANCE[problem as string]}
            </p>
          ) : problemText ? (
            <p className="mt-3 text-xs leading-relaxed text-signal">{problemText}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!blocked && (
              <Button onClick={turnOn} disabled={busy} size="sm">
                {busy ? <Loader2 className="animate-spin" /> : <Bell />}
                Turn on notifications
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
