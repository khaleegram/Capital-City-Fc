"use client"

import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { clean } from "./collections"
import { db } from "./firebase"
import type { FieldPosition, PlayerClubLevel } from "./data"
import type { UploadedFile } from "./signup-upload"

export const SIGNUP_POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"] as const
export const SIGNUP_FEET = ["Right", "Left", "Both"] as const
export const SIGNUP_CLUB_LEVELS = ["Youth", "Academy", "Senior"] as const

export type SignupPosition = (typeof SIGNUP_POSITIONS)[number]
export type SignupFoot = (typeof SIGNUP_FEET)[number]
export type SignupClubLevel = PlayerClubLevel

/** A single club as typed into the form. Everything is optional except the club name. */
export type ClubEntryInput = {
  club: string
  league?: string
  division?: string
  country?: string
  seasons?: string
  current?: boolean
  level?: SignupClubLevel
  appearances?: number
  goals?: number
  assists?: number
  position?: FieldPosition
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
  /** Full club history, newest first. The entry marked current also sets `currentClub`. */
  clubHistory: ClubEntryInput[]
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

  // `verified: false` is written on every entry and cannot be set by a player — the rule
  // rejects the write otherwise, so nobody can present an unconfirmed claim as confirmed.
  const clubHistory = input.clubHistory
    .filter((entry) => entry.club.trim().length > 0)
    .map((entry) =>
      clean({
        club: entry.club.trim(),
        league: optional(entry.league),
        division: optional(entry.division),
        country: optional(entry.country),
        seasons: optional(entry.seasons),
        current: !!entry.current,
        level: entry.level,
        appearances: entry.appearances,
        goals: entry.goals,
        assists: entry.assists,
        position: entry.position,
        verified: false,
      })
    )

  const current = clubHistory.find((entry) => entry.current)

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
      squadStatus: "current",
      dob: input.dob,
      heightCm: input.heightCm,
      nationality: input.nationality.trim(),
      strengths: input.strengths,
      readyForNextStep: false,
      // Mirrored from whichever entry is marked current, so the existing public player page
      // and admin screen keep working without knowing about clubHistory.
      currentClub: current?.club,
      clubHistory: clubHistory.length ? clubHistory : undefined,
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
