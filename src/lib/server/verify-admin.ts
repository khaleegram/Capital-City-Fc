import "server-only"

/**
 * Confirms that a Firebase ID token belongs to a staff member without needing
 * service-account credentials: we read `admins/{uid}` through the Firestore REST
 * API *as that user*. Firestore validates the token, and the rules only let a
 * user read their own admin document, so a 200 proves both identity and role.
 */
export async function assertAdmin(idToken: string | undefined | null): Promise<string> {
  if (!idToken) throw new Error("Not signed in.")
  const [, payload] = idToken.split(".")
  if (!payload) throw new Error("Malformed token.")
  let uid: string | undefined
  try {
    uid = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).user_id
  } catch {
    throw new Error("Malformed token.")
  }
  if (!uid) throw new Error("Malformed token.")

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/admins/${encodeURIComponent(uid)}`,
    { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" }
  )
  if (!res.ok) throw new Error("Staff access required.")
  return uid
}
