import "server-only"

import type { App } from "firebase-admin/app"
import type { DocumentReference, Firestore } from "firebase-admin/firestore"

/**
 * Sends push notifications from our own API route, replacing the Cloud Functions that
 * used to do it.
 *
 * Why this exists: Cloud Functions require the Firebase Blaze (paid) plan. Sending FCM
 * through the Admin SDK needs only a service account, so this keeps the project on the
 * free Spark tier.
 *
 * Requires FIREBASE_SERVICE_ACCOUNT on the server. Vercel has no local Google credentials,
 * so applicationDefault() alone will not work there.
 */

export type PushResult = { devices: number; sent: number; failed: number; cleaned: number }

/**
 * Tokens live in two collections. `userPushTokens` is keyed by account for signed-in users
 * (staff, players); `pushDevices` is keyed by a random device id for the visitors who have no
 * account, which is most of them. Only reading the first is why a public visitor could enable
 * notifications and still never receive one.
 */
const TOKEN_COLLECTIONS = ["userPushTokens", "pushDevices"] as const

/** FCM accepts at most 500 tokens per multicast call. */
const TOKEN_BATCH = 500

let appPromise: Promise<App> | null = null

function hasCredentials() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS)
}

function adminApp(): Promise<App> {
  appPromise ??= (async () => {
    const { getApps, initializeApp, cert, applicationDefault } = await import("firebase-admin/app")
    const name = "ccfc-notify"
    const existing = getApps().find((a) => a.name === name)
    if (existing) return existing
    if (!hasCredentials()) {
      throw new Error(
        "Push notifications need FIREBASE_SERVICE_ACCOUNT set on the server. Vercel has no local Google credentials to fall back on."
      )
    }
    return initializeApp(
      {
        credential: process.env.FIREBASE_SERVICE_ACCOUNT
          ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
          : applicationDefault(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      },
      name
    )
  })().catch((err) => {
    // Don't cache a failed init, or every later attempt inherits the same error.
    appPromise = null
    throw err
  })
  return appPromise
}

/** Every device token we hold, deduplicated, with the document to prune if FCM rejects it. */
async function collectTokens(db: Firestore): Promise<{ ref: DocumentReference; token: string }[]> {
  const snaps = await Promise.all(TOKEN_COLLECTIONS.map((name) => db.collection(name).get()))

  const entries: { ref: DocumentReference; token: string }[] = []
  const seen = new Set<string>()

  for (const snap of snaps) {
    for (const doc of snap.docs) {
      const token = doc.get("token")
      if (typeof token !== "string" || token.length === 0) continue
      // A signed-in visitor's device lands in both collections; FCM would count it twice.
      if (seen.has(token)) continue
      seen.add(token)
      entries.push({ ref: doc.ref, token })
    }
  }

  return entries
}

/** Sends one notification to every subscribed device and prunes tokens FCM rejects outright. */
export async function sendPushToAll(
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<PushResult> {
  const [{ getFirestore }, { getMessaging }] = await Promise.all([
    import("firebase-admin/firestore"),
    import("firebase-admin/messaging"),
  ])

  const app = await adminApp()
  const db = getFirestore(app)

  const entries = await collectTokens(db)

  if (entries.length === 0) return { devices: 0, sent: 0, failed: 0, cleaned: 0 }

  const messaging = getMessaging(app)
  const stale: DocumentReference[] = []
  let sent = 0
  let failed = 0

  for (let i = 0; i < entries.length; i += TOKEN_BATCH) {
    const slice = entries.slice(i, i + TOKEN_BATCH)
    const res = await messaging.sendEachForMulticast({
      notification: { title, body },
      data,
      /*
       * The web-push extras decide what the notification looks like and where a tap lands.
       * `fcmOptions.link` lets the browser handle the click natively; without it a tap does
       * nothing at all, which reads as the notification being broken.
       */
      webpush: {
        fcmOptions: { link: data.url || "/" },
        notification: { icon: "/icons/icon-192x192.png", badge: "/icons/icon-96x96.png" },
      },
      tokens: slice.map((e) => e.token),
    })

    sent += res.successCount
    failed += res.failureCount

    res.responses.forEach((response, index) => {
      if (response.success) return
      const code = response.error?.code ?? ""
      // Only these mean the token is permanently gone. Anything else (rate limits, etc.)
      // is transient, and deleting on those would silently unsubscribe live devices.
      if (code === "messaging/invalid-registration-token" || code === "messaging/registration-token-not-registered") {
        stale.push(slice[index].ref)
      }
    })
  }

  if (stale.length > 0) {
    const batch = db.batch()
    for (const ref of stale) batch.delete(ref)
    try {
      await batch.commit()
    } catch (err) {
      // Pruning is housekeeping; the notification already went out.
      console.warn("[ccfc] could not prune stale push tokens:", err)
    }
  }

  return { devices: entries.length, sent, failed, cleaned: stale.length }
}

/** How many devices are currently subscribed. Used by the admin composer to show reach. */
export async function countSubscribers(): Promise<number> {
  const { getFirestore } = await import("firebase-admin/firestore")
  const app = await adminApp()
  const db = getFirestore(app)
  const counts = await Promise.all(TOKEN_COLLECTIONS.map((name) => db.collection(name).count().get()))
  return counts.reduce((total, snap) => total + snap.data().count, 0)
}
