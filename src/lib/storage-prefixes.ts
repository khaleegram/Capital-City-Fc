import { SIGNUP_ROOT } from "./signup-limits"

/**
 * Every prefix an object in the club's R2 bucket can live under.
 *
 * Lives outside `upload-actions.ts` because that module is marked `"use server"` and so may
 * only export async functions — the key-parsing helper in `r2-storage.ts` needs to read this
 * list and is not a server action.
 *
 * These prefixes are what let an object's key be recovered from its URL without knowing which
 * host the URL was written with. Keys are stable; the host in front of the bucket is not.
 */
export const ALLOWED_PREFIXES: readonly string[] = [
  "media",
  "galleries",
  "journeys",
  "players",
  "staff",
  "placements",
  "news",
  "team",
  "fixtures",
]

/**
 * Everything the bucket contains — staff uploads and staged `/join` submissions alike.
 *
 * `SIGNUP_ROOT` is imported rather than repeated so the two can't drift.
 */
export const OWNED_PREFIXES: readonly string[] = [...ALLOWED_PREFIXES, SIGNUP_ROOT]
