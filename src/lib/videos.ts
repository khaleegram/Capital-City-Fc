
import {
  collection,
  addDoc,
  writeBatch,
  doc,
  serverTimestamp,
  deleteDoc,
  getDocs,
  where,
  query,
  updateDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { v4 as uuidv4 } from 'uuid';
import type { Player, Video } from "./data";

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
  const batch = writeBatch(db);
  try {
    // 1. Create the main video document
    const videoRef = doc(collection(db, "videos"));
    batch.set(videoRef, {
        ...videoData,
        uploadDate: serverTimestamp(),
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


/**
 * Updates an existing video and its tags in Firestore.
 * @param videoId The ID of the video to update.
 * @param videoData The new metadata for the video.
 */
export const updateVideo = async (videoId: string, videoData: Partial<Omit<Video, 'id'>>) => {
    const batch = writeBatch(db);
    const videoRef = doc(db, "videos", videoId);
    try {
        // 1. Update the main video document
        batch.update(videoRef, {
            ...videoData,
            updatedAt: serverTimestamp(),
        });

        // 2. Clear existing player tags for this video
        const playerVideosQuery = query(collection(db, "playerVideos"), where("videoId", "==", videoId));
        const oldTagsSnapshot = await getDocs(playerVideosQuery);
        oldTagsSnapshot.forEach(doc => batch.delete(doc.ref));

        // 3. Add new player tags
        if (videoData.taggedPlayers && videoData.taggedPlayers.length > 0) {
            videoData.taggedPlayers.forEach(player => {
                const playerVideoRef = doc(collection(db, "playerVideos"));
                batch.set(playerVideoRef, {
                    playerId: player.id,
                    videoId: videoId,
                    taggedAt: serverTimestamp(),
                });
            });
        }
        
        await batch.commit();
    } catch (error) {
        console.error("Error updating video:", error);
        throw new Error("Failed to update video.");
    }
};

/**
 * Deletes a video, its storage files, and its tags from Firestore.
 * @param video The video object to delete.
 */
export const deleteVideo = async (video: Video) => {
    const batch = writeBatch(db);
    const videoRef = doc(db, "videos", video.id);
    try {
        // 1. Delete the video document
        batch.delete(videoRef);

        // 2. Delete player tags
        const playerVideosQuery = query(collection(db, "playerVideos"), where("videoId", "==", video.id));
        const tagsSnapshot = await getDocs(playerVideosQuery);
        tagsSnapshot.forEach(doc => batch.delete(doc.ref));

        // 3. Delete files from storage
        const videoFileRef = ref(storage, video.videoUrl);
        const thumbnailFileRef = ref(storage, video.thumbnailUrl);
        
        await deleteObject(videoFileRef).catch(e => console.warn("Video file not found during deletion:", e.code));
        await deleteObject(thumbnailFileRef).catch(e => console.warn("Thumbnail file not found during deletion:", e.code));
        
        // 4. Commit Firestore deletions
        await batch.commit();
    } catch (error) {
        console.error("Error deleting video:", error);
        throw new Error("Failed to delete video.");
    }
};
