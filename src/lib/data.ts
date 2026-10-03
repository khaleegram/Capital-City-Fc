
import { Timestamp } from "firebase/firestore";

export type Player = {
  id: string;
  name: string;
  nickname?: string;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward" | "Coach" | "Staff";
  role: "Player" | "Coach" | "Staff";
  jerseyNumber: number;
  imageUrl: string;
  bio: string;
  stats: {
    appearances: number;
    goals: number;
    assists: number;
  };
  /**
   * The part of `stats` that the match records do *not* explain.
   *
   * `stats` is recomputed as `statsBaseline + every playerMatches record`. The baseline is
   * whatever a human entered that the recorded matches can't account for — a career total from
   * before the club started recording fixtures, or a spell whose matches were never entered.
   * Keeping it separate is what lets a recompute run without destroying a hand-entered figure.
   *
   * See `src/lib/player-matches.ts` for the full rationale.
   */
  statsBaseline?: {
    appearances: number;
    goals: number;
    assists: number;
  };
  status?: "Active" | "Injured" | "On Loan" | "Former Player";
  strongFoot?: "Left" | "Right" | "Both";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  careerHighlights: string[];
  // v1 pathway fields
  squadStatus?: SquadStatus;
  cohort?: string; // e.g. "2025/26"
  dob?: string; // ISO date
  heightCm?: number;
  nationality?: string;
  strengths?: string[];
  readyForNextStep?: boolean;
  currentClub?: string;
  /**
   * Whether an alumnus's move took them out of Nigeria.
   *
   * `squadStatus` alone said only "ours or not", which could not separate a graduate playing in
   * Lagos from one playing in Denmark — the distinction the club actually tracks. Only meaningful
   * when `squadStatus` is `"alumni"`; set from the player's own answer on /join and by staff in
   * the admin player form, which must agree.
   */
  movedAbroad?: boolean;
  published?: boolean;
  /**
   * Set when the player submitted this profile themselves from /join.
   * `signupSessionId` scopes the files they uploaded to R2 under `signups/{id}/`, so staff
   * can promote or discard the whole submission in one move.
   */
  source?: "signup";
  signupSessionId?: string;
  signupGallery?: { url: string; bytes: number }[];
  signupVideos?: { url: string; bytes: number; name?: string }[];
  /** Total bytes this player's sign-up uploaded. Shown in review. */
  storageBytes?: number;
  /**
   * Club history a player entered on the /join form, newest first. Unverified by default —
   * staff tick each entry during review.
   */
  clubHistory?: PlayerClubEntry[];
};

export type SquadStatus = "current" | "alumni";

/** The four playing positions. Distinct from Player["position"], which also covers Coach/Staff. */
export type FieldPosition = "Goalkeeper" | "Defender" | "Midfielder" | "Forward";

export type PlayerClubLevel = "Youth" | "Academy" | "Senior";

/**
 * One club a player has played for, self-reported on the /join form.
 *
 * Field names deliberately mirror `Placement` (`club`, `country`, `league`, `verified`) so
 * staff can promote an entry straight into the `placements` collection without retyping.
 * `seasons` is the one addition — a player may describe a spell as "2023/24".
 *
 * `verified` is always false for a player-submitted entry. Staff tick it during review, and
 * only a verified entry may ever be rendered as confirmed on the public site.
 */
export type PlayerClubEntry = {
  club: string;
  league?: string;
  division?: string;
  country?: string;
  /** A season or year range, e.g. "2023/24" or "2024". */
  seasons?: string;
  /** Exactly one entry may be current; the form enforces it and it mirrors into `currentClub`. */
  current?: boolean;
  level?: PlayerClubLevel;
  appearances?: number;
  goals?: number;
  assists?: number;
  position?: FieldPosition;
  verified: boolean;
};

/** Firestore Timestamp on the client, ISO string once serialized by the server layer. */
export type DateLike = Timestamp | Date | string;

/** One extra photo on a news article. `caption` is optional and shown under it in the gallery. */
export type NewsPhoto = { url: string; caption?: string; position?: string };

