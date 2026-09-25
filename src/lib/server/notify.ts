import "server-only"

import type { App } from "firebase-admin/app"
import type { DocumentReference } from "firebase-admin/firestore"

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

/** Tokens are stored one per document, keyed by user id: userPushTokens/{userId}. */
const TOKEN_COLLECTION = "userPushTokens"

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

  const snap = await db.collection(TOKEN_COLLECTION).get()
  const entries = snap.docs
    .map((d) => ({ ref: d.ref, token: typeof d.get("token") === "string" ? (d.get("token") as string) : "" }))
    .filter((e) => e.token.length > 0)

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
  const snap = await getFirestore(app).collection(TOKEN_COLLECTION).count().get()
  return snap.data().count
}
