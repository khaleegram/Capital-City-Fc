
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db, storage } from "./firebase";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { NewsArticle } from "./data";

// Firestore collection reference
const newsCollectionRef = collection(db, "news");

/**
 * Uploads an image file to Firebase Storage.
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadNewsImage = async (imageFile: File): Promise<string> => {
  const imageId = uuidv4();
  const imageRef = ref(storage, `news/images/${imageId}_${imageFile.name}`);
  await uploadBytes(imageRef, imageFile);
  const downloadURL = await getDownloadURL(imageRef);
  return downloadURL;
};

/**
 * Adds a new news article to Firestore.
 * @param articleData The data for the new article.
 */
export const addNewsArticle = async (articleData: { headline: string; content: string; tags: string[], imageFile?: File | null }) => {
  try {
    let imageUrl = "";
    if (articleData.imageFile) {
        imageUrl = await uploadNewsImage(articleData.imageFile);
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
export const updateNewsArticle = async (articleId: string, articleData: { headline: string; content: string; tags: string[], imageFile?: File | null }) => {
    try {
        const updateData: any = {
            headline: articleData.headline,
            content: articleData.content,
            tags: articleData.tags,
            updatedAt: serverTimestamp(),
        };

        if (articleData.imageFile) {
            updateData.imageUrl = await uploadNewsImage(articleData.imageFile);
        }

        const articleDocRef = doc(db, "news", articleId);
        await updateDoc(articleDocRef, updateData);
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