export type NewsArticle = {
  id: string;
  headline: string;
  content: string;
  /**
   * Landscape cover. Drives listing thumbnails, social previews, and the article hero
   * unless `heroImageUrl` is set.
   */
  imageUrl: string;
  /**
   * Which slice of `imageUrl` the frame shows, as a CSS `object-position` value, e.g. `"50% 25%"`.
   *
   * Photos are never cropped on upload — the file keeps its shape and the frame decides what is
   * visible — so a tall photo placed in a wide hero shows only its middle band, which on a
   * standing subject is roughly their chest. This is the writer's correction, and the vertical
   * number is the one that matters: lowering it moves the frame up the photo, which is what puts
   * faces back in view. Absent means centre, which is what every article written before this
   * field existed still gets.
   */
  imagePosition?: string;
  date: string; // Should be ISO string
  tags: string[];
  audioUrl?: string;
  /**
   * Optional portrait (4:5) cover for the article hero only.
   *
   * Covers render with `object-cover`, so a full-length photo dropped into the landscape
   * frame loses its subject. Supplying a portrait image here gives the hero a 4:5 frame
   * that matches the photo, so the whole thing shows. Listings keep using `imageUrl`.
   */
  heroImageUrl?: string;
  /** Which slice of `heroImageUrl` the 4:5 hero frame shows. See `imagePosition`. */
  heroImagePosition?: string;
  /**
   * Optional phone cover for the article hero.
   *
   * The hero is full-bleed with `object-cover`, so a wide shot loses most of its frame on a
   * phone. Supplying a portrait image here gives phones their own photo; leave it empty and
   * every screen gets `heroImageUrl || imageUrl` instead.
   */
  heroImageMobileUrl?: string;
  /** Which slice of `heroImageMobileUrl` the phone frame shows. See `imagePosition`. */
  heroImageMobilePosition?: string;
  /**
   * Extra photos, shown as a gallery under the article body.
   *
   * Separate from the three cover fields above, which all resolve to *one* image: a report with
   * six pictures had nowhere to put five of them. These are the rest of the set, in the order the
   * writer arranged them.
   */
  photos?: NewsPhoto[];
  /**
   * Whether the article is on the public site.
   *
   * Match reports are written by the match hub with this `false` — a draft a person reads before
   * the club does. Everything written through the news editor is `true`. The public news list
   * filters on it, so an article saved without it is invisible rather than merely unlisted.
   *
   * Optional in the type because the articles written before the field existed are still in the
   * collection; those were migrated to `true`, and `getArticle` treats a missing flag as public.
   */
  published?: boolean;
  /** Which fixture this report came from, so the match and its news stay linked. */
  fixtureId?: string;
  /** Which recap produced it, if any. */
  recapId?: string;
  /**
   * Who wrote it. `match` and `preview` are machine-written and may be rewritten by the match
   * hub; `assistant` is written by the in-admin AI on a person's instruction; anything else is
   * treated as a person's work and left alone.
   */
  generatedFrom?: "match" | "preview" | "recap" | "assistant";
};

export type Video = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  uploadDate: Timestamp;
  taggedPlayers: { id: string; name: string }[]; // For easy display
};

export type PlayerVideoTag = {
  id: string;
  playerId: string;
  videoId: string;
  taggedAt: Timestamp;
};

export type Fixture = {
  id:string;
  opponent: string;
  opponentLogoUrl?: string;
  venue: string;
  competition: string;
  date: Timestamp | Date;
  status: "UPCOMING" | "LIVE" | "FT" | "HT";
  score?: {
      home: number;
      away: number;
  };
  notes?: string;
  articleId?: string;
  createdAt?: Timestamp;
  startingXI?: Player[];
  substitutes?: Player[];
  // Tracks players currently on the pitch
  activePlayers?: Player[]; 
  // Timestamps for match clock
  kickoffTime?: Timestamp;
  firstHalfEndTime?: Timestamp;
  secondHalfStartTime?: Timestamp;
};

export type LiveEvent = {
    id: string;
    timestamp: Timestamp;
    text: string;
    type: "Goal" | "Red Card" | "Substitution" | "Info" | "Match Start" | "Half Time" | "Second Half Start" | "Match End";
    score?: string;
    playerName?: string;
    teamName?: string;
    /**
     * The scorer, by id.
     *
     * `playerName` alone used to be all a goal event carried, which meant attributing a goal to
     * a player relied on matching a string back to a lineup. The id makes it exact, so the
     * match records derive from the event rather than from a name lookup that can miss.
     */
    scorerPlayer?: { id: string; name: string } | null;
    assistPlayer?: { id: string, name: string };
    subOffPlayer?: { id: string, name: string };
    subOnPlayer?: { id: string, name: string };
    minute?: number;
};

export type MatchEvent = {
    minute: string;
    type: "Goal" | "Assist" | "Yellow Card" | "Red Card" | "Substitution" | "Penalty Saved" | "Penalty Missed" | "Info";
    player: string;
    description: string;
}

