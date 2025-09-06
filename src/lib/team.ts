import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage, app } from "./firebase";
import type { TeamProfile } from "./data";
import { v4 as uuidv4 } from "uuid";
import { getFunctions, httpsCallable } from "firebase/functions";

const TEAM_PROFILE_DOC_ID = "main_profile";

/**
 * Retrieves the main team profile from Firestore.
 * Creates a default one if it doesn't exist.
 * @returns The team profile object.
 */
export const getTeamProfile = async (): Promise<TeamProfile> => {
  const profileDocRef = doc(db, "teamProfile", TEAM_PROFILE_DOC_ID);
  const docSnap = await getDoc(profileDocRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as TeamProfile;
  } else {
    // If no profile exists, create a default one
    const defaultProfile: TeamProfile = {
      id: TEAM_PROFILE_DOC_ID,
      name: "Capital City FC",
      logoUrl: "/icon.png",
      homeVenue: "Capital Stadium",
    };
    await setDoc(profileDocRef, defaultProfile);
    return defaultProfile;
  }
};

/**
 * Uploads the team's logo to Firebase Storage.
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadTeamLogo = async (imageFile: File): Promise<string> => {
  const imageId = uuidv4();
  const imageRef = ref(storage, `team/logos/${imageId}_${imageFile.name}`);
  await uploadBytes(imageRef, imageFile);
  const downloadURL = await getDownloadURL(imageRef);
  return downloadURL;
};

/**
 * Updates the main team profile in Firestore.
 * @param profileData The data to update.
 */
export const updateTeamProfile = async (profileData: Partial<Omit<TeamProfile, 'id'>>) => {
  try {
    const profileDocRef = doc(db, "teamProfile", TEAM_PROFILE_DOC_ID);
    await setDoc(profileDocRef, {
      ...profileData,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("Error updating team profile: ", error);
    throw new Error("Failed to update team profile.");
  }
};

/**
 * Sends a custom push notification to all users via a callable function.
 * @param title The title of the notification.
 * @param body The body message of the notification.
 */
export const sendCustomNotification = async (title: string, body: string) => {
  try {
    const functions = getFunctions(app);
    const sendNotification = httpsCallable(functions, 'sendCustomNotification');
    const result = await sendNotification({ title, body });
    return result.data;
  } catch (error) {
    console.error("Error calling sendCustomNotification function:", error);
    throw new Error("Failed to send custom notification.");
  }
};
