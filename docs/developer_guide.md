
# Developer Guide: Fixture & Formation Flows

This document outlines the logic, AI prompts, and data structures required to implement the Fixture Creation and Formation Management features.

---

## 1. Fixture Creation & AI Preview Flow

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

## 2. Formation Management Flow

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
