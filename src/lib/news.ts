
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// Firestore collection reference
const newsCollectionRef = collection(db, "news");

/**
 * Adds a new news article to Firestore.
 * @param articleData The data for the new article.
 */
export const addNewsArticle = async (articleData: { headline: string; content: string; tags: string[] }) => {
  try {
    await addDoc(newsCollectionRef, {
      ...articleData,
      imageUrl: "", // Add a placeholder or logic to generate/upload an image
      date: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding news article: ", error);
    throw new Error("Failed to add news article.");
  }
};
