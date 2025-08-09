
import {
  collection,
  addDoc,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { v4 as uuidv4 } from 'uuid';
import type { Player } from "./data";

/**
 * Uploads a file to a specified path in Firebase Storage.
 * @param file The file to upload.
 * @param path The storage path (e.g., 'videos/raw').
 * @returns The public URL of the uploaded file.
 */
const uploadFile = async (file: File, path: string): Promise<string> => {
    const fileId = uuidv4();
    const fileRef = ref(storage, `${path}/${fileId}_${file.name}`);
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
}

export const uploadVideoFile = (file: File) => uploadFile(file, 'videos/raw');
export const uploadThumbnailFile = (file: File) => uploadFile(file, 'videos/thumbnails');

/**
 * Adds a new video and associated player tags to Firestore.
 * @param videoData The metadata for the new video.
 * @param taggedPlayers An array of Player objects that are tagged in the video.
 */
export const addVideoWithTags = async (videoData: any, taggedPlayers: Player[]) => {
  try {
    const batch = writeBatch(db);

    // 1. Create the main video document
    const videoRef = doc(collection(db, "videos"));
    batch.set(videoRef, {
        ...videoData,
        uploadDate: serverTimestamp(),
        // Store a lightweight map of tagged players for easy display
        taggedPlayers: taggedPlayers.map(p => ({ id: p.id, name: p.name })),
    });

    // 2. Create a document in the junction collection for each tagged player
    if (taggedPlayers.length > 0) {
      taggedPlayers.forEach(player => {
          const playerVideoRef = doc(collection(db, "playerVideos"));
          batch.set(playerVideoRef, {
              playerId: player.id,
              videoId: videoRef.id,
              taggedAt: serverTimestamp(),
          });
      });
    }

    // 3. Commit the batch
    await batch.commit();

  } catch (error) {
    console.error("Error adding video with tags: ", error);
    throw new Error("Failed to add video.");
  }
};

    