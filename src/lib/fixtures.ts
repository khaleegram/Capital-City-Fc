'use client';

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
import { db } from "./firebase";
import { v4 as uuidv4 } from "uuid";
import type { Fixture, Player } from "./data";
import { uploadFileToR2, deleteFileFromR2 } from "./r2";

const fixturesCollectionRef = collection(db, "fixtures");
const newsCollectionRef = collection(db, "news");
const playersCollectionRef = collection(db, "players");

/**
 * Uploads an opponent's logo to Cloudflare R2.
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadOpponentLogo = async (imageFile: File): Promise<string> => {
  return uploadFileToR2(imageFile, 'teams/logos');
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error adding fixture and/or article: ", errorMessage);
        throw new Error(`Failed to add fixture: ${errorMessage}`);
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
        
        const updatePayload: { [key: string]: any } = {};
        // Sanitize payload
        Object.keys(fixtureData).forEach(key => {
            const K = key as keyof typeof fixtureData;
            if (fixtureData[K] !== undefined) {
                updatePayload[K] = fixtureData[K];
            }
        });

        // If starting XI is being updated, also update activePlayers
        if (updatePayload.startingXI) {
            updatePayload.activePlayers = updatePayload.startingXI;
        }

        if (Object.keys(updatePayload).length > 0) {
            updatePayload.updatedAt = serverTimestamp();
            await updateDoc(fixtureDocRef, updatePayload);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error updating fixture: ", errorMessage);
        throw new Error(`Failed to update fixture: ${errorMessage}`);
    }
};


/**
 * Deletes a fixture and its associated preview article if it exists.
 * @param fixture The fixture object to delete.
 */
export const deleteFixture = async (fixture: Fixture) => {
    const batch = writeBatch(db);
    try {
        const fixtureDocRef = doc(db, "fixtures", fixture.id);
        batch.delete(fixtureDocRef);

        if (fixture.articleId) {
            const articleDocRef = doc(db, "news", fixture.articleId);
            batch.delete(articleDocRef);
        }
        
        if (fixture.opponentLogoUrl) {
            await deleteFileFromR2(fixture.opponentLogoUrl);
        }

        await batch.commit();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error deleting fixture:", errorMessage);
        throw new Error(`Failed to delete fixture: ${errorMessage}`);
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
                if (fixtureData.startingXI) {
                    for (const player of fixtureData.startingXI) {
                        const playerRef = doc(playersCollectionRef, player.id);
                        transaction.update(playerRef, { "stats.appearances": increment(1) });
                    }
                }
            }
            if (eventType === 'Half Time') fixtureUpdate.firstHalfEndTime = serverTimestamp();
            if (eventType === 'Second Half Start') fixtureUpdate.secondHalfStartTime = serverTimestamp();
            
            if (eventType === 'Substitution' && substitution) {
                transaction.update(fixtureDocRef, { 
                    activePlayers: arrayRemove(substitution.subOffPlayer),
                });
                transaction.update(fixtureDocRef, {
                    activePlayers: arrayUnion(substitution.subOnPlayer)
                });
            }

            if (eventType === 'Goal' && goal) {
                const scorerRef = doc(playersCollectionRef, goal.scorer.id);
                transaction.update(scorerRef, { "stats.goals": increment(1) });
                if (goal.assist) {
                    const assistRef = doc(playersCollectionRef, goal.assist.id);
                    transaction.update(assistRef, { "stats.assists": increment(1) });
                }
            }

            transaction.update(fixtureDocRef, fixtureUpdate);

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
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Transaction failed: ", e);
        throw new Error(`Failed to post live update: ${errorMessage}`);
    }
};
