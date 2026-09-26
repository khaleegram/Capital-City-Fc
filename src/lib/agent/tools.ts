/**
 * The admin agent's tool contract.
 *
 * This module describes what the assistant is able to do, and nothing else. It deliberately
 * imports nothing — no Firebase, no React — because both sides of the wire need it: the server
 * route sends these specs to the model, and the browser uses them to decide what to execute and
 * what to label as risky. A single import of the Firestore SDK here would drag either side into
 * the other's bundle.
 *
 * ## Two halves, on purpose
 *
 * The *specs* live here; the *executors* live in `tool-executors.ts`, which is client-only. That
 * split is the whole security design. Tools run in the admin's own browser, authenticated as the
 * admin, against the same client helpers the admin screens call — so Firestore's rules apply to
 * the assistant exactly as they apply to a person clicking buttons. The assistant cannot reach
 * data its operator cannot reach, and cannot do anything its operator could not do by hand. There
 * is no service-account path, and therefore nothing to escalate into.
 *
 * ## Risk levels
 *
 * `destructive` tools are never run automatically. The model may ask for one; the loop stops and
 * the UI asks the person to confirm before anything happens. `read` tools are free, `write` tools
 * run when asked. See `loop.ts`.
 */

/** How much damage a tool can do, and therefore whether it needs a human click. */
export type ToolRisk =
  /** Reads only. */
  | "read"
  /** Creates or updates. Reversible by editing again. */
  | "write"
  /** Removes data, or puts something on the public site. Never automatic. */
  | "destructive"

export type ToolSpec = {
  name: string
  /** Model-facing. This is prompt engineering: say when to use it and what the arguments mean. */
  description: string
  risk: ToolRisk
  /** JSON Schema for the tool's arguments, in the OpenAI function-calling shape. */
  parameters: Record<string, unknown>
}

/* ─────────────────────────────── protocol types ─────────────────────────────── */

/** One function call the model asked for. */
export type ToolCall = {
  id: string
  name: string
  /** JSON-encoded arguments, exactly as the model emitted them. Parsed by the executor. */
  arguments: string
}

/**
 * A message on the wire.
 *
 * `assistant` messages may carry `tool_calls`; `tool` messages carry the result of exactly one
 * call and must reference it by id. This mirrors the OpenAI chat-completions contract, which is
 * what DeepSeek speaks.
 */
export type AgentMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string }

/* ───────────────────────── replay trimming ───────────────────────── */

/**
 * Ceiling on the conversation replayed to the model, in tokens.
 *
 * History is resent in full on every step of the agent loop, so an unbounded session makes each
 * request cost more than the last — and a long session that misses the prompt cache can bill a
 * large multiple of the fixed per-call overhead in a single request. The loop's step ceiling
 * bounds the multiplier; this bounds the multiplicand.
 *
 * Only the *replay* is capped. The stored session keeps every message, so nothing is lost from the
 * transcript the operator reads or from the Changes history. What the assistant forgets is
 * context for one request, and it can re-read anything with a tool.
 */
export const HISTORY_TOKEN_BUDGET = 20_000

/** Rough token count for one message, deliberately erring high so the budget is not overshot. */
export function estimateTokens(message: AgentMessage): number {
  let chars = message.content?.length ?? 0
  if ("tool_calls" in message && message.tool_calls) chars += JSON.stringify(message.tool_calls).length
  return Math.ceil(chars / 3.8) + 4
}

/**
 * Keep the most recent turns that fit the budget.
 *
 * Trimming by message count alone would break the wire protocol. A `tool` message is only valid
 * directly after the `assistant` message that requested it, so a transcript that opens on a tool
 * result is rejected by the model, and a `tool_call_id` with no matching call is worse than a
 * short conversation. So after taking the tail we walk forward to the first `user` message, which
 * is the only position a transcript may legally start at.
 */
