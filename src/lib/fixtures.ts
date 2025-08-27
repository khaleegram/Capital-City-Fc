
import {
  collection,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  arrayUnion,
  arrayRemove,
  runTransaction,
  increment,
} from "firebase/firestore";
import { db, storage } from "./firebase";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import type { Fixture, Player } from "./data";

const fixturesCollectionRef = collection(db, "fixtures");
const newsCollectionRef = collection(db, "news");
const playersCollectionRef = collection(db, "players");

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
        startingXI?: Player[];
        substitutes?: Player[];
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
            activePlayers: fixtureData.startingXI || [], // Initially, active players are the starters
        } as any;

        batch.set(fixtureRef, newFixtureData);

        await batch.commit();

    } catch (error) {
        console.error("Error adding fixture and/or article: ", error);
        throw new Error("Failed to add fixture.");
    }
};

/**
 * Updates an existing fixture in Firestore.
 * @param fixtureId The ID of the fixture to update.
 * @param fixtureData The data to update.
 */
export const updateFixture = async (fixtureId: string, fixtureData: Partial<Omit<Fixture, 'id'>>) => {
    try {
        const fixtureDocRef = doc(db, "fixtures", fixtureId);
        
        // If starting XI is being updated, also update activePlayers
        if (fixtureData.startingXI) {
            fixtureData.activePlayers = fixtureData.startingXI;
        }

        await updateDoc(fixtureDocRef, {
            ...fixtureData,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error updating fixture: ", error);
        throw new Error("Failed to update fixture.");
    }
};


/**
 * Deletes a fixture and its associated preview article if it exists.
 * @param fixture The fixture object to delete.
 */
export const deleteFixture = async (fixture: Fixture) => {
    const batch = writeBatch(db);
    try {
        // Delete the fixture document
        const fixtureDocRef = doc(db, "fixtures", fixture.id);
        batch.delete(fixtureDocRef);

        // If there's an associated article, delete it as well.
        if (fixture.articleId) {
            const articleDocRef = doc(db, "news", fixture.articleId);
            batch.delete(articleDocRef);
        }
        
        // If there's a logo in storage, delete it.
        // Note: This assumes the URL contains the storage path.
        if (fixture.opponentLogoUrl && fixture.opponentLogoUrl.includes('firebasestorage.googleapis.com')) {
            try {
                const logoRef = ref(storage, fixture.opponentLogoUrl);
                await deleteObject(logoRef);
            } catch (storageError: any) {
                // It's possible the file doesn't exist or permissions are wrong,
                // but we don't want this to block the Firestore deletion.
                console.warn("Could not delete opponent logo from storage:", storageError.code);
            }
        }

        await batch.commit();
    } catch (error) {
        console.error("Error deleting fixture:", error);
        throw new Error("Failed to delete fixture.");
    }
};


type SubstitutionData = {
    subOffPlayer: Player;
    subOnPlayer: Player;
}

type GoalData = {
    scorer: Player;
    assist?: Player;
}

/**
 * Posts a live update to a fixture, including score, status, and a timeline event.
 * Also atomically updates player statistics based on the event.
 * @param fixtureId The ID of the fixture to update.
 * @param updateData The data for the update.
 */
export const postLiveUpdate = async (
    fixtureId: string,
    updateData: {
        homeScore: number;
        awayScore: number;
        status: "UPCOMING" | "LIVE" | "FT" | "HT";
        eventText: string;
        eventType: "Goal" | "Red Card" | "Substitution" | "Info" | "Match Start" | "Half Time" | "Second Half Start" | "Match End";
        teamName?: string;
        substitution?: SubstitutionData;
        goal?: GoalData;
        playerName?: string;
        minute: number;
    }
) => {
    const { homeScore, awayScore, status, eventText, eventType, teamName, substitution, goal, playerName, minute } = updateData;
    const fixtureDocRef = doc(db, "fixtures", fixtureId);
    const liveEventsColRef = collection(db, "fixtures", fixtureId, "liveEvents");
    
    try {
        await runTransaction(db, async (transaction) => {
            const fixtureDoc = await transaction.get(fixtureDocRef);
            if (!fixtureDoc.exists()) {
                throw "Fixture does not exist!";
            }
            const fixtureData = fixtureDoc.data() as Fixture;
            
            const fixtureUpdate: any = {
                "score.home": homeScore,
                "score.away": awayScore,
                "status": status,
            };

            // Handle match clock timestamps
            if (eventType === 'Match Start') {
                fixtureUpdate.kickoffTime = serverTimestamp();
                // Increment appearances for all starting players
                if (fixtureData.startingXI) {
                    for (const player of fixtureData.startingXI) {
                        const playerRef = doc(playersCollectionRef, player.id);
                        transaction.update(playerRef, { "stats.appearances": increment(1) });
                    }
                }
            }
            if (eventType === 'Half Time') fixtureUpdate.firstHalfEndTime = serverTimestamp();
            if (eventType === 'Second Half Start') fixtureUpdate.secondHalfStartTime = serverTimestamp();
            
            // If it's a substitution, update the activePlayers list
            if (eventType === 'Substitution' && substitution) {
                transaction.update(fixtureDocRef, { 
                    activePlayers: arrayRemove(substitution.subOffPlayer),
                });
                transaction.update(fixtureDocRef, {
                    activePlayers: arrayUnion(substitution.subOnPlayer)
                });
            }

            // If it's a goal, update player stats
            if (eventType === 'Goal' && goal) {
                const scorerRef = doc(playersCollectionRef, goal.scorer.id);
                transaction.update(scorerRef, { "stats.goals": increment(1) });
                if (goal.assist) {
                    const assistRef = doc(playersCollectionRef, goal.assist.id);
                    transaction.update(assistRef, { "stats.assists": increment(1) });
                }
            }

            // Update the main fixture document
            transaction.update(fixtureDocRef, fixtureUpdate);

            // Add a new document to the liveEvents subcollection
            const newEventRef = doc(liveEventsColRef);
            transaction.set(newEventRef, {
                text: eventText,
                type: eventType,
                timestamp: serverTimestamp(),
                score: `${homeScore} - ${awayScore}`,
                playerName: playerName || goal?.scorer.name || null,
                assistPlayer: goal?.assist ? { id: goal.assist.id, name: goal.assist.name } : null,
                subOffPlayer: substitution?.subOffPlayer ? { id: substitution.subOffPlayer.id, name: substitution.subOffPlayer.name } : null,
                subOnPlayer: substitution?.subOnPlayer ? { id: substitution.subOnPlayer.id, name: substitution.subOnPlayer.name } : null,
                teamName: teamName || null,
                minute: minute,
            });
        });
    } catch(e) {
        console.error("Transaction failed: ", e);
        throw new Error("Failed to post live update.");
    }
};

