
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, storage } from "./firebase";
import { deleteObject, getDownloadURL, ref, uploadString } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { NewsArticle } from "./data";

// Firestore collection reference
const newsCollectionRef = collection(db, "news");

/**
 * Uploads a base64 data URI image to Firebase Storage.
 * @param imageDataUri The image data URI to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadNewsImage = async (imageDataUri: string): Promise<string> => {
  // If the URI is already a Firebase Storage URL, just return it
  if (imageDataUri.startsWith('https://firebasestorage.googleapis.com')) {
    return imageDataUri;
  }
  
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

/**
 * Updates an existing news article in Firestore.
 * @param articleId The ID of the article to update.
 * @param articleData The data to update.
 */
export const updateNewsArticle = async (articleId: string, articleData: { headline: string; content: string; tags: string[], imageDataUri?: string | null }) => {
    try {
        let imageUrl = "";
        if (articleData.imageDataUri) {
            imageUrl = await uploadNewsImage(articleData.imageDataUri);
        }

        const articleDocRef = doc(db, "news", articleId);
        await updateDoc(articleDocRef, {
            headline: articleData.headline,
            content: articleData.content,
            tags: articleData.tags,
            imageUrl: imageUrl,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error updating news article: ", error);
        throw new Error("Failed to update news article.");
    }
};

/**
 * Deletes a news article from Firestore and its associated image from Storage.
 * @param article The article object to delete.
 */
export const deleteNewsArticle = async (article: NewsArticle) => {
    try {
        const articleDocRef = doc(db, "news", article.id);
        await deleteDoc(articleDocRef);

        if (article.imageUrl && article.imageUrl.includes('firebasestorage.googleapis.com')) {
            try {
                const imageRef = ref(storage, article.imageUrl);
                await deleteObject(imageRef);
            } catch (storageError: any) {
                if (storageError.code === 'storage/object-not-found') {
                    console.warn(`Image not found for article ${article.id}, skipping deletion.`);
                } else {
                    throw storageError;
                }
            }
        }
    } catch (error) {
        console.error("Error deleting news article: ", error);
        throw new Error("Failed to delete news article.");
    }
};
