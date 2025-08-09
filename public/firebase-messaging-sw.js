
// This file needs to be in the public directory

importScripts("https://www.gstatic.com/firebasejs/9.2.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.2.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyC9alUkqtvrjudCzE3xFkUsHw8kqK_8w64",
  authDomain: "capital-city-app.firebaseapp.com",
  projectId: "capital-city-app",
  storageBucket: "capital-city-app.appspot.com",
  messagingSenderId: "883323125833",
  appId: "1:883323125833:web:8641022c00620f6928bf98",
  measurementId: "G-C1ST753CL3"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.image || '/icon-192x192.png' 
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
