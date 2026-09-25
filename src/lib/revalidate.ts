"use server"

import { revalidateTag } from "next/cache"
import { assertAdmin } from "@/lib/server/verify-admin"
import { ALL_TAGS } from "@/lib/cache-tags"

const ALLOWED = new Set<string>(ALL_TAGS)

/** Called by admin tools after a write so public pages pick up changes immediately. */
export async function revalidatePublic(idToken: string, tags: string[]) {
  await assertAdmin(idToken)
  for (const tag of tags) {
    if (ALLOWED.has(tag)) revalidateTag(tag, { expire: 0 })
  }
}
