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
      "Cannot be undone. The person must confirm.",
    parameters: obj({ fixture: str(`The match. ${REF}`) }, ["fixture"]),
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
