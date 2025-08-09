
import {
  collection,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";

const fixturesCollectionRef = collection(db, "fixtures");
const newsCollectionRef = collection(db, "news");

/**
 * Adds a new fixture and optionally a corresponding news article.
 * @param data The fixture data and generated content.
 */
export const addFixtureAndArticle = async (data: {
    fixtureData: {
        opponent: string;
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
                headline: `Upcoming Match: ${fixtureData.opponent}`,
                content: preview,
                tags: tags,
                imageUrl: "", // Placeholder for image
                date: fixtureData.date.toISOString(),
                createdAt: serverTimestamp(),
            });
        }
        
        // Create the fixture document
        const fixtureRef = doc(fixturesCollectionRef);
        batch.set(fixtureRef, {
            ...fixtureData,
            articleId: articleId,
            createdAt: serverTimestamp(),
        });

        await batch.commit();

    } catch (error) {
        console.error("Error adding fixture and/or article: ", error);
        throw new Error("Failed to add fixture.");
    }
};
