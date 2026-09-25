'use client';

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Player } from "./data";
import { uploadFile, deleteFile, refreshPublic } from "./admin-client";

// Firestore collection reference
const playersCollectionRef = collection(db, "players");

/**
 * Uploads a player's image to Cloudflare R2.
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadPlayerImage = async (imageFile: File): Promise<string> => {
  return uploadFile(imageFile, 'players');
};

/**
 * Adds a new player to Firestore.
 * @param playerData The data for the new player.
 */
export const addPlayer = async (playerData: Player) => {
  try {
    await addDoc(playersCollectionRef, {
      ...playerData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await refreshPublic("players", "journeys");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error adding player: ", errorMessage);
    throw new Error(`Failed to add player: ${errorMessage}`);
  }
};

/**
 * Updates an existing player in Firestore.
 * @param playerId The ID of the player to update.
 * @param playerData The data to update.
 */
export const updatePlayer = async (playerId: string, playerData: Partial<Player>) => {
  try {
    const playerDocRef = doc(db, "players", playerId);
    
    const updatePayload: { [key: string]: any } = {};
    Object.keys(playerData).forEach(key => {
        const K = key as keyof Partial<Player>;
        if (playerData[K] !== undefined) {
            updatePayload[K] = playerData[K];
        }
    });

    if (Object.keys(updatePayload).length > 0) {
        updatePayload.updatedAt = serverTimestamp();
        await updateDoc(playerDocRef, updatePayload);
        await refreshPublic("players", "journeys");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error updating player: ", errorMessage);
    throw new Error(`Failed to update player: ${errorMessage}`);
  }
};

/**
 * Deletes a player from Firestore and their image from Storage.
 * @param player The player object to delete.
 */
export const deletePlayer = async (player: Player) => {
    try {
      await deleteDoc(doc(db, "players", player.id));
      await deleteFile(player.imageUrl);
      await refreshPublic("players", "journeys");
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       console.error("Error deleting player:", errorMessage);
       throw new Error(`Failed to delete player: ${errorMessage}`);
    }
  }