
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "./firebase";
import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";

// Firestore collection reference
const newsCollectionRef = collection(db, "news");

/**
 * Uploads a base64 data URI image to Firebase Storage.
 * @param imageDataUri The image data URI to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadNewsImage = async (imageDataUri: string): Promise<string> => {
  const imageId = uuidv4();
  const imageRef = ref(storage, `news/images/${imageId}.png`);
  // 'data_url' is the format for base64 data URIs
  await uploadString(imageRef, imageDataUri, 'data_url');
  const downloadURL = await getDownloadURL(imageRef);
  return downloadURL;
};


/**
 * Adds a new news article to Firestore.
 * @param articleData The data for the new article.
 */
export const addNewsArticle = async (articleData: { headline: string; content: string; tags: string[], imageDataUri?: string | null }) => {
  try {
    let imageUrl = "";
    if (articleData.imageDataUri) {
        imageUrl = await uploadNewsImage(articleData.imageDataUri);
    }

    await addDoc(newsCollectionRef, {
      headline: articleData.headline,
      content: articleData.content,
      tags: articleData.tags,
      imageUrl: imageUrl,
      date: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding news article: ", error);
    throw new Error("Failed to add news article.");
  }
};
