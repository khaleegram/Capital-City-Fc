"use server"

import { assertAdmin } from "@/lib/server/verify-admin"
import { deleteObject, keyFromPublicUrl } from "@/lib/server/r2-storage"

/** Deletes an uploaded file by its public URL. Staff only; silently skips non-R2 URLs. */
export async function deleteR2Object(idToken: string, url: string | undefined | null) {
  await assertAdmin(idToken)
  const key = keyFromPublicUrl(url)
  if (!key) return
  try {
    await deleteObject(key)
  } catch (error) {
    console.warn(`[r2] could not delete ${key}:`, (error as Error).message)
  }
}