export function trimHistory(history: AgentMessage[], budget = HISTORY_TOKEN_BUDGET): AgentMessage[] {
  let total = 0
  let start = history.length
  for (let i = history.length - 1; i >= 0; i--) {
    const next = total + estimateTokens(history[i])
    if (next > budget) break
    total = next
    start = i
  }
  // A budget can land mid-turn; rewind to the boundary rather than sending a broken transcript.
  while (start < history.length && history[start].role !== "user") start++
  return history.slice(start)
}

/** What one tool did, for the activity feed the person reads. */
export type ToolOutcome = {
  ok: boolean
  /** One line, in plain English, describing what happened. Shown in the UI and fed to the model. */
  summary: string
  /** Optional structured detail for the model only. */
  data?: unknown
}

/* ─────────────────────────────── schema helpers ─────────────────────────────── */

const str = (description: string) => ({ type: "string", description })
const num = (description: string) => ({ type: "number", description })
const bool = (description: string) => ({ type: "boolean", description })
const enums = (values: string[], description: string) => ({ type: "string", enum: values, description })
const strings = (description: string) => ({ type: "array", items: { type: "string" }, description })

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
})

/**
 * How the model is told to refer to a record.
 *
 * Every tool takes a free-text reference rather than a raw id. Models are unreliable at recalling
 * opaque ids, and a plausible-looking wrong id is the most likely way for an agent to damage real
 * data. So references are resolved by the executor against live data, and an ambiguous or missing
 * reference comes back as an error the model can correct — see `resolveFixture` and friends in
 * `tool-executors.ts`.
 */
const REF = "the record's id, or enough of its name/description to identify it (e.g. an opponent or a headline)"

/* ─────────────────────────────── the tools ─────────────────────────────── */

