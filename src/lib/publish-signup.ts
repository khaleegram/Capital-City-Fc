"use client"

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore"
import { db } from "./firebase"
import { slugify } from "./admin-client"
import type { Gallery, MediaAsset } from "./data"

/**
 * Documents generated from an approved self sign-up carry this marker, so we can tell our
 * own auto-created rows apart from anything staff made by hand.
 */
const ORIGIN = "signup"

/** Stable gallery id. Derived from the player, so re-approving merges instead of duplicating. */
export const signupGalleryId = (playerId: string) => `player-${playerId}`

/** Stable id for the nth highlight clip. */
export const signupClipId = (playerId: string, index: number) => `player-${playerId}-clip-${index + 1}`

type GalleryDoc = Omit<Gallery, "id">
type ClipDoc = Omit<MediaAsset, "id">

/**
 * Publishes the public `galleries` / `mediaAssets` rows for an approved self sign-up, so the
 * promoted footage and photos actually appear on the site — the player page reads those
 * collections, never the player document.
 *
 * Idempotent by construction: every document id is derived from the player, so approving
 * twice merges rather than duplicates. Clips the player has since removed are deleted, and
 * only rows carrying our `signupPlayerId` marker are ever touched.
 */
export async function publishSignupMedia(input: {
  playerId: string
  playerName: string
  galleryUrls: string[]
  videoUrls: string[]
}): Promise<{ galleryId: string | null; clipIds: string[] }> {
  const { playerId, playerName, galleryUrls, videoUrls } = input
  const galleryId = await publishGallery(playerId, playerName, galleryUrls)
  const clipIds = await publishClips(playerId, playerName, videoUrls)
  return { galleryId, clipIds }
}

async function publishGallery(playerId: string, playerName: string, urls: string[]): Promise<string | null> {
  const id = signupGalleryId(playerId)
  const ref = doc(db, "galleries", id)
  const existing = await getDoc(ref)
  const ours = existing.exists() && existing.data().signupPlayerId === playerId

  // The player has no photos left. Remove the gallery we generated, but never a hand-made one.
  if (!urls.length) {
    if (ours) await deleteDoc(ref)
    return null
  }

  // `slug: playerName` is deliberate — the public route is /gallery/{slug} and a player's own
  // name is the least surprising title.
  const core: GalleryDoc = {
    slug: slugify(playerName) || playerId,
    title: playerName,
    photos: urls.map((url) => ({ url, playerIds: [playerId] })),
    published: true,
  }

  const payload: DocumentData = {
    ...core,
    signupPlayerId: playerId,
    updatedAt: serverTimestamp(),
  }
  if (!ours) payload.createdAt = serverTimestamp()

  await setDoc(ref, payload, { merge: true })
  return id
}

async function publishClips(playerId: string, playerName: string, urls: string[]): Promise<string[]> {
  const ids = urls.map((_, i) => signupClipId(playerId, i))
  const keep = new Set(ids)

  // Reconcile: delete auto-created clips the player no longer has, so re-approving after an
  // edit doesn't leave orphans pointing at promoted files that were never uploaded.
  const mine = await getDocs(query(collection(db, "mediaAssets"), where("signupPlayerId", "==", playerId)))
  await Promise.all(
    mine.docs.filter((d) => !keep.has(d.id) && d.data().signupOrigin === ORIGIN).map((d) => deleteDoc(d.ref))
  )

  await Promise.all(
    urls.map(async (url, i) => {
      const ref = doc(db, "mediaAssets", ids[i])
      const existing = await getDoc(ref)

      const core: ClipDoc = {
        type: "highlight",
        title: urls.length === 1 ? `${playerName} highlights` : `${playerName} highlights ${i + 1}`,
        url,
        playerIds: [playerId],
        taggedPlayers: [{ id: playerId, name: playerName }],
        published: true,
      }

      const payload: DocumentData = {
        ...core,
        signupPlayerId: playerId,
        signupOrigin: ORIGIN,
        updatedAt: serverTimestamp(),
      }
      if (!existing.exists()) payload.createdAt = serverTimestamp()

      await setDoc(ref, payload, { merge: true })
    })
  )

  return ids
}
