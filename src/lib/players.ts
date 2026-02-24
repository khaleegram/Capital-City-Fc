
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
import { uploadFileToR2, deleteFileFromR2 } from "./r2";

// Firestore collection reference
const playersCollectionRef = collection(db, "players");

/**
 * Uploads a player's image to Cloudflare R2.
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadPlayerImage = async (imageFile: File): Promise<string> => {
  return uploadFileToR2(imageFile, 'players/photos');
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
  } catch (error) {
    console.error("Error adding player: ", error);
    throw new Error("Failed to add player.");
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
    await updateDoc(playerDocRef, {
      ...playerData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating player: ", error);
    throw new Error("Failed to update player.");
  }
};

/**
 * Deletes a player from Firestore and their image from Storage.
 * @param player The player object to delete.
 */
export const deletePlayer = async (player: Player) => {
    try {
      // Delete Firestore document
      await deleteDoc(doc(db, "players", player.id));
      
      // Delete image from R2 Storage
      await deleteFileFromR2(player.imageUrl);

    } catch (error) {
       console.error("Error deleting player:", error);
       throw new Error("Failed to delete player.");
    }
  }
