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
} from "firebase/firestore";
import { db } from "./firebase";
import { v4 as uuidv4 } from "uuid";
import type { Fixture, Player } from "./data";
import { notifyQuietly, uploadFile, deleteFile } from "./admin-client";
import { resolveOpponentCountry } from "@/ai/flows/resolve-opponent-country";
import { flagUrl } from "./flags";
import { syncFixtureRecords } from "./match-sync";
import { syncMatchArticle } from "./match-hub";
import { recomputeMany } from "./player-matches-client";

const fixturesCollectionRef = collection(db, "fixtures");
const newsCollectionRef = collection(db, "news");

/**
 * Uploads an opponent's logo to Cloudflare R2.
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadOpponentLogo = async (imageFile: File): Promise<string> => {
  return uploadFile(imageFile, 'fixtures/logos');
};

/**
 * Flag fallback for an opponent that has no crest to upload.
 *
 * Asks the model which country the club plays in and returns that country's flag, to be
 * stored in `opponentLogoUrl` like any other crest. Best-effort by design: it returns null
 * whenever the club can't be placed, the code that comes back isn't a real flag, or the call
 * itself fails. A fixture must always be saveable without a logo, and the monogram is a
 * better answer than a wrong flag.
 */
export const resolveOpponentFlag = async (
  opponent: string
): Promise<{ country: string; url: string; opponent: string } | null> => {
  try {
    const { country, countryCode, confidence } = await resolveOpponentCountry({ opponent });
    if (confidence === 'low') return null;
    const url = flagUrl(countryCode);
    return url ? { country, url, opponent } : null;
  } catch (error) {
    console.warn('[ccfc] opponent country lookup failed:', error);
    return null;
  }
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
        /** Set once a match has been played; omitted entirely for upcoming fixtures. */
        score?: { home: number; away: number };
        status?: Fixture["status"];
    };
    preview: string;
    tags: string[];
}): Promise<string> => {
    const { fixtureData, preview, tags } = data;
    const batch = writeBatch(db);

    try {
        let articleId: string | undefined = undefined;

        // Declared first: the article links back to it, and it is written in the same batch.
        const fixtureRef = doc(fixturesCollectionRef);

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
                /*
                 * Back-link and provenance.
                 *
                 * `fixtureId` lets the match hub find this article from the fixture side, and
                 * `generatedFrom` marks it as machine-written so the hub may rewrite it into the
                 * match report once the game is played. Without the marker, a finished match
                 * would keep a preview headlined "Upcoming Match" for ever.
                 */
                fixtureId: fixtureRef.id,
                generatedFrom: "preview",
                // The admin ticked "publish preview as news article", so it goes live. The public
                // news list filters on this field.
                published: true,
                createdAt: serverTimestamp(),
            });
        }
        
        // Create the fixture document
        const newFixtureData: Omit<Fixture, 'id'> = {
            ...fixtureData,
            articleId: articleId,
            status: fixtureData.status ?? "UPCOMING",
            score: fixtureData.score ?? { home: 0, away: 0 },
            createdAt: serverTimestamp(),
            activePlayers: fixtureData.startingXI || [], // Initially, active players are the starters
        } as any;

        batch.set(fixtureRef, newFixtureData);

        await batch.commit();

        // Returned so the caller can attach the match's news report and its player records to
        // the document it just created — both are keyed by the fixture id.
        return fixtureRef.id;

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

            /*
             * A lineup or a result changes who played and who scored, so the match's player
             * records are rebuilt from the fixture and its events.
             *
             * Done here rather than left to the caller: several screens update a fixture, and a
             * new one that forgot to ask would silently leave the statistics stale. The rebuild
             * is idempotent, so an update that changed nothing relevant costs one no-op pass.
             */
            const affectsRecords = ["startingXI", "substitutes", "score", "status"].some(
                (key) => key in updatePayload
            );
            if (affectsRecords) {
                try {
                    await syncFixtureRecords(fixtureId);
                } catch (err) {
                    console.warn("[ccfc] player records not refreshed after fixture update:", err);
                }
            }
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

        /*
         * The match's player records go with it.
         *
         * These used to be increments on the player, which a delete could not take back — so
         * removing a fixture left its appearances and goals standing. Records can simply be
         * removed, and the affected players recomputed from what is left.
         */
        const records = await getDocs(query(collection(db, "playerMatches"), where("fixtureId", "==", fixture.id)));
        const affected = new Set<string>();
        for (const d of records.docs) {
            const playerId = d.data().playerId as string | undefined;
            if (playerId) affected.add(playerId);
            batch.delete(d.ref);
        }

        if (fixture.opponentLogoUrl) {
            await deleteFile(fixture.opponentLogoUrl);
        }

        await batch.commit();

        if (affected.size > 0) await recomputeMany([...affected]);
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
/**
 * Builds the push copy for a live event, mirroring the mapping the old Firestore trigger
 * used — including skipping "Info" events and any event with no text.
 */
