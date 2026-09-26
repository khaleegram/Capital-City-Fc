'use client';

import {
  collection,
  addDoc,
  getDoc,
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
 * Keeps the fixture's half of the article link in step.
 *
 * An article linked to a match is stored twice, once from each side: `news.fixtureId` and
 * `fixtures.articleId`. Both are read by something. The match hub looks for an existing article
 * by `fixtureId` before it writes a report — that check is the only thing stopping a hand-written
 * report from being joined by a second, machine-written one. And `deleteFixture` follows
 * `articleId` to take the report with it.
 *
 * Leaving one side stale is worse than not linking at all, because the hub would then fail to
 * recognise the article it should adopt. So the two are always written together, and the old
 * fixture is cleared when an article moves to a different match.
 *
 * Never throws: an article that saved but didn't link can be linked again, whereas a save that
 * fails over a link has lost the text.
 */
const syncFixtureLink = async (articleId: string, next: string | null, previous: string | null) => {
  try {
    if (previous && previous !== next) {
      const oldRef = doc(db, "fixtures", previous);
      const oldSnap = await getDoc(oldRef);
      // Only clear it if it still points here — another article may have claimed the fixture.
      if (oldSnap.exists() && oldSnap.data().articleId === articleId) {
        await updateDoc(oldRef, { articleId: null });
      }
    }
    if (next) await updateDoc(doc(db, "fixtures", next), { articleId });
  } catch (error) {
    console.warn("[ccfc] article saved but not linked to its fixture:", error);
  }
};

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
export const addNewsArticle = async (articleData: { headline: string; content: string; tags: string[], imageFile?: File | null; heroImageFile?: File | null; heroImageMobileFile?: File | null; fixtureId?: string | null }) => {
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

    const ref = await addDoc(newsCollectionRef, {
      headline: articleData.headline,
      content: articleData.content,
      tags: articleData.tags,
      imageUrl: imageUrl,
      heroImageUrl: heroImageUrl,
      heroImageMobileUrl: heroImageMobileUrl,
      date: new Date().toISOString(),
      /*
       * Linking to a match from here is what makes News a valid starting point.
       *
       * A report written by hand for a match that already has a fixture would otherwise be a
       * stranger to it: the fixture page wouldn't know about it, and the next save of that
       * fixture would draft a second report beside it. Setting `fixtureId` — and the fixture's
       * `articleId` back — makes the hub adopt this article instead.
       */
      fixtureId: articleData.fixtureId ?? null,
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

    if (articleData.fixtureId) await syncFixtureLink(ref.id, articleData.fixtureId, null);

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
export const updateNewsArticle = async (articleId: string, articleData: { headline: string; content: string; tags: string[], imageFile?: File | null; heroImageFile?: File | null; heroImageMobileFile?: File | null; clearHeroImage?: boolean; clearHeroImageMobile?: boolean; fixtureId?: string | null }) => {
    try {
        const articleDocRef = doc(db, "news", articleId);

        /*
         * The link may be changing, and moving an article to a different match — or unlinking it
         * entirely — has to clear the fixture it was on. `undefined` means the caller didn't
         * touch the link, so the previous value is only needed when it is actually present.
         */
        const linkChanged = articleData.fixtureId !== undefined;
        const previousFixtureId = linkChanged
            ? ((await getDoc(articleDocRef)).data()?.fixtureId as string | null | undefined) ?? null
            : null;

        const updateData: any = {
            headline: articleData.headline,
            content: articleData.content,
            tags: articleData.tags,
            updatedAt: serverTimestamp(),
        };

        if (linkChanged) updateData.fixtureId = articleData.fixtureId ?? null;

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

        await updateDoc(articleDocRef, updateData);

        if (linkChanged) await syncFixtureLink(articleId, articleData.fixtureId ?? null, previousFixtureId);
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
