"use client"

import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { clean } from "./collections"
import { db } from "./firebase"
import { situationFields, type PlayerSituation } from "./player-status"
import type { UploadedFile } from "./signup-upload"

export const SIGNUP_POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"] as const
export const SIGNUP_FEET = ["Right", "Left", "Both"] as const

export type SignupPosition = (typeof SIGNUP_POSITIONS)[number]
export type SignupFoot = (typeof SIGNUP_FEET)[number]

/**
 * The club a departed player is with now.
 *
 * This replaced a list of up to five clubs with ten fields each. The club never wanted the
 * history — only who a player is with once they have left — and the history was never rendered
 * on a public profile anyway, so most of it was effort nobody read. See the note on
 * `PlayerSignup.currentClub`.
 */
export type CurrentClubInput = {
  club: string
  country?: string
}

export type PlayerSignup = {
  name: string
  nickname?: string
  dob: string
  nationality: string
  position: SignupPosition
  strongFoot: SignupFoot
  heightCm: number
  jerseyNumber: number
  bio: string
  strengths: string[]
  careerHighlights: string[]
  /**
   * The player's own answer to "do you play for Capital City now?" — `ccfc` if they are on the
   * books, otherwise whether the club they moved to took them out of Nigeria. Drives both
   * `squadStatus` and `movedAbroad`; see `src/lib/player-status.ts`.
   */
  situation: PlayerSituation
  /**
   * The club they are with now. Only asked, and only present, when `situation` is not `ccfc` —
   * a player on the club's books has no other current club to name. Mirrors into `currentClub`,
   * which is the field the public profile reads.
   */
  currentClub?: CurrentClubInput
  /** Scopes the uploaded files to this submission, and proves to the rules that they are ours. */
  sessionId: string
  photo: UploadedFile
  gallery: UploadedFile[]
  videos: UploadedFile[]
}

/** Trims a string and returns undefined when it ends up empty, so `clean` drops the key. */
function optional(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Writes the player's own profile into `players` as an unpublished draft.
 *
 * The photo and footage are already in R2 under the player's own `signups/{sessionId}/`
 * staging prefix. Staff review the draft in /admin/players, approve it (which moves the
 * files into their permanent prefixes) or discard it (which deletes them and reclaims
 * the space).
 *
 * The accepted document shape is enforced by the public `create` rule on `players` in
 * firestore.rules — change both together or submissions will be rejected.
 */
export async function submitPlayerSignup(input: PlayerSignup): Promise<string> {
  const allFiles = [input.photo, ...input.gallery, ...input.videos]

  /*
   * `clubHistory` stays a list of one, even though the form now only ever collects a single
   * club. The stored shape is what the staff review panel reads and what the public `create`
   * rule validates in firestore.rules, and neither is worth churning for a list that is never
   * longer than one entry.
   *
   * `verified: false` is written on every entry and cannot be set by a player — the rule
   * rejects the write otherwise, so nobody can present an unconfirmed claim as confirmed.
   */
  const onClubBooks = input.situation === "ccfc"
  const club = optional(input.currentClub?.club)
  /*
   * Named `clubEntries`, not `clubHistory` and never `history`: `history` is the browser's global
   * `History` object, so a typo there typechecks and writes window.history under the clubHistory
   * key, which the rules then reject.
   */
  const clubEntries =
    !onClubBooks && club
      ? [clean({ club, country: optional(input.currentClub?.country), current: true, verified: false })]
      : []

  /*
   * A player on the club's books has no other current club, so `currentClub` is left unset —
   * this is what stops someone who answered "yes, I play for Capital City" publishing as
   * playing for two clubs at once.
   */
  const currentClub = onClubBooks ? undefined : club

  const ref = await addDoc(
    collection(db, "players"),
    clean({
      name: input.name.trim(),
      nickname: optional(input.nickname),
      position: input.position,
      role: "Player",
      jerseyNumber: input.jerseyNumber,
      imageUrl: input.photo.url,
      bio: input.bio.trim(),
      stats: { appearances: 0, goals: 0, assists: 0 },
      strongFoot: input.strongFoot,
      careerHighlights: input.careerHighlights,
      ...situationFields(input.situation),
      dob: input.dob,
      heightCm: input.heightCm,
      nationality: input.nationality.trim(),
      strengths: input.strengths,
      readyForNextStep: false,
      // Mirrored from the club they told us they are with now, so the public player page —
      // which reads `currentClub` — shows it without knowing about clubHistory.
      currentClub,
      clubHistory: clubEntries.length ? clubEntries : undefined,
      signupSessionId: input.sessionId,
      signupGallery: input.gallery.map((f) => ({ url: f.url, bytes: f.bytes })),
      signupVideos: input.videos.map((f) => ({ url: f.url, bytes: f.bytes, name: f.name })),
      storageBytes: allFiles.reduce<number>((sum, f) => sum + f.bytes, 0),
      source: "signup",
      published: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  )
  return ref.id
}
