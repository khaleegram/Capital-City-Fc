"use client"

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "./firebase"
import type { TeamProfile } from "./data"
import { TEAM_LOGO_URL } from "./brand"
import { clean } from "./collections"
import { notifyAll, refreshPublic } from "./admin-client"

export const TEAM_PROFILE_DOC_ID = "main_profile"

export const getTeamProfile = async (): Promise<TeamProfile> => {
  const snap = await getDoc(doc(db, "teamProfile", TEAM_PROFILE_DOC_ID))
  const data = snap.exists() ? snap.data() : {}
  return {
    id: TEAM_PROFILE_DOC_ID,
    name: data.name || "Capital City FC",
    logoUrl: TEAM_LOGO_URL,
    homeVenue: data.homeVenue || "Abuja, Nigeria",
    maintenanceMode: !!data.maintenanceMode,
    heroVideoUrl: data.heroVideoUrl,
    heroImageUrl: data.heroImageUrl,
    heroImageMobileUrl: data.heroImageMobileUrl,
    socials: data.socials,
    proofStats: data.proofStats ?? null,
  }
}

export const updateTeamProfile = async (profileData: Partial<Omit<TeamProfile, "id">>) => {
  await setDoc(
    doc(db, "teamProfile", TEAM_PROFILE_DOC_ID),
    { ...clean(profileData), updatedAt: serverTimestamp() },
    { merge: true }
  )
  await refreshPublic("team", "proof")
}

/** Sends a push notification to all subscribed devices via our own API route. */
export const sendCustomNotification = async (title: string, body: string) => {
  const result = await notifyAll(title, body)
  return { success: true, message: "Notifications sent successfully.", ...result }
}
