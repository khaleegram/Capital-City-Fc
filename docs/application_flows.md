# Developer Guide: Application Workflows

This document provides a high-level overview of the core application flows, detailing the interaction between the user interface, backend services, and AI agents.

---

## 1. Content Creation & AI Workflows

This suite of features enables administrators to rapidly create engaging content using AI assistance.

### 1.1. News Article Generation

*   **User Story**: An admin needs to write a news article but only has a few bullet points from a press release or match notes.
*   **UI (`NewsEditor.tsx`)**: The admin enters bullet points into a `Textarea`.
*   **AI Flow (`generate-news-article.ts`)**:
    *   **Input**: A string of bullet points.
    *   **Process**: The flow prompts the AI to act as a sports journalist and expand the bullet points into a full, well-structured article. The AI is instructed to infer a suitable headline.
    *   **Output**: A single string containing the generated headline and article body.
*   **Backend (`news.ts`)**: The `addNewsArticle` function saves the final headline, content, and any associated data to the `news` collection in Firestore.

### 1.2. Tag Suggestion & Social Posts

*   **User Story**: After writing an article, the admin wants to add relevant tags and quickly create social media posts to promote it.
*   **UI (`NewsEditor.tsx`)**:
    1.  After an article is generated or edited, the admin clicks "Suggest Tags".
    2.  The content is sent to the `suggestNewsTags` flow.
    3.  The returned tags are displayed as dismissible badges.
    4.  The admin then clicks "Generate Social Posts".
*   **AI Flows**:
    *   `suggest-news-tags.ts`: Takes the article content and returns an array of relevant string tags (e.g., player names, teams, key events).
    *   `generate-social-post.ts`: Takes the final article content and tags, and returns formatted post text suitable for Twitter and Instagram, complete with appropriate hashtags.
*   **Outcome**: The admin has a ready-to-publish article, relevant tags for SEO, and pre-written social media copy, dramatically speeding up the content lifecycle.

---

## 2. Live Match Management

This flow describes how an admin manages a match in real-time.

*   **User Story**: During a live match, an admin needs to update the score, log key events like goals and substitutions, and keep fans informed via the live feed and push notifications.
*   **UI (`fixtures/[id]/page.tsx`)**:
    1.  **Kickoff**: The admin clicks a "Kickoff" button. This action triggers the `postLiveUpdate` function to change the fixture's status to `LIVE` and creates the first "Match Start" event.
    2.  **Event Selection**: The admin uses radio buttons to select an event type (Goal, Substitution, Red Card, Info).
    3.  **Data Entry**: A conditional form appears. For a "Goal", the admin selects the scorer and optional assist provider from a dropdown of active players. For a "Substitution", they select the player leaving and the player entering.
*   **AI Flow (`generate-event-text.ts`)**:
    *   **Input**: Structured data about the event (e.g., `{ eventType: "Goal", playerName: "Leo Rivera", assistPlayerName: "Marco Jensen" }`).
    *   **Process**: For structured events (Goal, Sub, Card), this AI flow is called automatically. It generates a single, engaging sentence of commentary. For simple "Info" events, the admin can write text directly.
    *   **Output**: A formatted string like: "GOAL for Capital City FC! Leo Rivera finds the back of the net, assisted by Marco Jensen."
*   **Backend (`fixtures.ts` & Cloud Function)**:
    1.  The `postLiveUpdate` function receives the event data and the AI-generated text.
    2.  It runs a Firestore `writeBatch` to:
        *   Update the main fixture document (score, status).
        *   If it's a substitution, it updates the `activePlayers` array on the fixture document.
        *   Create a new document in the `liveEvents` subcollection.
    3.  The creation of a document in `liveEvents` triggers the `sendLiveUpdateNotification` Cloud Function, which then sends a push notification to all subscribed users.

---

## 3. Post-Match Recap & Analytics

This flow automates the creation of detailed match reports after a game has concluded.

*   **User Story**: After a match, an admin wants to quickly publish a detailed recap, including a written summary, a timeline of key events, and an audio version for accessibility.
*   **UI (`RecapGenerator.tsx`)**:
    1.  The admin selects the completed fixture from a dropdown.
    2.  They enter raw, unstructured notes about the match (e.g., "final score 2-0, rivera goal 23', smith goal 78', tough game").
    3.  They click "Generate Recap".
*   **AI Flows**:
    *   `generate-match-recap.ts`: This is the primary analysis flow.
        *   **Input**: The raw match notes.
        *   **Process**: The AI is prompted to act as a journalist and extract structured information. It identifies the final score, goal scorers, key events, and writes a full recap article.
        *   **Output**: A complex JSON object containing the `headline`, `fullRecap`, a chronological `timeline` of events, and `structuredData` like the final score.
    *   `generate-recap-audio.ts`: After the text is generated and finalized, the admin can click "Generate Audio".
        *   **Input**: The final, edited recap text.
        *   **Process**: This flow sends the text to a Text-to-Speech model. It receives raw audio data, which the backend function then encodes into a WAV file format.
        *   **Output**: A base64-encoded Data URI for the WAV audio file.
*   **Backend (`recaps.ts`)**:
    *   The `addRecap` function is called when the admin clicks "Publish".
    *   It takes the final text, timeline, structured data, and optional audio URL.
    *   In a single transaction, it creates a new document in the `recaps` collection and also creates a new `news` article with the recap content, automatically linking the two. This makes the recap instantly available on the public-facing news feed.

---

## 4. RAG-Based AI Assistants

The application uses Retrieval-Augmented Generation (RAG) to provide accurate, context-aware answers to user questions.

### 4.1. Scouting Assistant

*   **User Story**: A scout wants to know about a specific player's strengths, weaknesses, or performance in certain situations.
*   **UI (`PlayerInsights.tsx`)**: The scout selects a player from a dropdown and types a natural language question.
*   **Data Fetching**: Before calling the AI, the frontend fetches the selected player's complete profile from Firestore, as well as all news articles that have been tagged with that player's name.
*   **AI Flow (`answer-scout-questions.ts`)**:
    *   **Input**: The user's question, the player's profile (as a JSON string), and the relevant news articles (as a JSON string).
    *   **Process**: The AI is prompted to act as an expert scout. It is instructed to synthesize an answer *only* using the provided data (the "retrieved" context). This prevents the AI from fabricating information and grounds its answer in facts from the app's database.
    *   **Output**: A well-reasoned, analytical answer to the scout's question.

### 4.2. Fan Chatbot

*   **This flow follows the same RAG pattern as the Scouting Assistant but is tuned for a different audience.**
*   **Data Fetching**: It fetches *all* player profiles and *all* news articles to provide a broad knowledge base.
*   **AI Flow (`answer-fan-questions.ts`)**:
    *   **Input**: A fan's question, plus all player and news data.
    *   **Process**: The prompt instructs the AI to be a friendly, conversational "Club Assistant". It answers questions based on the provided data and is explicitly told to state when it doesn't have the information, rather than guessing.
    *   **Output**: A helpful, conversational response suitable for a public-facing chatbot.