export const TOOLS: ToolSpec[] = [
  /* ── reading ─────────────────────────────────────────────────────────────── */
  {
    name: "list_fixtures",
    risk: "read",
    description:
      "List Capital City FC's fixtures. Use this before recording a result, setting a lineup or linking footage, " +
      "so you act on the real record rather than a guess. Returns each fixture's id, opponent, competition, date, " +
      "status (UPCOMING, LIVE, HT or FT) and score.",
    parameters: obj({
      query: str(
        "Optional opponent or competition fragment, case-insensitive. Use this when looking for one particular " +
          "match — 'Mailantarki', or 'Dana Cup'."
      ),
      scope: enums(
        ["all", "unplayed", "played", "upcoming"],
        "'unplayed' = no result yet (UPCOMING or LIVE). 'played' = FT. 'upcoming' = UPCOMING only. Default 'all'."
      ),
      limit: num("How many to return, most recent first. Default 20."),
    }),
  },
  {
    name: "list_players",
    risk: "read",
    description:
      "List the squad with each player's id, name, position, shirt number and current statistics " +
      "(appearances, goals, assists), plus their baseline. Use this to resolve a player's name to an id before " +
      "setting a lineup or a baseline.",
    parameters: obj({
      query: str("Optional name fragment to filter by, case-insensitive. Omit for the whole squad."),
    }),
  },
  {
    name: "list_news",
    risk: "read",
    description:
      "List news articles, newest first. Returns each article's id, headline, date, whether it is published and " +
      "its provenance (a match report, a preview, a recap, or written by hand). Use this to find an article before " +
      "publishing, unpublishing or linking it to a match.",
    parameters: obj({
      include_drafts: bool("Include unpublished drafts. Default true, because drafts are what usually needs attention."),
      limit: num("How many to return. Default 20."),
    }),
  },
  {
    name: "club_summary",
    risk: "read",
    description:
      "A snapshot of the club's current state: playing record (won, drawn, lost), goals for and against, " +
      "how many matches are unplayed, squad size, unpublished drafts, and how many finished matches still have " +
      "no report. Use this when asked for an overview, a status check, or 'what needs doing'.",
    parameters: obj({}),
  },

  /* ── matchday ───────────────────────────────────────────────────────────── */
  {
    name: "record_result",
    risk: "write",
    description:
      "Record the final score of a match that has been played. This is the main way a match is written up: it sets " +
      "the fixture to full time AND automatically drafts the match's news report from the score. Prefer this over " +
      "the model writing a report by hand. The draft is left unpublished for a person to review. " +
      "If the match has scorers worth naming, follow this with post_match_event for each goal.",
    parameters: obj(
      {
        fixture: str(`The match. ${REF}`),
        score_for: num("Capital City FC's goals."),
        score_against: num("The opponent's goals."),
        notes: str("Optional short note about the match, stored on the fixture."),
      },
      ["fixture", "score_for", "score_against"]
    ),
  },
  {
    name: "create_fixture",
    risk: "write",
    description:
      "Add a fixture that isn't in the system yet. Use this for an upcoming match, or one played before the club " +
      "started recording them. Gives the fixture an id that later tools can act on.",
    parameters: obj(
      {
        opponent: str("The opposing team's name."),
        competition: str("e.g. Friendly, Nigeria National League, Gothia Cup."),
        venue: str("Where it is played. Defaults to the club's home venue if omitted."),
        date: str(
          "Kick-off as an ISO 8601 date-time, e.g. 2026-10-12T16:00:00+01:00. If only a date is known, use 16:00 local."
        ),
        notes: str("Optional note."),
        score_for: num("Leave out for an upcoming fixture. Provide both scores to record it as already played."),
        score_against: num("Only with score_for."),
      },
      ["opponent", "competition", "date"]
    ),
  },
  {
    name: "set_lineup",
    risk: "write",
    description:
      "Set a match's starting XI and substitutes. Players are matched by name against the squad. " +
      "This is what credits appearances, so do it for any played match where the XI is known. " +
      "Names that match nobody come back in the result — report those to the person rather than ignoring them.",
    parameters: obj(
      {
        fixture: str(`The match. ${REF}`),
        starting_xi: strings("Starting eleven, by player name. Up to 11."),
        substitutes: strings("Named substitutes, by player name. Optional."),
      },
      ["fixture", "starting_xi"]
    ),
  },
  {
    name: "post_match_event",
    risk: "write",
    description:
      "Record one event in a match's timeline: a goal, a card, a substitution, or a status change " +
      "(Match Start, Half Time, Second Half Start, Match End). Posting a goal credits the scorer and assister. " +
      "Posting Match End sets the match to full time and drafts its news report, like record_result.",
    parameters: obj(
      {
        fixture: str(`The match. ${REF}`),
        event_type: enums(
          ["Goal", "Red Card", "Substitution", "Info", "Match Start", "Half Time", "Second Half Start", "Match End"],
          "What happened."
        ),
        minute: num("Match minute. Use 0 for a status change like Match Start."),
        text: str("The line shown in the timeline, e.g. 'Baba Saidu Audu heads in from a corner'."),
        score_for: num("Capital City FC's goals as of this event. Required for a Goal or Match End."),
        score_against: num("The opponent's goals as of this event. Required for a Goal or Match End."),
        player: str("For a Goal or Red Card, the player's name."),
        assist: str("For a Goal, the assisting player's name. Optional."),
        sub_on: str("For a Substitution, the player coming on."),
        sub_off: str("For a Substitution, the player going off."),
      },
      ["fixture", "event_type", "minute"]
    ),
  },
  {
    name: "rebuild_player_stats",
    risk: "write",
    description:
      "Recompute every player's statistics from the match records and tournament squad sheets. Idempotent and safe " +
      "to re-run. Use it after bulk changes, or when someone reports that appearances or goals look wrong. " +
      "Player totals are derived, so this is the repair tool — it can never inflate a total, only fill in what the " +
      "records support.",
    parameters: obj({}),
  },
  {
    name: "write_missing_reports",
    risk: "write",
    description:
      "Find every finished match that has no news report and draft one for each. Leaves them unpublished for " +
      "review. Use when asked to catch up on reports. Tell the person how many were drafted.",
    parameters: obj({}),
  },

  /* ── news ───────────────────────────────────────────────────────────────── */
  {
    name: "create_article",
    risk: "write",
    description:
      "Write a news article. Use this for club news that is NOT a match report — a signing, an announcement, " +
      "a training camp. For a played match, use record_result instead: it writes the report from the real score " +
      "rather than having the model invent details.",
    parameters: obj(
      {
        headline: str("The headline."),
        content: str("The article body. Separate paragraphs with a blank line."),
        tags: strings("Four to six short tags."),
        publish: bool("true puts it on the public site immediately. Default false, which saves a draft for review."),
      },
      ["headline", "content"]
    ),
  },
  {
    name: "publish_article",
    risk: "destructive",
    description: "Put an existing article on the public site. This is publicly visible, so the person must confirm it.",
    parameters: obj({ article: str(`The article. ${REF}`) }, ["article"]),
  },
  {
    name: "unpublish_article",
    risk: "write",
    description: "Pull an article off the public site. It stays in the admin as a draft.",
    parameters: obj({ article: str(`The article. ${REF}`) }, ["article"]),
  },
  {
    name: "link_article_to_match",
    risk: "write",
    description:
      "Attach a news article to the match it reports on. Important for a hand-written report: without the link the " +
      "match page will not show it, and the app will later draft a second report for the same match.",
    parameters: obj({ article: str(`The article. ${REF}`), fixture: str(`The match. ${REF}`) }, ["article", "fixture"]),
  },

  /* ── players ────────────────────────────────────────────────────────────── */
  {
    name: "set_player_baseline",
    risk: "write",
    description:
      "Set a player's pre-club baseline — the career totals the app's match records cannot explain, such as " +
      "appearances from before the club recorded fixtures. Their displayed total becomes baseline + match records, " +
      "so this RAISES or LOWERS the starting point and never destroys derived match data. " +
      "Read the player first and tell the person the resulting total.",
    parameters: obj(
      {
        player: str(`The player. ${REF}`),
        appearances: num("Appearances that the club's match records do not account for."),
        goals: num("Goals the club's match records do not account for."),
        assists: num("Assists the club's match records do not account for."),
      },
      ["player"]
    ),
  },

  /* ── comms ──────────────────────────────────────────────────────────────── */
  {
    name: "send_announcement",
    risk: "destructive",
    description:
      "Send a push notification to every subscribed device. It reaches real phones immediately and cannot be " +
      "recalled, so the person must confirm it. Keep the body under 140 characters.",
    parameters: obj(
      { title: str("Notification title, e.g. '⚽ Full Time'."), body: str("The message."), url: str("Where tapping it goes, e.g. /fixtures.") },
      ["title", "body"]
    ),
  },

  /* ── destructive ────────────────────────────────────────────────────────── */
  {
    name: "delete_article",
    risk: "destructive",
    description: "Permanently delete a news article and its image. Cannot be undone. The person must confirm.",
    parameters: obj({ article: str(`The article. ${REF}`) }, ["article"]),
  },
  {
    name: "delete_fixture",
    risk: "destructive",
    description:
      "Permanently delete a match, along with its report, its timeline and the player records it produced. " +
      "This is gated: the console asks the person to approve it before anything happens. The deletion can be " +
      "reversed afterwards from the history, with one exception — the opponent's crest file is removed from " +
      "storage and cannot be restored.",
    parameters: obj({ fixture: str(`The match. ${REF}`) }, ["fixture"]),
  },

  /* ── footage ────────────────────────────────────────────────────────────── */

  {
    name: "attach_footage",
    risk: "write",
    description:
      "Attach footage of a match — a highlight, full match, interview or training clip — and optionally tag the " +
      "players in it. Tagging credits those players with the appearance, and attaching a clip to a match also " +
      "produces the match report if one does not exist yet. " +
      "You cannot upload a file yourself and cannot see one. The person attaches it in the composer, and you refer " +
      "to it by the exact file name you were told about. If no file was attached, ask them for it instead of " +
      "calling this tool — or pass a `url` if they gave you a link.",
    parameters: obj(
      {
        fixture: str(`The match the footage is from. ${REF}`),
        attachment: str("The exact file name of the attachment to use, as listed in the message. Omit if passing `url`."),
        url: str("A direct video or image link, if the person gave one instead of a file. Omit if passing `attachment`."),
        title: str("Title for the clip, e.g. 'Capital City 3-1 Mailantarki — highlights'."),
        players: strings("Names of the players to tag in the clip. They are credited with the appearance."),
        type: enums(
          ["fullMatch", "highlight", "training", "playerFocus", "travelDiary", "documentary", "interview", "behindScenes"],
          "What kind of clip this is. Defaults to 'highlight'."
        ),
        description: str("One or two sentences about the clip."),
        publish: bool("Set true to put the clip on the public site immediately. Defaults to false — a draft."),
      },
      ["fixture", "title"]
    ),
  },

  /* ── undo ───────────────────────────────────────────────────────────────── */

  {
    name: "undo_last_change",
    risk: "write",
    description:
      "Reverse a change you made earlier, restoring the affected records to exactly what they were. " +
      "Use this when the person asks you to undo, revert, take back or roll back something. " +
      "With no `about`, it reverses the most recent change that can still be reversed in this conversation. " +
      "It cannot bring back a push notification that was already delivered, and it cannot restore an opponent's " +
      "crest file deleted with a match.",
    parameters: obj({
      about: str(
        "Optional. Describe or name the change to undo — for example 'the lineup' or 'Mailantarki' — to target an " +
          "earlier change rather than the most recent one."
      ),
    }),
  },

  /* ── tours and journeys ─────────────────────────────────────────────────── */

  {
    name: "list_journeys",
    risk: "read",
    description:
      "List the club's tours and tournaments — Gothia Cup, Dana Cup and so on. Returns each journey's id, title, " +
      "kind, status, dates, how many players are on the squad sheet and how many of them are linked to a profile. " +
      "Use this before changing a tour, so you act on the real record.",
    parameters: obj({
      query: str("Optional title fragment, case-insensitive. e.g. 'Dana'."),
      status: enums(["upcoming", "live", "completed"], "Optional. Only journeys in this state."),
    }),
  },
  {
    name: "create_journey",
    risk: "write",
    description:
      "Create a tour or tournament. It is created as a draft, so it is not on the public site until someone " +
      "publishes it. Add the squad separately with `set_journey_squad`.",
    parameters: obj(
      {
        title: str("The tour's name, e.g. 'Gothia Cup 2027'."),
        kind: enums(["international", "domestic"], "A trip abroad, or a campaign inside Nigeria."),
        season: str("Season label, e.g. '2026/27'."),
        start_date: str("ISO 8601 date the squad travelled, e.g. '2027-07-12'."),
        end_date: str("ISO 8601 date the tour ended."),
        summary: str("A short description for the journey page."),
      },
      ["title", "kind"]
    ),
  },
  {
    name: "set_journey_squad",
    risk: "write",
    description:
      "Replace a tour's squad sheet. This is where a tour's players get their appearances and their goals and " +
      "assists for the whole trip, so it is the tool that fixes tournament statistics. " +
      "Names that match a player profile are linked automatically and then count; names that match nobody are kept " +
      "on the sheet but credit nothing, and are reported back so you can say which ones need a profile. " +
      "Replaces the sheet wholesale — include every member you want on it.",
    parameters: obj(
      {
        journey: str(`The tour. ${REF}`),
        members: {
          type: "array",
          description: "The full squad sheet.",
          items: obj(
            {
              name: str("The player's name, exactly as it appears on the sheet."),
              position: enums(["Goalkeeper", "Defender", "Midfielder", "Forward"], "Their position on the sheet."),
              number: num("Shirt number. Optional."),
              goals: num("Goals scored across the whole tour. Optional."),
              assists: num("Assists across the whole tour. Optional."),
            },
            ["name", "position"]
          ),
        },
      },
      ["journey", "members"]
    ),
  },
  {
    name: "post_journey_entry",
    risk: "write",
    description:
      "Post an entry to a tour's diary. Give the `body` if you already have the words, or give `notes` and it will " +
      "be written up in the club's voice first — the same writer the tour diary screen uses. " +
      "Notes must be plain facts; the writer is told never to invent a score, a name or a quote.",
    parameters: obj(
      {
        journey: str(`The tour. ${REF}`),
        title: str("A short headline. Optional when notes are given — the written entry supplies one."),
        body: str("The entry text. Use this when the person has already told you what to write."),
        notes: str(
          "Rough notes to be written up into the entry. Use this instead of `body` when the person gave you " +
            "scattered facts to turn into something readable."
        ),
        location: str("Where the squad is, e.g. 'Gothenburg'."),
        day: num("Day number of the tour."),
        attachment: str("Exact file name of a photo to attach, if one was attached to the message."),
      },
      ["journey"]
    ),
  },
  {
    name: "set_journey_status",
    risk: "write",
    description:
      "Change whether a tour is upcoming, live or completed, and optionally its end date. Use this when a trip " +
      "has finished and needs closing off — the public journey page reads this to decide what to show.",
    parameters: obj(
      {
        journey: str(`The tour. ${REF}`),
        status: enums(["upcoming", "live", "completed"], "The new state."),
        end_date: str("Optional ISO 8601 date to set as the end."),
      },
      ["journey", "status"]
    ),
  },

  /* ── players, placements and club records ───────────────────────────────── */

  {
    name: "create_player",
    risk: "write",
    description:
      "Add a player to the squad. Created as a draft, so it stays off the public site until someone publishes it. " +
      "Statistics are not set here — they come from match records, and `set_player_baseline` covers a career total " +
      "from before the club recorded matches.",
    parameters: obj(
      {
        name: str("The player's full name."),
        position: enums(["Goalkeeper", "Defender", "Midfielder", "Forward"], "Where they play."),
        jersey_number: num("Shirt number."),
        nickname: str("What they are known as. Optional."),
        dob: str("Date of birth, ISO 8601. Optional."),
        nationality: str("Optional."),
        bio: str("A short biography. Optional."),
        image_attachment: str("Exact file name of a photo attached to the message, if there is one."),
      },
      ["name", "position", "jersey_number"]
    ),
  },
  {
    name: "update_player",
    risk: "write",
    description:
      "Change details on an existing player profile. Only the fields you pass are changed. Use this to fix a " +
      "spelling, add a biography, change a shirt number, mark someone injured or on loan, or publish a profile.",
    parameters: obj(
      {
        player: str(`The player. ${REF}`),
        name: str("A corrected full name. Optional."),
        nickname: str("Optional."),
        position: str("Optional."),
        jersey_number: num("Optional."),
        status: enums(["Active", "Injured", "On Loan", "Former Player"], "Optional."),
        strong_foot: enums(["Left", "Right", "Both"], "Optional."),
        height_cm: num("Optional."),
        nationality: str("Optional."),
        bio: str("Optional."),
        current_club: str("Set when the player has moved on. Optional."),
        squad_status: str("Their standing in the pathway, if they have one. Optional."),
        image_attachment: str("Exact file name of a photo attached to the message, to replace their picture."),
        publish: bool("Set true to put the profile on the public site, false to pull it back to a draft."),
      },
      ["player"]
    ),
  },
  {
    name: "add_placement",
    risk: "write",
    description:
      "Record a player moving to, trialling with or signing for another club — the proof of the pathway. " +
      "Created unpublished, so it goes on the public record only once someone approves it.",
    parameters: obj(
      {
        player: str(`The player. ${REF}`),
        club: str("The club they have joined or are trialling with."),
        country: str("The club's country."),
        type: enums(["signed", "loan", "trial"], "What kind of move this is."),
        league: str("Optional."),
        date: str("ISO 8601 date of the move. Optional."),
        source_url: str("A link confirming it, if there is one. Optional."),
        verified: bool("Set true when the person has confirmed it is real. Defaults to false."),
      },
      ["player", "club", "country", "type"]
    ),
  },
  {
    name: "add_achievement",
    risk: "write",
    description: "Add a trophy, an unbeaten run or a milestone to the club's record. Created unpublished.",
    parameters: obj(
      {
        title: str("What was achieved, e.g. 'Gothia Cup quarter-finalists'."),
        year: num("The year it happened."),
        kind: enums(["trophy", "unbeaten", "milestone"], "What sort of achievement this is."),
        competition: str("Optional."),
        detail: str("One or two sentences of context. Optional."),
        journey: str(`The tour it belongs to, if any. ${REF}`),
      },
      ["title", "year", "kind"]
    ),
  },
  {
    name: "add_staff_member",
    risk: "write",
    description: "Add a member of staff — coaching, management, operations or medical. Created unpublished.",
    parameters: obj(
      {
        name: str("Their name."),
        role: str("Their title, e.g. 'Head Coach'."),
        group: enums(["management", "coaching", "operations", "medical"], "Which part of the club they belong to."),
        rank: num("Order within their group; lower shows first. Optional."),
        bio: str("Optional."),
        quote: str("Optional."),
        licences: strings("Coaching licences or badges. Optional."),
      },
      ["name", "role", "group"]
    ),
  },

  /* ── galleries ──────────────────────────────────────────────────────────── */

  {
    name: "create_gallery",
    risk: "write",
    description:
      "Create a photo gallery — a chapter of the club's story, usually from a tour. " +
      "The people attach the photos in the composer and you name them; you cannot upload anything yourself. " +
      "Created unpublished, so nothing is public until someone approves it.",
    parameters: obj(
      {
        title: str("The gallery's title."),
        story: str("A short piece of writing about the pictures. Optional."),
        location: str("Where the photos were taken. Optional."),
        date: str("ISO 8601 date. Optional."),
        journey: str(`The tour it belongs to, if any. ${REF}`),
        attachments: strings(
          "Exact file names of the photos to include, as listed in the message. List every one you were told about."
        ),
        caption: str("A caption applied to the photos. Optional."),
      },
      ["title"]
    ),
  },

  /* ── writing help ───────────────────────────────────────────────────────── */

  {
    name: "write_social_posts",
    risk: "read",
    description:
      "Write the club's social media posts for a story — one for Twitter and one for Instagram, with hashtags. " +
      "Takes the article it should be about, or text you give it. Returns the posts as text for the person to " +
      "copy; it does not publish them anywhere.",
    parameters: obj({
      article: str(`An existing article to write about. ${REF}`),
      text: str("Text to write the posts from, if there is no article."),
    }),
  },

  /* ── looking things up ──────────────────────────────────────────────────── */

  {
    name: "lookup_club",
    risk: "read",
    description:
      "Look up a football club outside the club's own records, to confirm who an opponent is, which country and " +
      "city they are from, or which competition they play in. Reads Wikipedia and returns the summary and a link. " +
      "Use it when someone names an opponent the database does not know, or asks about a club. " +
      "Treat what comes back as background: it is not club data, so never use it as the source for a score, a " +
      "lineup or a statistic, and say where it came from.",
    parameters: obj(
      {
        query: str("The club's name, and the country if the name is a common one — e.g. 'Malmö FF Sweden'."),
      },
      ["query"]
    ),
  },
]

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]))

/**
 * The specs in the shape the chat-completions API expects.
 *
 * Sent on every turn rather than once, because the route is stateless — each request carries the
 * whole conversation and the tool list, and gets back either a final answer or the next calls.
 */
export function openAiTools() {
  return TOOLS.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))
}
