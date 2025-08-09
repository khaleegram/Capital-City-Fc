
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { v4 as uuidv4 } from 'uuid';

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
export const addPlayer = async (playerData: any) => {
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
export const updatePlayer = async (playerId: string, playerData: any) => {
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
