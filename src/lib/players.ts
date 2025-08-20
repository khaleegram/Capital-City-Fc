
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { v4 as uuidv4 } from 'uuid';
import type { Player } from "./data";

// Firestore collection reference
const playersCollectionRef = collection(db, "players");

/**
 * Uploads a player's image to Firebase Storage.
 * @param imageFile The image file to upload.
 * @param playerId Optional player ID to use for the image name.
 * @returns The public URL of the uploaded image.
 */
export const uploadPlayerImage = async (imageFile: File, playerId?: string): Promise<string> => {
  const imageId = playerId || uuidv4();
  const imageRef = ref(storage, `players/photos/${imageId}_${imageFile.name}`);
  await uploadBytes(imageRef, imageFile);
  const downloadURL = await getDownloadURL(imageRef);
  return downloadURL;
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
      
      // Delete image from Storage, if it's a Firebase Storage URL
      if (player.imageUrl && player.imageUrl.includes('firebasestorage.googleapis.com')) {
        try {
            const imageRef = ref(storage, player.imageUrl);
            await deleteObject(imageRef);
        } catch (storageError: any) {
            // It's possible the file doesn't exist or permissions are wrong,
            // but we don't want this to block the Firestore deletion.
            console.warn("Could not delete player image from storage:", storageError.code);
        }
      }

    } catch (error) {
       console.error("Error deleting player:", error);
       throw new Error("Failed to delete player.");
    }
  }
    

    
