const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Function triggers whenever a new live event is created
exports.sendLiveUpdateNotification = functions.firestore
  .document("fixtures/{fixtureId}/liveEvents/{eventId}")
  .onCreate(async (snap, context) => {
    const event = snap.data();
    const fixtureId = context.params.fixtureId;

    // 1. Build a message based on event type
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
        // For "Info" and other types, use the text directly if it's engaging enough
        // Or simply don't send a notification for minor events.
        if (event.type !== "Info") {
            title = "Match Update";
            body = event.text;
        } else {
            // Don't send notifications for generic info posts.
            console.log(`Skipping notification for info event in fixture ${fixtureId}`);
            return null;
        }
    }


    // 2. Get all tokens
    const tokensSnap = await admin.firestore().collection("userPushTokens").get();
    const tokens = tokensSnap.docs.map(doc => doc.data().token).filter(Boolean);

    if (tokens.length === 0) {
      console.log("No push tokens found");
      return null;
    }

    // 3. Create the message payload
    const message = {
      notification: { title, body },
      data: { 
          fixtureId, 
          url: `/fixtures/${fixtureId}` 
      },
      tokens
    };

    // 4. Send push notifications
    const response = await admin.messaging().sendEachForMulticast(message);

    // 5. Remove invalid tokens
    const invalidTokens = [];
    response.responses.forEach((res, i) => {
      if (!res.success) {
        const error = res.error?.code || "";
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

    console.log(`Notification sent for fixture ${fixtureId}`);
    return null;
  });

