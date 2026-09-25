"use client"

import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { clean } from "./collections"
import { db } from "./firebase"

export const SIGNUP_POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"] as const
export const SIGNUP_FEET = ["Right", "Left", "Both"] as const

export type SignupPosition = (typeof SIGNUP_POSITIONS)[number]
export type SignupFoot = (typeof SIGNUP_FEET)[number]

export type PlayerSignup = {
  name: string
  nickname?: string
  dob: string
  nationality: string
  position: SignupPosition
  strongFoot: SignupFoot
  heightCm: number
  jerseyNumber: number
  currentClub?: string
  bio: string
  strengths: string[]
  careerHighlights: string[]
  /** Reference only — staff open it and set the official profile photo themselves. */
  photoLink?: string
  videoLinks?: string[]
  /** Club use only. Never rendered on the public site. */
  contact?: { email?: string; phone?: string }
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/** Splits a textarea of links into a clean, de-duplicated list. */
export function parseLinkList(value: string) {
  const links = value
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean)
  return Array.from(new Set(links))
}

/**
 * Writes the player's own profile straight into `players` as an unpublished draft.
 *
 * Staff see it in /admin/players, add the official photo, then flip "Show on public site".
 * The accepted document shape is enforced by the public `create` rule on `players` in
 * firestore.rules — change both together or submissions will be rejected.
 */
export async function submitPlayerSignup(input: PlayerSignup): Promise<string> {
  const email = input.contact?.email?.trim()
  const phone = input.contact?.phone?.trim()
  const videoLinks = input.videoLinks?.map((l) => l.trim()).filter(Boolean)

  const ref = await addDoc(
    collection(db, "players"),
    clean({
      name: input.name.trim(),
      nickname: input.nickname?.trim() || undefined,
      position: input.position,
      role: "Player",
      jerseyNumber: input.jerseyNumber,
      // Players can't upload to storage themselves; staff set the real photo on review.
      imageUrl: "",
      bio: input.bio.trim(),
      stats: { appearances: 0, goals: 0, assists: 0 },
      strongFoot: input.strongFoot,
      careerHighlights: input.careerHighlights.length ? input.careerHighlights : undefined,
      squadStatus: "current",
      dob: input.dob,
      heightCm: input.heightCm,
      nationality: input.nationality.trim(),
      strengths: input.strengths,
      readyForNextStep: false,
      currentClub: input.currentClub?.trim() || undefined,
      photoLink: input.photoLink?.trim() || undefined,
      videoLinks: videoLinks?.length ? videoLinks : undefined,
      contact: email || phone ? { email: email || undefined, phone: phone || undefined } : undefined,
      source: "signup",
      published: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  )
  return ref.id
}
