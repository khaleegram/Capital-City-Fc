import { getMessaging, getToken, isSupported } from "firebase/messaging"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { app, db } from "./firebase"

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

async function messagingSw() {
  if (!("serviceWorker" in navigator)) return null
  try {
    return await navigator.serviceWorker.register("/firebase-messaging-sw.js")
  } catch {
    return null
  }
}

export const getFcmToken = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null
  const supported = await isSupported().catch(() => false)
  if (!supported || !VAPID_KEY) return null

  const registration = await messagingSw()
  if (!registration) return null

  try {
    const status = await Notification.requestPermission()
    if (status !== "granted") return null
    const messaging = getMessaging(app)
    return (
      (await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      })) || null
    )
  } catch (error) {
    console.warn("[ccfc] FCM token unavailable", error)
    return null
  }
}

export const saveFcmToken = async (token: string, userId: string) => {
  try {
    await setDoc(doc(db, "userPushTokens", userId), { token, updatedAt: serverTimestamp() }, { merge: true })
  } catch (error) {
    console.warn("[ccfc] FCM token save failed", error)
  }
}