function liveEventPush(event: {
    type: string;
    text: string;
    score: string;
    playerName?: string | null;
    teamName?: string | null;
}): { title: string; body: string } | null {
    switch (event.type) {
        case "Goal":
            return { title: "⚽ GOAL!", body: `${event.playerName || "Unknown Player"} scores for ${event.teamName || "Team"} — ${event.score}` };
        case "Red Card":
            return { title: "🟥 Red Card", body: `${event.playerName || "Player"} sent off for ${event.teamName || "Team"}` };
        case "Substitution":
            return event.text ? { title: "🔄 Substitution", body: event.text } : null;
        case "Match End":
            return { title: "✅ Full Time", body: `Match finished. Final score: ${event.score}` };
        default:
            return event.type !== "Info" && event.text ? { title: "Match Update", body: event.text } : null;
    }
}

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

    /*
     * Ids of what this call creates, returned to the caller.
     *
     * The assistant's undo needs them: reversing a posted goal means deleting the timeline entry it
     * added, and reversing a final whistle means removing the report it drafted. Neither id can be
     * recovered afterwards, so they are handed back rather than left for the caller to guess at.
     */
    let createdEventId: string | null = null;
    let draftedArticleId: string | null = null;
    
    try {
        await runTransaction(db, async (transaction) => {
            const fixtureDoc = await transaction.get(fixtureDocRef);
            if (!fixtureDoc.exists()) {
                throw "Fixture does not exist!";
            }

            const fixtureUpdate: any = {
                "score.home": homeScore,
                "score.away": awayScore,
                "status": status,
            };

            /*
             * Match clock timestamps.
             *
             * Player statistics used to be incremented here — appearances on kick-off, goals and
             * assists on each goal — which is why they couldn't be trusted. A match entered as a
             * bare score wrote none of them, a corrected result left the old increments behind,
             * and posting this event twice counted the whole XI twice.
             *
             * Nothing here touches a player now. The event is recorded, and `syncFixtureRecords`
             * afterwards re-derives the fixture's records from the events in one pass, so the
             * result depends only on what actually happened rather than on the order it arrived.
             */
            if (eventType === 'Match Start') fixtureUpdate.kickoffTime = serverTimestamp();
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

            transaction.update(fixtureDocRef, fixtureUpdate);

            const newEventRef = doc(liveEventsColRef);
            createdEventId = newEventRef.id;
            transaction.set(newEventRef, {
                text: eventText,
                type: eventType,
                timestamp: serverTimestamp(),
                score: `${homeScore} - ${awayScore}`,
                playerName: playerName || goal?.scorer.name || null,
                // The scorer's id, so a goal can be attributed exactly rather than by matching
                // the name back to a lineup after the fact.
                scorerPlayer: goal?.scorer ? { id: goal.scorer.id, name: goal.scorer.name } : null,
                assistPlayer: goal?.assist ? { id: goal.assist.id, name: goal.assist.name } : null,
                subOffPlayer: substitution?.subOffPlayer ? { id: substitution.subOffPlayer.id, name: substitution.subOffPlayer.name } : null,
                subOnPlayer: substitution?.subOnPlayer ? { id: substitution.subOnPlayer.id, name: substitution.subOnPlayer.name } : null,
                teamName: teamName || null,
                minute: minute,
            });
        });

        /*
         * Re-derive this match's player records. Only the events that can change who played or
         * who scored are worth the round trip; a half-time marker or a note changes nothing.
         *
         * Runs after the transaction on purpose: the match update is the thing that must not
         * fail, and a statistics rebuild is recoverable at any time.
         */
        if (["Match Start", "Substitution", "Goal", "Match End"].includes(eventType)) {
            try {
                await syncFixtureRecords(fixtureId);
            } catch (err) {
                console.warn("[ccfc] player records not refreshed after live update:", err);
            }
        }

        /*
         * Full time writes the report.
         *
         * A match played through the console never touched the fixture form, so without this it
         * would end without news — the same gap that let fourteen results sit on the site with no
         * report at all. Drafted rather than published: it still goes through the news admin.
         */
        if (eventType === "Match End") {
            try {
                const report = await syncMatchArticle(fixtureId);
                if (report.created) draftedArticleId = report.articleId;
            } catch (err) {
                console.warn("[ccfc] match ended but no report was drafted:", err);
            }
        }

        // Push the update to subscribers. This replaces the old Firestore onCreate trigger,
        // which Vercel can't run because Cloud Functions need the paid Blaze plan.
        // Never throws, so a failed push can't undo an already-posted update.
        const copy = liveEventPush({
            type: eventType,
            text: eventText,
            score: `${homeScore} - ${awayScore}`,
            playerName: playerName || goal?.scorer.name || null,
            teamName: teamName || null,
        });
        if (copy) await notifyQuietly(copy.title, copy.body, `/fixtures/${fixtureId}`);
        return { eventId: createdEventId, articleId: draftedArticleId, articleCreated: Boolean(draftedArticleId) };
    } catch(e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Transaction failed: ", e);
        throw new Error(`Failed to post live update: ${errorMessage}`);
    }
};
