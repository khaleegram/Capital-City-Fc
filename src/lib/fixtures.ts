import {
  collection,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, storage } from "./firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import type { Fixture } from "./data";

const fixturesCollectionRef = collection(db, "fixtures");
const newsCollectionRef = collection(db, "news");

/**
 * Uploads an opponent's logo to Firebase Storage.
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadOpponentLogo = async (imageFile: File): Promise<string> => {
  const imageId = uuidv4();
  const imageRef = ref(storage, `teams/logos/${imageId}_${imageFile.name}`);
  await uploadBytes(imageRef, imageFile);
  const downloadURL = await getDownloadURL(imageRef);
  return downloadURL;
};

/**
 * Adds a new fixture and optionally a corresponding news article.
 * @param data The fixture data and generated content.
 */
export const addFixtureAndArticle = async (data: {
    fixtureData: {
        opponent: string;
        opponentLogoUrl?: string;
        venue: string;
        competition: string;
        date: Date;
        notes?: string;
        publishArticle: boolean;
    };
    preview: string;
    tags: string[];
}) => {
    const { fixtureData, preview, tags } = data;
    const batch = writeBatch(db);

    try {
        let articleId: string | undefined = undefined;

        // If the admin wants to publish a news article, create it first.
        if (fixtureData.publishArticle) {
            const articleRef = doc(newsCollectionRef);
            articleId = articleRef.id;

            batch.set(articleRef, {
                headline: `Upcoming Match: Capital City FC vs ${fixtureData.opponent}`,
                content: preview,
                tags: tags,
                imageUrl: fixtureData.opponentLogoUrl || "", 
                date: fixtureData.date.toISOString(),
                createdAt: serverTimestamp(),
            });
        }
        
        // Create the fixture document
        const fixtureRef = doc(fixturesCollectionRef);
        const newFixtureData: Omit<Fixture, 'id'> = {
            ...fixtureData,
            articleId: articleId,
            status: "UPCOMING",
            score: { home: 0, away: 0 },
            createdAt: serverTimestamp(),
        } as any;

        batch.set(fixtureRef, newFixtureData);

        await batch.commit();

    } catch (error) {
        console.error("Error adding fixture and/or article: ", error);
        throw new Error("Failed to add fixture.");
    }
};


/**
 * Posts a live update to a fixture, including score, status, and a timeline event.
 * @param fixtureId The ID of the fixture to update.
 * @param updateData The data for the update.
 */
export const postLiveUpdate = async (
    fixtureId: string,
    updateData: {
        homeScore: number;
        awayScore: number;
        status: "UPCOMING" | "LIVE" | "FT";
        eventText: string;
        eventType: "Goal" | "Red Card" | "Match End" | "Info";
    }
) => {
    const { homeScore, awayScore, status, eventText, eventType } = updateData;
    const fixtureDocRef = doc(db, "fixtures", fixtureId);
    const liveEventsColRef = collection(db, "fixtures", fixtureId, "liveEvents");

    const batch = writeBatch(db);

    // 1. Update the score and status on the main fixture document
    batch.update(fixtureDocRef, {
        "score.home": homeScore,
        "score.away": awayScore,
        "status": status,
    });

    // 2. Add a new document to the liveEvents subcollection
    const newEventRef = doc(liveEventsColRef);
    batch.set(newEventRef, {
        text: eventText,
        type: eventType,
        timestamp: serverTimestamp(),
        // You could add more structured data here based on eventType
        score: `${homeScore} - ${awayScore}`
    });

    await batch.commit();
};