export type StructuredData = {
    finalScore: string;
    goalScorers: string[];
    assists: string[];
}

export type Recap = {
    id: string;
    fixtureId: string;
    headline: string;
    shortSummary: string;
    fullRecap: string;
    timeline: MatchEvent[];
    structuredData: StructuredData;
    createdAt: Timestamp;
    audioUrl?: string | null;
};

export type TeamProfile = {
    id: string;
    name: string;
    logoUrl: string;
    homeVenue: string;
    maintenanceMode?: boolean;
    heroVideoUrl?: string;
    heroImageUrl?: string;
    /** Optional phone hero photo. Empty means phones use `heroImageUrl`. */
    heroImageMobileUrl?: string;
    socials?: { instagram?: string; tiktok?: string; youtube?: string; x?: string };
    /**
     * Public contact address, editable in /admin/settings.
     *
     * Unset means "use the brand default" rather than "no email" — the constant in `copy.ts` stays
     * the single fallback so a site with no override still shows one, and every reader resolves it
     * through `contactEmailOf()` rather than reaching for the constant directly.
     */
    contactEmail?: string;
    /** Manual override; any field left empty falls back to the computed value. */
    proofStats?: Partial<ProofStats> | null;
};

export type Formation = {
  id: string;
  name: string;
  startingXI: Player[];
  substitutes: Player[];
  notes?: string;
  createdAt: Timestamp;
};


/* ─────────────────────────── v1 pathway model ─────────────────────────── */

export type JourneyStatus = "upcoming" | "live" | "completed";
export type JourneyKind = "international" | "domestic";

/** A city on an international route, or a round in a domestic campaign. */
export type JourneyStop = {
  city: string;
  country: string;
  code?: string;
  lat?: number;
  lng?: number;
  arrive?: string;
  depart?: string;
  reached?: boolean;
  current?: boolean;
};

export type JourneyRecord = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

/** Tournament games (opponents abroad aren't always club fixtures). */
export type JourneyMatch = {
  id: string;
  date?: string;
  stage: string;
  opponent: string;
  venue?: string;
  scoreFor?: number | null;
  scoreAgainst?: number | null;
  status: "upcoming" | "live" | "played";
  note?: string;
};

export type JourneyTableRow = {
  team: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  isUs?: boolean;
};

export type JourneyQuote = { text: string; author: string; role?: string };

/** Tournament sheet: may include players who are not on the public CCFC squad yet. */
export type JourneySquadMember = {
  number: number;
  name: string;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward";
  goals?: number;
  assists?: number;
  /** Linked CCFC player profile, when one exists. */
  playerId?: string | null;
};

export type Journey = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  kind: JourneyKind;
  status: JourneyStatus;
  season?: string;
  startDate?: string;
  endDate?: string;
  coverImageUrl?: string;
  /**
   * Optional phone cover for the journey header.
   *
   * Same rule as the other heroes: set it to give phones a portrait crop, leave it empty and
   * phones fall back to `coverImageUrl`. Listings and share cards always use `coverImageUrl`.
   */
  coverImageMobileUrl?: string;
  summary: string;
  stops: JourneyStop[];
  /**
   * Where the route departed from. Omitted falls back to the club's home city (Abuja) for
   * international journeys. Set it when the squad set off from somewhere else — Dana Cup
   * 2026 began in Gothenburg, not Nigeria — or to `null` for a route that simply starts at
   * its first stop.
   */
  origin?: JourneyStop | null;
  /** 0–100 */
  progress: number;
  record?: JourneyRecord | null;
  outcome?: { headline: string; body?: string; badge?: string } | null;
  heroMediaId?: string | null;
  playerIds: string[];
  fixtureIds: string[];
  matches: JourneyMatch[];
  table?: JourneyTableRow[];
  squad?: JourneySquadMember[];
  quotes: JourneyQuote[];
  published: boolean;
  featured?: boolean;
  order?: number;
  createdAt?: DateLike;
  updatedAt?: DateLike;
};

export type JourneyEntry = {
  id: string;
  day?: number;
  title: string;
  body?: string;
  location?: string;
  mediaIds: string[];
  /** Quick photo posted straight from the tour diary form. */
  imageUrl?: string;
  createdAt: DateLike;
};

export type MediaType =
  | "fullMatch"
  | "highlight"
  | "training"
  | "playerFocus"
  | "travelDiary"
  | "documentary"
  | "interview"
  | "behindScenes";

