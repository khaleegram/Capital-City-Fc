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
 * One extra photo as the editor hands it over.
 *
 * Either `url` (already uploaded, kept as-is) or `file` (picked in this session, uploaded on
 * save). Both are optional rather than a union so the editor can hold one ordered list of
 * existing and new photos — reordering would otherwise have to splice two arrays apart.
 */
export type ArticlePhotoInput = { url?: string; file?: File | null; caption?: string };

/**
 * Resolves the editor's photo list into what goes on the document.
 *
 * Uploads happen here rather than on pick, so a photo the writer removed before saving is never
 * sent at all. Returns `undefined` only when the caller didn't pass a list, which the update path
 * reads as "leave the photos untouched" — an empty array is a real instruction to remove them all.
 */
const resolvePhotos = async (photos: ArticlePhotoInput[] | undefined) => {
  if (photos === undefined) return undefined;
  const resolved = await Promise.all(
    photos.map(async (photo) => {
      const url = photo.file ? await uploadNewsImage(photo.file) : photo.url;
      if (!url) return null;
      const caption = photo.caption?.trim();
      return caption ? { url, caption } : { url };
    })
  );
  return resolved.filter((p): p is { url: string; caption?: string } => p !== null);
};

/** Every image an article owns, so deleting it can reclaim them all. */
const articleImages = (article: NewsArticle) => [
  article.imageUrl,
  article.heroImageUrl,
  article.heroImageMobileUrl,
  ...(article.photos ?? []).map((p) => p.url),
];

/**
 * Adds a new news article to Firestore.
 * @param articleData The data for the new article.
 */
export const addNewsArticle = async (articleData: { headline: string; content: string; tags: string[], imageFile?: File | null; imageUrl?: string; heroImageFile?: File | null; heroImageMobileFile?: File | null; photos?: ArticlePhotoInput[]; fixtureId?: string | null }) => {
  try {
    /*
     * The cover, from one of two places.
     *
     * The news editor hands over a `File` and expects the upload to happen here, on save. The
     * assistant has already uploaded the file by the time it calls this — the browser sends
     * attachments to R2 before the model ever sees the message — so it passes the finished URL.
     */
    let imageUrl = articleData.imageUrl ?? "";
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

    // The rest of the set, beyond the cover. Omitted entirely when none were added.
    const photos = await resolvePhotos(articleData.photos);

    const ref = await addDoc(newsCollectionRef, {
      headline: articleData.headline,
      content: articleData.content,
      tags: articleData.tags,
      imageUrl: imageUrl,
      heroImageUrl: heroImageUrl,
      heroImageMobileUrl: heroImageMobileUrl,
      photos: photos ?? [],
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
export const updateNewsArticle = async (articleId: string, articleData: { headline: string; content: string; tags: string[], imageFile?: File | null; heroImageFile?: File | null; heroImageMobileFile?: File | null; clearHeroImage?: boolean; clearHeroImageMobile?: boolean; photos?: ArticlePhotoInput[]; fixtureId?: string | null }) => {
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

        /*
         * The gallery is replaced wholesale rather than merged.
         *
         * The editor sends the full ordered list every save — existing photos it kept plus the new
         * ones — so removing one is already expressed by its absence. Merging would leave a removed
         * photo on the article with no way to delete it from the UI.
         */
        const photos = await resolvePhotos(articleData.photos);
        if (photos !== undefined) updateData.photos = photos;

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
 * Deletes a news article from Firestore and its images from Storage.
 *
 * Every image the article owns, not just the cover: the hero, the phone hero and the gallery were
 * all left behind before, so deleting a photo-heavy article silently kept paying for its files.
 * `deleteFile` ignores an empty URL, so a missing one costs nothing.
 *
 * @param article The article object to delete.
 */
export const deleteNewsArticle = async (article: NewsArticle) => {
    try {
        const articleDocRef = doc(db, "news", article.id);
        await deleteDoc(articleDocRef);
        await Promise.all(articleImages(article).map((url) => deleteFile(url)));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error deleting news article: ", errorMessage);
        throw new Error(`Failed to delete news article: ${errorMessage}`);
    }
};
