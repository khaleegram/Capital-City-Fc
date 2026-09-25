"use client"

import { getMessaging, getToken, isSupported } from "firebase/messaging"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { app, db } from "./firebase"

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

/** Where the client-generated device id lives, so a visitor keeps one subscription. */
const DEVICE_KEY = "ccfc.push.deviceId"

/**
 * Every way enabling push can fail, named so the UI can explain the fix rather than
 * offering a button that silently does nothing. The old code returned `null` for all of
 * these, which is why "push doesn't work" was impossible to diagnose from the page.
 */
export type PushFailure =
  /** NEXT_PUBLIC_FIREBASE_VAPID_KEY missing at build time. */
  | "no-vapid"
  /** Browser has no Web Push at all (older Safari, some in-app browsers). */
  | "unsupported"
  /** iOS only grants Web Push to an installed Home Screen app, never to a Safari tab. */
  | "ios-needs-install"
  /** Notifications were blocked. The browser remembers this and will not ask again. */
  | "denied"
  /** The prompt was closed without choosing. */
  | "dismissed"
  /** No service worker registration available to receive pushes. */
  | "no-worker"
  | "error"

export type PushResult = { ok: true; token: string } | { ok: false; reason: PushFailure; message: string }

const fail = (reason: PushFailure, message: string): PushResult => ({ ok: false, reason, message })

/** Resolves to `fallback` if `promise` hasn't settled in time, so nothing can hang a tap. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      }
    )
  })
}

/** iPadOS reports itself as a Mac, so touch points are what give it away. */
function isIos() {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** True when running as an installed app rather than in a browser tab. */
function isStandalone() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Notification permission, or "unsupported" where the API is absent. */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
  return Notification.permission
}

/**
 * Whether this browser could enable push at all, without prompting.
 *
 * Used to render the card in the right state on first paint instead of after a click.
 */
export async function pushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) return false
  return isSupported().catch(() => false)
}

/** A stable id for this browser, created on first use. */
export function pushDeviceId(): string {
  if (typeof window === "undefined") return ""
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    window.localStorage.setItem(DEVICE_KEY, id)
    return id
  } catch {
    // Private mode or storage disabled. A per-session id still lets push work for this visit.
    return crypto.randomUUID()
  }
}

/**
 * The app's single service worker registration.
 *
 * next-pwa registers `/sw.js` and that file pulls in the messaging worker with
 * `importScripts`, so both the offline cache and push share one worker. Registering
 * `/firebase-messaging-sw.js` separately — which is what this module used to do — puts two
 * workers in a race for the same `/` scope, and only one of them can control the page.
 */
async function pageRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null

  const existing = await navigator.serviceWorker.getRegistration("/").catch(() => undefined)
  if (existing) return withTimeout(navigator.serviceWorker.ready, 8000, existing)

  try {
    await navigator.serviceWorker.register("/sw.js")
    return await withTimeout(navigator.serviceWorker.ready, 8000, null)
  } catch {
    /*
     * next-pwa is disabled during development, so `/sw.js` isn't there to register. Fall back
     * to the messaging worker alone so push can still be tested locally. Production always
     * has `/sw.js`.
     */
    try {
      return await navigator.serviceWorker.register("/firebase-messaging-sw.js")
    } catch {
      return null
    }
  }
}

/** Stores the token against both this device and, when signed in, the staff account. */
async function persistToken(token: string, userId?: string | null) {
  const deviceId = pushDeviceId()
  const writes: Promise<unknown>[] = []

  if (deviceId) {
    writes.push(setDoc(doc(db, "pushDevices", deviceId), { token, updatedAt: serverTimestamp() }, { merge: true }))
  }
  if (userId) {
    writes.push(setDoc(doc(db, "userPushTokens", userId), { token, updatedAt: serverTimestamp() }, { merge: true }))
  }

  // Storage is best-effort: push already works for this session even if it can't be saved.
  await Promise.all(writes).catch((error) => console.warn("[ccfc] could not save push token", error))
}

/**
 * Enables push for this device.
 *
 * MUST be called from a real user gesture — the caller is responsible for that, because
 * browsers reject a permission request that isn't tied to a click.
 */
export async function enablePush(userId?: string | null): Promise<PushResult> {
  if (typeof window === "undefined") return fail("error", "Push needs a browser.")

  if (!VAPID_KEY) {
    return fail("no-vapid", "Push isn't configured on this deployment yet.")
  }

  if (!(await pushSupported())) {
    if (isIos() && !isStandalone()) {
      return fail("ios-needs-install", "On iPhone and iPad, add the site to your Home Screen first.")
    }
    return fail("unsupported", "This browser can't receive push notifications.")
  }

  // Safari on iOS refuses the prompt outside an installed app, and would resolve as
  // "denied" rather than "default" — so check before asking and explain instead.
  if (isIos() && !isStandalone()) {
    return fail("ios-needs-install", "On iPhone and iPad, add the site to your Home Screen first.")
  }

  // A previous "Block" is remembered permanently; asking again does nothing.
  if (Notification.permission === "denied") {
    return fail("denied", "Notifications are blocked for this site in your browser settings.")
  }

  if (Notification.permission !== "granted") {
    const status = await Notification.requestPermission()
    if (status === "denied") return fail("denied", "Notifications are blocked for this site in your browser settings.")
    if (status !== "granted") return fail("dismissed", "No problem — you can turn them on any time.")
  }

  const registration = await pageRegistration()
  if (!registration) return fail("no-worker", "The app couldn't start its background worker. Try reloading.")

  try {
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
    if (!token) return fail("error", "The browser didn't return a push token.")
    await persistToken(token, userId)
    return { ok: true, token }
  } catch (error) {
    console.warn("[ccfc] FCM token unavailable", error)
    return fail("error", "Couldn't finish setting up notifications. Try again in a moment.")
  }
}

/** Re-saves an existing token, e.g. after a staff sign-in. */
export async function refreshPushToken(userId?: string | null) {
  if (!VAPID_KEY || Notification.permission !== "granted") return
  if (!(await pushSupported())) return
  const registration = await pageRegistration()
  if (!registration) return
  try {
    const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
    if (token) await persistToken(token, userId)
  } catch (error) {
    console.warn("[ccfc] could not refresh push token", error)
  }
}

/** Kept for callers that already hold a token. */
export const saveFcmToken = async (token: string, userId: string) => persistToken(token, userId)
