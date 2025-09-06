
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
  uploadString,
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
 * Converts a data URI to a Blob object.
 * @param dataURI The data URI string.
 * @returns A Blob object.
 */
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

/**
 * Adds a new video and associated player tags to Firestore.
 * @param videoData The metadata for the new video.
 * @param taggedPlayers An array of Player objects that are tagged in the video.
 */
export const addVideoWithTags = async (
    videoData: { title: string; description: string; video: File },
    taggedPlayers: Player[]
) => {
  const batch = writeBatch(db);
  try {
    // 1. Upload video and create a thumbnail
    const videoFile = videoData.video;
    const thumbnailUrl = await uploadFile(await createThumbnail(videoFile), 'videos/thumbnails');
    const videoUrl = await uploadVideoFile(videoFile);

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


/**
 * Generates a thumbnail from a video file.
 * @param file The video file.
 * @returns A Promise that resolves to the thumbnail File object.
 */
const createThumbnail = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
        const videoUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        video.style.display = "none";
        canvas.style.display = "none";

        video.muted = true;
        video.src = videoUrl;
        video.currentTime = 1; // Capture frame at 1 second

        video.onloadeddata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const thumbnailFile = new File([blob], `thumb_${file.name.split('.')[0]}.jpg`, { type: 'image/jpeg' });
                        resolve(thumbnailFile);
                    } else {
                        reject(new Error("Canvas to Blob conversion failed"));
                    }
                    URL.revokeObjectURL(videoUrl);
                }, 'image/jpeg');
            } else {
                reject(new Error("Failed to get canvas context"));
                URL.revokeObjectURL(videoUrl);
            }
        };
        
        video.onerror = (err) => {
            reject(err);
            URL.revokeObjectURL(videoUrl);
        };
    });
};
