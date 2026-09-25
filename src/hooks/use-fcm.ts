"use client"

import { useEffect } from "react"
import { getMessaging, isSupported, onMessage } from "firebase/messaging"
import { useAuth } from "./use-auth"
import { useToast } from "./use-toast"
import { getFcmToken, saveFcmToken } from "@/lib/firebase-messaging"
import { app } from "@/lib/firebase"

export const useFcm = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    let unsubscribe = () => {}

    const initFcm = async () => {
      try {
        if (!(await isSupported().catch(() => false))) return
        if (user) {
          const token = await getFcmToken()
          if (token) await saveFcmToken(token, user.uid)
        }
        unsubscribe = onMessage(getMessaging(app), (payload) => {
          toast({
            title: payload.notification?.title,
            description: payload.notification?.body,
          })
        })
      } catch (error) {
        console.warn("[ccfc] FCM init skipped", error)
      }
    }

    void initFcm()
    return () => unsubscribe()
  }, [user, toast])
}
