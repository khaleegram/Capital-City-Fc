import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Firebase Cloud Messaging background worker.
 *
 * This is a route rather than a file in `public/` because a service worker cannot read
 * `process.env` — serving it from here lets the public Firebase config come from the
 * environment instead of being hard-coded. Do NOT also add a file at
 * `public/firebase-messaging-sw.js`: Next treats the two as a conflict and fails the request
 * with a 500, which would break the worker that `importScripts` depends on.
 *
 * It is pulled into next-pwa's `/sw.js` via `importScripts` (see next.config.ts) so that
 * offline caching and push share one worker at the `/` scope. It must never register itself.
 */
export function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
  }

  const body = `/* eslint-disable */
// Pinned to the version of the Firebase SDK the app itself loads, so the worker and the page
// agree on the wire format.
importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js");

const firebaseConfig = ${JSON.stringify(config)};

const ICON = "/icons/icon-192x192.png";
const BADGE = "/icons/icon-96x96.png";

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    /*
     * A message carrying a \`notification\` payload is already displayed by the browser, so
     * drawing it here as well notifies the visitor twice. Only data-only messages need
     * handling by hand; the server sends both shapes.
     */
    if (payload && payload.notification) return;

    const data = (payload && payload.data) || {};
    self.registration.showNotification(data.title || "Capital City FC", {
      body: data.body || "",
      icon: ICON,
      badge: BADGE,
      data: { url: data.url || "/" },
    });
  });
}

/*
 * Without this, tapping a notification closed it and went nowhere — the url we send in the
 * data payload had no handler. Focus an existing tab on that page if there is one, else open it.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      for (const client of windows) {
        if ("navigate" in client) {
          return client.navigate(target).then((navigated) => (navigated && "focus" in navigated ? navigated.focus() : undefined));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
`

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // The worker is generated per request, so it must never be cached or a config change
      // would take effect only after the old copy expired.
      "Cache-Control": "no-store",
      "Service-Worker-Allowed": "/",
    },
  })
}
