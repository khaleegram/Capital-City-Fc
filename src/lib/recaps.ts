import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Recap } from "./data";

const recapsCollectionRef = collection(db, "recaps");

/**
 * Adds a new recap to Firestore.
 * @param recapData The data for the new recap.
 */
export const addRecap = async (recapData: Omit<Recap, 'id' | 'createdAt'>) => {
  try {
    await addDoc(recapsCollectionRef, {
      ...recapData,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding recap: ", error);
    throw new Error("Failed to add recap.");
  }
};
