import {
  collection,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Player } from "./data";

const formationsCollectionRef = collection(db, "formations");

/**
 * Adds a new formation to Firestore.
 * @param name The name of the formation.
 * @param startingXI An array of players in the starting lineup.
 * @param substitutes An array of players on the bench.
 * @param notes Optional tactical notes for the formation.
 */
export const addFormation = async (
  name: string,
  startingXI: Player[],
  substitutes: Player[],
  notes?: string,
) => {
  try {
    // Storing a lightweight version of the player object
    const mapPlayers = (players: Player[]) =>
      players.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        jerseyNumber: p.jerseyNumber,
        imageUrl: p.imageUrl,
      }));

    await addDoc(formationsCollectionRef, {
      name,
      startingXI: mapPlayers(startingXI),
      substitutes: mapPlayers(substitutes),
      notes: notes || "",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding formation: ", error);
    throw new Error("Failed to add formation.");
  }
};

/**
 * Deletes a formation from Firestore.
 * @param formationId The ID of the formation to delete.
 */
export const deleteFormation = async (formationId: string) => {
  try {
    const formationDocRef = doc(db, "formations", formationId);
    await deleteDoc(formationDocRef);
  } catch (error) {
    console.error("Error deleting formation: ", error);
    throw new Error("Failed to delete formation.");
  }
};