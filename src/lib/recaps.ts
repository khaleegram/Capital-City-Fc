
import {
  collection,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";
import { Recap, Fixture } from "./data";

const recapsCollectionRef = collection(db, "recaps");
const newsCollectionRef = collection(db, "news");


/**
 * Adds a new recap to Firestore and also creates a corresponding news article.
 * @param recapData The data for the new recap.
 * @param fixture The fixture associated with the recap.
 */
export const addRecap = async (recapData: Omit<Recap, 'id' | 'createdAt'>, fixture: Fixture) => {
  const batch = writeBatch(db);
  try {
    // 1. Create the recap document
    const recapRef = doc(recapsCollectionRef);
    batch.set(recapRef, {
      ...recapData,
      createdAt: serverTimestamp(),
    });

    // 2. Create the corresponding news article
    const newsRef = doc(newsCollectionRef);
    batch.set(newsRef, {
        headline: recapData.headline,
        content: recapData.fullRecap,
        tags: [fixture.opponent, fixture.competition, ...recapData.structuredData.goalScorers],
        imageUrl: "", // Placeholder for image, can be extended later
        date: new Date().toISOString(),
        recapId: recapRef.id,
        fixtureId: fixture.id,
        createdAt: serverTimestamp(),
    });

    await batch.commit();

  } catch (error) {
    console.error("Error adding recap and news article: ", error);
    throw new Error("Failed to add recap.");
  }
};
