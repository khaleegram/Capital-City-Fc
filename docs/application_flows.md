# Developer Guide: Application Workflows & Implementation

This document provides a comprehensive overview of the core application flows, detailing the interaction between the user interface, backend services, and AI agents.

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

## 2. Fixture Creation & AI Preview Flow

### User Story

As an admin, I want to create a new match fixture by providing details like the opponent, venue, and date. I also want the system to use AI to automatically generate a short, engaging news preview for the match, which I can then publish.

### Frontend UI Components & Logic

1.  **Fixture Form (`FixtureForm.tsx`)**:
    *   A dialog-based form for creating or editing a fixture.
    *   **Input Fields**:
        *   `opponent`: Text input.
        *   `competition`: Text input.
        *   `venue`: Text input.
        *   `notes`: Textarea (for optional AI context, e.g., "Rivalry match, must-win").
        *   `date`: A date and time picker.
        *   `opponentLogo`: A file input for the opponent's logo.
    *   **AI Interaction**:
        *   A "**Generate Preview**" button. When clicked, it calls the `generateFixturePreview` AI flow.
        *   Once the AI responds, the generated `preview` text is displayed in an editable `Textarea`, and the `tags` are shown.
    *   **Lineup Selection**: Includes a `<PlayerPicker>` component to select Starting XI and Substitutes.
    *   **Submission**: A "**Publish Fixture**" button that sends all the data to the backend.

### AI Flow: `generateFixturePreview`

*   **File**: `src/ai/flows/generate-fixture-preview.ts`
*   **Goal**: To take basic fixture details and produce a short, engaging preview paragraph and relevant tags.

*   **Input Schema (`GenerateFixturePreviewInput`)**:
    ```json
    {
      "opponent": "string",
      "venue": "string",
      "competition": "string",
      "notes": "string (optional)",
      "history": "string (optional)"
    }
    ```

*   **Output Schema (`GenerateFixturePreviewOutput`)**:
    ```json
    {
      "preview": "string",
      "tags": "string[]"
    }
    ```

