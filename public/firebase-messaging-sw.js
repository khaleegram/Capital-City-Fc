// Scripts for Firebase
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC9alUkqtvrjudCzE3xFkUsHw8kqK_8w64",
  authDomain: "capital-city-app.firebaseapp.com",
  projectId: "capital-city-app",
  storageBucket: "capital-city-app.appspot.com",
  messagingSenderId: "883323125833",
  appId: "1:883323125833:web:8641022c00620f6928bf98",
  measurementId: "G-C1ST753CL3"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192x192.png',
    data: {
      url: payload.data.url || '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Event listener for notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(function(clientList) {
      if (clientList.length > 0) {
        for (const client of clientList) {
           if (new URL(client.url).pathname === new URL(urlToOpen).pathname) {
              return client.focus();
           }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
