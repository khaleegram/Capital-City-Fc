"use client"

import { useEffect } from "react"
import { getMessaging, isSupported, onMessage } from "firebase/messaging"
import { useAuth } from "./use-auth"
import { useToast } from "./use-toast"
import { refreshPushToken } from "@/lib/firebase-messaging"
import { app } from "@/lib/firebase"

/**
 * Staff-side push plumbing.
 *
 * Registering the device is all that happens here — asking permission is the public consent
 * card's job, so staff are never prompted twice for the same thing. This hook only re-attaches
 * an already-granted subscription to the signed-in account and surfaces foreground messages
 * as a toast; background ones are drawn by the service worker.
 */
export const useFcm = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (!user) return
    void refreshPushToken(user.uid)
  }, [user])

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    let unsubscribe = () => {}
    let cancelled = false

    void (async () => {
      if (!(await isSupported().catch(() => false)) || cancelled) return
      unsubscribe = onMessage(getMessaging(app), (payload) => {
        toast({
          title: payload.notification?.title ?? payload.data?.title,
          description: payload.notification?.body ?? payload.data?.body,
        })
      })
    })()

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [toast])
}