*   **Core Prompt Logic**:
    > You are a sports journalist for Capital City FC. Your task is to generate a short, engaging match preview and suggest relevant tags based on fixture details.
    >
    > IMPORTANT RULES:
    > - Keep the preview concise (around 50-70 words, max 100).
    > - Be engaging but realistic. Do not overhype unless specified in the notes.
    > - ONLY use the provided historical data. DO NOT invent or fabricate past results or statistics. If no history is provided, do not mention it.
    >
    > Fixture Details:
    > - Opponent: {{{opponent}}}
    > - Venue: {{{venue}}}
    > - Competition: {{{competition}}}
    > {{#if notes}}- Admin Notes: {{{notes}}}{{/if}}
    > {{#if history}}- Head-to-Head History: {{{history}}}{{/if}}
    >
    > Generate the preview and suggest a few relevant tags (like opponent and competition).

### Backend Logic: `addFixtureAndArticle`

*   **File**: `src/lib/fixtures.ts`
*   **Goal**: To create the fixture document and, if requested, the associated news article in a single, atomic transaction.
*   **Process**:
    1.  Receives the user's form data and the AI-generated `preview` and `tags`.
    2.  Initializes a Firestore `writeBatch`.
    3.  If `publishArticle` is true, it creates a new document in the `news` collection. The headline is templatized (e.g., "Upcoming Match: ..."), and the content is the AI-generated preview.
    4.  It then creates the new document in the `fixtures` collection, storing all the match details, the selected lineups, and the ID of the news article if one was created.
    5.  Commits the batch.

---

## 3. Live Match Management

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
## 4. Post-Match Recap & Analytics

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

## 5. Formation Management Flow

### User Story

As an admin, I want to create, save, and manage reusable team formations. I need a visual, drag-and-drop interface to place players in a starting XI and on a substitutes' bench, and then save this lineup with a name for later use in fixture creation.

### Frontend UI Components & Logic

1.  **Formation Manager (`FormationManager.tsx`)**: This is the main component for this feature.
    *   **Layout**: A two-column layout.
        *   **Left/Main Column**: A visual representation of a football pitch with 11 "starter" slots and a "bench" area with 7 "substitute" slots.
        *   **Right Column**: A searchable list of all available players on the team roster.
    *   **Data Fetching**: On component mount, it fetches all players from the `players` collection in Firestore.
    *   **Drag-and-Drop**:
        *   The component is wrapped in a `DndContext` provider from `@dnd-kit/core`.
        *   Each player in the roster list is a draggable item (`PlayerDraggableCard`).
        *   Each slot on the pitch and bench is a droppable area (`DroppablePlayerSlot`).
    *   **State Management**:
        *   `allPlayers`: Holds the full team roster.
        *   `startingXI`: An array of 11 `Player` objects (or `null`).
        *   `substitutes`: An array of 7 `Player` objects (or `null`).
    *   **Interaction Logic**:
        *   When a player is dragged from the roster and dropped onto a slot, the `handleDragEnd` function fires.
        *   It identifies the player and the target slot.
        *   It updates either the `startingXI` or `substitutes` state array at the correct index.
        *   The player is then removed from the "Available Players" list to prevent duplicates.
        *   Players can be removed from a slot, which returns them to the available list.
    *   **Form Input**:
        *   A text input for the `name` of the formation (e.g., "4-4-2 Attacking").
        *   An optional `Textarea` for `notes`.
    *   **Submission**: A "**Save Formation**" button calls the `addFormation` backend function.

2.  **Saved Formations List**:
    *   Below the manager, a list of previously saved formations is displayed.
    *   Each item can be clicked to "load" it back into the manager for editing or can be deleted.

### Backend Logic: `addFormation`

*   **File**: `src/lib/formations.ts`
*   **Goal**: To save a new formation document to Firestore.
*   **Process**:
    1.  Receives the `name`, arrays of `startingXI` and `substitutes` players, and optional `notes`.
    2.  To keep documents lightweight, it maps over the player arrays, storing only essential data (`id`, `name`, `position`, `jerseyNumber`, `imageUrl`) for each player, rather than the entire player object.
    3.  Adds a new document to the `formations` collection with the provided data and a server timestamp.

---

## 6. RAG-Based AI Assistants

The application uses Retrieval-Augmented Generation (RAG) to provide accurate, context-aware answers to user questions.

### 6.1. Scouting Assistant

*   **User Story**: A scout wants to know about a specific player's strengths, weaknesses, or performance in certain situations.
*   **UI (`PlayerInsights.tsx`)**: The scout selects a player from a dropdown and types a natural language question.
*   **Data Fetching**: Before calling the AI, the frontend fetches the selected player's complete profile from Firestore, as well as all news articles that have been tagged with that player's name.
*   **AI Flow (`answer-scout-questions.ts`)**:
    *   **Input**: The user's question, the player's profile (as a JSON string), and the relevant news articles (as a JSON string).
    *   **Process**: The AI is prompted to act as an expert scout. It is instructed to synthesize an answer *only* using the provided data (the "retrieved" context). This prevents the AI from fabricating information and grounds its answer in facts from the app's database.
    *   **Output**: A well-reasoned, analytical answer to the scout's question.

### 6.2. Fan Chatbot

*   **This flow follows the same RAG pattern as the Scouting Assistant but is tuned for a different audience.**
*   **Data Fetching**: It fetches *all* player profiles and *all* news articles to provide a broad knowledge base.
*   **AI Flow (`answer-fan-questions.ts`)**:
    *   **Input**: A fan's question, plus all player and news data.
    *   **Process**: The prompt instructs the AI to be a friendly, conversational "Club Assistant". It answers questions based on the provided data and is explicitly told to state when it doesn't have the information, rather than guessing.
    *   **Output**: A helpful, conversational response suitable for a public-facing chatbot.

---
## 7. AI Player Highlight Generation

This feature allows admins to automatically create short, dynamic video clips for players using a single profile image.

*   **User Story**: An admin wants to create a quick, engaging highlight video for a player for social media or their profile page, but doesn't have time to edit match footage.
*   **UI (`PlayerHighlightsTab` in `players/[id]/page.tsx`)**:
    1.  On a player's profile page, the admin navigates to the "Highlights" tab.
    2.  They click a "**Generate AI Highlight Reel**" button.
*   **AI Flow (`generate-player-highlights-video.ts`)**:
    *   **Input**: The player's image URL and their name.
    *   **Process**: The flow uses the Google **Veo** video generation model.
        *   It fetches the image data from the provided URL.
        *   It sends the image and a text prompt (e.g., "Animate the person in this photo. Create a professional-style sports highlight clip...") to the Veo model.
        *   The model generates a new, ~6-second MP4 video file. The flow waits for the generation to complete.
        *   It downloads the generated video data.
    *   **Output**: A data URI string of the generated video (`data:video/mp4;base64,...`).
*   **Backend (`videos.ts`)**:
    *   The `addVideoWithTags` function is called with the video data.
    *   It converts the data URI to a `File` object.
    *   It uploads the video to Firebase Storage.
    *   It automatically creates a thumbnail from the video's first frame and uploads that as well.
    *   Finally, it creates a new document in the `videos` collection and a corresponding tag in the `playerVideos` collection, making the highlight immediately available in the player's profile and the main video library.