/**
 * What kind of game a clip belongs to. Deliberately a small fixed set rather than the
 * free-text `Fixture.competition`, so footage can be grouped and filtered consistently.
 */
export type FixtureKind = "friendly" | "league" | "cup" | "tournament" | "scouting";

/* `PlayerMatch` — one player's participation in one match, the source `Player.stats` is
   computed from — lives in `src/lib/player-matches.ts`, with the aggregation. Re-exported here
   so screens and scripts have a single import for the data model. */
export type { PlayerMatch, PlayerMatchSource, PlayerStats } from "./player-matches";

export type MediaAsset = {
  id: string;
  type: MediaType;
  title: string;
  description?: string;
  /** Direct video file (R2) or a YouTube/Vimeo link. */
  url: string;
  poster?: string;
  /** seconds */
  duration?: number;
  vertical?: boolean;
  journeyId?: string | null;
  fixtureId?: string | null;
  /** Match footage: what kind of game it was, who against, and the result. */
  fixtureKind?: FixtureKind;
  opponent?: string;
  scoreFor?: number;
  scoreAgainst?: number;
  playerIds: string[];
  /** Denormalised for display so the public site never needs a join. */
  taggedPlayers?: { id: string; name: string }[];
  year?: number;
  featured?: boolean;
  published: boolean;
  legacyVideoId?: string;
  createdAt?: DateLike;
};

export type GalleryPhoto = { url: string; caption?: string; playerIds?: string[]; w?: number; h?: number };

export type Gallery = {
  id: string;
  slug: string;
  chapter?: number;
  title: string;
  story?: string;
  location?: string;
  date?: string;
  journeyId?: string | null;
  photos: GalleryPhoto[];
  published: boolean;
  createdAt?: DateLike;
};

export type PlacementType = "signed" | "loan" | "trial";

export type Placement = {
  id: string;
  playerId?: string | null;
  playerName: string;
  playerImageUrl?: string;
  position?: string;
  club: string;
  country: string;
  league?: string;
  type: PlacementType;
  date?: string;
  verified: boolean;
  sourceUrl?: string;
  published: boolean;
  createdAt?: DateLike;
};

export type StaffGroup = "management" | "coaching" | "operations" | "medical";

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  group: StaffGroup;
  rank: number;
  imageUrl?: string;
  bio?: string;
  quote?: string;
  licences?: string[];
  published: boolean;
  legacyPlayerId?: string;
};

export type Achievement = {
  id: string;
  title: string;
  year: number;
  competition?: string;
  detail?: string;
  kind: "trophy" | "unbeaten" | "milestone";
  journeyId?: string | null;
  published: boolean;
};

export type EnquiryRole = "scout" | "parent" | "player" | "partner" | "media";

export type Enquiry = {
  id: string;
  role: EnquiryRole;
  name: string;
  email: string;
  phone?: string;
  organisation?: string;
  message: string;
  playerId?: string | null;
  playerName?: string | null;
  status: "new" | "read" | "replied" | "archived";
  createdAt: DateLike;
};

export type ProofStats = {
  playersAbroad: number;
  countries: number;
  tournaments: number;
  unbeatenRuns: number;
};

export type AdminUser = {
  id: string;
  email: string;
  name?: string;
  role: "owner" | "editor";
  createdAt?: DateLike;
};

export const newsArticles: NewsArticle[] = [
  // This mock data is no longer used for display, 
  // but kept for reference or other AI flows.
  {
    id: "1",
    headline: "Capital City Triumphs in Thrilling Derby Match",
    content: "In a nail-biting encounter, Capital City FC secured a 2-1 victory over their city rivals, with Leo Rivera scoring a dramatic late winner in the 89th minute. The match was a hard-fought battle from the first whistle, but Capital City's perseverance paid off, sending the home fans into a frenzy.",
    imageUrl: "https://placehold.co/800x600.png",
    date: "2024-05-15T12:00:00Z",
    tags: ["Victory", "Derby", "Leo Rivera", "Match Report"],
  },
  {
    id: "2",
    headline: "Marco Jensen's Masterclass Guides Team to Victory",
    content: "Marco Jensen delivered a midfield masterclass, providing two stunning assists in a comfortable 3-0 win against the Rovers. His control and vision were on full display, earning him Man of the Match honors.",
    imageUrl: "https://placehold.co/800x600.png",
    date: "2024-05-10T12:00:00Z",
    tags: ["Marco Jensen", "Win", "Assists", "Man of the Match"],
  },
];
