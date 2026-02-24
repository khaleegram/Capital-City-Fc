
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
import { db } from "./firebase";
import type { Player, Video } from "./data";
import { uploadFileToR2, deleteFileFromR2 } from "./r2";

/**
 * Adds a new video and associated player tags to Firestore, using R2 for storage.
 * @param videoData The metadata for the new video, including video and thumbnail files.
 * @param taggedPlayers An array of Player objects that are tagged in the video.
 */
export const addVideoWithTags = async (
    videoData: { title: string; description: string; video: File; thumbnail: File },
    taggedPlayers: Player[]
) => {
  const batch = writeBatch(db);
  try {
    // 1. Upload video and thumbnail to R2
    const thumbnailUrl = await uploadFileToR2(videoData.thumbnail, 'videos/thumbnails');
    const videoUrl = await uploadFileToR2(videoData.video, 'videos/raw');

    // 2. Create the main video document
    const videoRef = doc(collection(db, "videos"));
    batch.set(videoRef, {
        title: videoData.title,
        description: videoData.description,
        videoUrl,
        thumbnailUrl,
        uploadDate: serverTimestamp(),
        taggedPlayers: taggedPlayers.map(p => ({ id: p.id, name: p.name })),
    });

    // 3. Create a document in the junction collection for each tagged player
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

    // 4. Commit the batch
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

        // 3. Delete files from R2 storage
        await deleteFileFromR2(video.videoUrl);
        await deleteFileFromR2(video.thumbnailUrl);
        
        // 4. Commit Firestore deletions
        await batch.commit();
    } catch (error) {
        console.error("Error deleting video:", error);
        throw new Error("Failed to delete video.");
    }
};

export const dataUriToBlob = (dataURI: string): Blob => {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
};
