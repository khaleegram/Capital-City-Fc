
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Sends a push notification to all subscribed users.
 * @param {string} title The title of the notification.
 * @param {string} body The body of the notification.
 * @param {object} data The data payload to send with the notification.
 */
const sendPushNotificationToAll = async (title, body, data) => {
    // 1. Get all user push tokens
    const tokensSnap = await admin.firestore().collection("userPushTokens").get();
    const tokens = tokensSnap.docs.map(doc => doc.data().token).filter(Boolean);

    if (tokens.length === 0) {
      console.log("No push tokens found to send notification.");
      return;
    }

    // 2. Create the message payload
    const message = {
      notification: { title, body },
      data,
      tokens
    };

    // 3. Send push notifications
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Successfully sent message to ${response.successCount} devices.`);

    // 4. Clean up invalid tokens
    if (response.failureCount > 0) {
        const invalidTokens = [];
        response.responses.forEach((res, i) => {
          if (!res.success) {
            const error = res.error?.code || "";
            // These error codes indicate that the token is invalid and should be removed.
            if (error === "messaging/invalid-registration-token" || error === "messaging/registration-token-not-registered") {
              invalidTokens.push(tokens[i]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          const batch = admin.firestore().batch();
          const userTokensRef = admin.firestore().collection("userPushTokens");
          const snapDocs = await userTokensRef.where("token", "in", invalidTokens).get();
          snapDocs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          console.log("Cleaned up invalid tokens:", invalidTokens);
        }
    }
}


// --- Function to notify on live match events ---
exports.sendLiveUpdateNotification = functions.firestore
  .document("fixtures/{fixtureId}/liveEvents/{eventId}")
  .onCreate(async (snap, context) => {
    const event = snap.data();
    const fixtureId = context.params.fixtureId;

    let title = "Match Update";
    let body = event.text || "";

    switch (event.type) {
      case "Goal":
        title = "⚽ GOAL!";
        body = `${event.playerName || "Unknown Player"} scores for ${event.teamName || "Team"} — ${event.score || ""}`;
        break;
      case "Red Card":
        title = "🟥 Red Card";
        body = `${event.playerName || "Player"} — ${event.teamName || "Team"} down to 10 men`;
        break;
      case "Match End":
        title = "✅ Full Time";
        body = event.score || "";
        break;
      default:
         // For "Info" and other types, only send if there's engaging text.
        if (event.type !== "Info" && event.text) {
            title = "Match Update";
            body = event.text;
        } else {
            console.log(`Skipping notification for info event in fixture ${fixtureId}`);
            return null;
        }
    }

    await sendPushNotificationToAll(title, body, { 
        fixtureId, 
        url: `/fixtures/${fixtureId}` 
    });

    console.log(`Live event notification sent for fixture ${fixtureId}`);
    return null;
  });

// --- Function to notify on new news articles ---
exports.sendNewsNotification = functions.firestore
  .document("news/{newsId}")
  .onCreate(async (snap, context) => {
    const article = snap.data();
    const newsId = context.params.newsId;

    const title = "📰 Latest News";
    const body = article.headline || "A new article has been published!";

    await sendPushNotificationToAll(title, body, {
        newsId,
        url: `/news` // Navigate to the main news page
    });
    
    console.log(`News notification sent for article ${newsId}`);
    return null;
});

// --- Function to notify on new videos ---
exports.sendVideoNotification = functions.firestore
  .document("videos/{videoId}")
  .onCreate(async (snap, context) => {
    const video = snap.data();
    const videoId = context.params.videoId;

    const title = "📺 New Video Uploaded";
    const body = video.title || "A new video is available to watch!";

    await sendPushNotificationToAll(title, body, {
        videoId,
        url: `/videos/${videoId}`
    });
    
    console.log(`Video notification sent for video ${videoId}`);
    return null;
});
