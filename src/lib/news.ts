'use client';

import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";import { db } from "./firebase";
import { v4 as uuidv4 } from "uuid";
import { NewsArticle } from "./data";
import { notifyQuietly, uploadFile, deleteFile } from "./admin-client";


// Firestore collection reference
const newsCollectionRef = collection(db, "news");

/**
 * Uploads an image file to Cloudflare R2.
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadNewsImage = async (imageFile: File): Promise<string> => {
    return uploadFile(imageFile, 'news');
};

/**
 * Adds a new news article to Firestore.
 * @param articleData The data for the new article.
 */
export const addNewsArticle = async (articleData: { headline: string; content: string; tags: string[], imageFile?: File | null; heroImageFile?: File | null; heroImageMobileFile?: File | null }) => {
  try {
    let imageUrl = "";
    if (articleData.imageFile) {
        imageUrl = await uploadNewsImage(articleData.imageFile);
    }

    // Optional portrait hero. Leave empty to keep the landscape cover in the hero.
    let heroImageUrl = "";
    if (articleData.heroImageFile) {
        heroImageUrl = await uploadNewsImage(articleData.heroImageFile);
    }

    // Optional phone hero. Leave empty and phones fall back to heroImageUrl / imageUrl.
    let heroImageMobileUrl = "";
    if (articleData.heroImageMobileFile) {
        heroImageMobileUrl = await uploadNewsImage(articleData.heroImageMobileFile);
    }

    await addDoc(newsCollectionRef, {
      headline: articleData.headline,
      content: articleData.content,
      tags: articleData.tags,
      imageUrl: imageUrl,
      heroImageUrl: heroImageUrl,
      heroImageMobileUrl: heroImageMobileUrl,
      date: new Date().toISOString(),
      /*
       * Written through the news editor, so it goes live.
       *
       * `published` has to be set explicitly rather than left off. The public news list filters
       * on it, so an article written without it would be invisible — a silent failure that looks
       * like the editor did nothing. Match reports, which are machine-written, are the ones that
       * arrive unpublished.
       */
      published: true,
      createdAt: serverTimestamp(),
    });

    // Replaces the old Firestore onCreate trigger. Never throws, so a failed push
    // can't report a published article as a failure.
    await notifyQuietly("📰 Latest News", articleData.headline, "/news");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error adding news article: ", errorMessage);
    throw new Error(`Failed to add news article: ${errorMessage}`);
  }
};

/**
 * Updates an existing news article in Firestore.
 * @param articleId The ID of the article to update.
 * @param articleData The data to update.
 */
export const updateNewsArticle = async (articleId: string, articleData: { headline: string; content: string; tags: string[], imageFile?: File | null; heroImageFile?: File | null; heroImageMobileFile?: File | null; clearHeroImage?: boolean; clearHeroImageMobile?: boolean }) => {
    try {
        const updateData: any = {
            headline: articleData.headline,
            content: articleData.content,
            tags: articleData.tags,
            updatedAt: serverTimestamp(),
        };

        /*
         * Editing an article puts it live.
         *
         * The one case that matters: a match report arrives as a draft, someone reads it in the
         * news editor and saves it. That save is the approval, so it publishes. Without this the
         * admin would have to publish and then edit, which is backwards.
         */
        updateData.published = true;

        if (articleData.imageFile) {
            updateData.imageUrl = await uploadNewsImage(articleData.imageFile);
        }

        if (articleData.heroImageFile) {
            updateData.heroImageUrl = await uploadNewsImage(articleData.heroImageFile);
        } else if (articleData.clearHeroImage) {
            // Falls the hero back to the landscape cover.
            updateData.heroImageUrl = "";
        }

        if (articleData.heroImageMobileFile) {
            updateData.heroImageMobileUrl = await uploadNewsImage(articleData.heroImageMobileFile);
        } else if (articleData.clearHeroImageMobile) {
            // Phones fall back to whichever hero the other two fields resolve to.
            updateData.heroImageMobileUrl = "";
        }

        const articleDocRef = doc(db, "news", articleId);
        await updateDoc(articleDocRef, updateData);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error updating news article: ", errorMessage);
        throw new Error(`Failed to update news article: ${errorMessage}`);
    }
};

/**
 * Publishes or unpublishes an article.
 *
 * Separate from `updateNewsArticle` because it is the one write that doesn't touch the text —
 * unpublishing to pull something back off the site must not depend on the editor's form being
 * open, and must not rewrite content that a draft round-trip could otherwise disturb.
 */
export const setArticlePublished = async (articleId: string, published: boolean) => {
    try {
        await updateDoc(doc(db, "news", articleId), { published, updatedAt: serverTimestamp() });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error changing article visibility: ", errorMessage);
        throw new Error(`Failed to ${published ? "publish" : "unpublish"} article: ${errorMessage}`);
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
        if (article.imageUrl) {
          await deleteFile(article.imageUrl);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error deleting news article: ", errorMessage);
        throw new Error(`Failed to delete news article: ${errorMessage}`);
    }
};
