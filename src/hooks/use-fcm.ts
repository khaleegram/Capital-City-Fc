
"use client"

import { useEffect } from 'react';
import { getMessaging, onMessage } from 'firebase/messaging';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';
import { getFcmToken, saveFcmToken } from '@/lib/firebase-messaging';
import { app } from '@/lib/firebase';

export const useFcm = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const initFcm = async () => {
      try {
        const token = await getFcmToken();

        if (token && user) {
          console.log('FCM Token:', token);
          await saveFcmToken(token, user.uid);
        }
      } catch (error) {
        console.error('Error getting FCM token:', error);
      }
    };

    if (user) {
      initFcm();
    }
    
    const messaging = getMessaging(app);
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received.', payload);
      toast({
        title: payload.notification?.title,
        description: payload.notification?.body,
      });
    });

    return () => {
      unsubscribe();
    };

  }, [user, toast]);
};
