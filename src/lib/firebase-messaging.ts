
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, db } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const getFcmToken = async (): Promise<string | null> => {
  const supported = await isSupported();
  if (!supported || typeof window === 'undefined') {
    console.log("Firebase Messaging is not supported in this browser.");
    return null;
  }

  const messaging = getMessaging(app);

  try {
    const status = await Notification.requestPermission();
    if (status === 'granted') {
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
      });
      if (fcmToken) {
        return fcmToken;
      }
    }
  } catch (error) {
    console.error('An error occurred while retrieving token. ', error);
  }

  return null;
};

export const saveFcmToken = async (token: string, userId: string) => {
  try {
    const tokenRef = doc(db, 'userPushTokens', userId);
    await setDoc(tokenRef, {
      token: token,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log("FCM token saved for user:", userId);
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
};
