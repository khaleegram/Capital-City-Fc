/**
 * Where a player is now.
 *
 * The club needs three buckets and the data has to make them unmistakable, because the two
 * underlying fields are easy to set against each other:
 *
 * - `ccfc`    — still on the club's books.
 * - `nigeria` — left, and playing on in Nigeria.
 * - `abroad`  — left, and playing outside Nigeria. The one the club actually tracks.
 *
 * `squadStatus` answers "ours or not", and `movedAbroad` only means anything once that answer is
 * `alumni`. Deriving the situation here rather than at each call site keeps the admin list, the
 * public profile and the signup review from drifting apart on what "alumni" implies.
 *
 * Kept free of imports so it can run on the server and in the browser alike.
 */

import type { Player } from "./data"

export type PlayerSituation = "ccfc" | "nigeria" | "abroad"

/** The minimum needed to classify — most callers hold a partial player. */
type SituationInput = Pick<Player, "squadStatus"> & Pick<Partial<Player>, "movedAbroad">

/**
 * Classifies a player.
 *
 * `squadStatus` is optional on the type and absent on records written before it existed; those are
 * treated as current, which matches how the rest of the app has always read it.
 */
export function situationOf(player: SituationInput): PlayerSituation {
  if (player.squadStatus !== "alumni") return "ccfc"
  return player.movedAbroad === true ? "abroad" : "nigeria"
}

/** Whether the player is no longer on the club's books. */
export function isAlumni(player: SituationInput) {
  return situationOf(player) !== "ccfc"
}

/** Short label for a badge or table cell. */
export const SITUATION_LABEL: Record<PlayerSituation, string> = {
  ccfc: "CCFC squad",
  nigeria: "Nigeria",
  abroad: "Abroad",
}

/** Longer description, for the admin control where the choice needs explaining. */
export const SITUATION_HINT: Record<PlayerSituation, string> = {
  ccfc: "On the club's books now.",
  nigeria: "Left the club and plays on in Nigeria.",
  abroad: "Left the club and plays outside Nigeria.",
}

/**
 * The pair of fields that together express a situation.
 *
 * Written as one function so the two can never be set independently and disagree — the form, the
 * signup write and the admin screen all spread this into their update.
 *
 * `movedAbroad` is cleared rather than set to `false` when the player is still ours, because a
 * stale `true` sitting on a current player is the exact contradiction this exists to prevent.
 */
export function situationFields(situation: PlayerSituation): {
  squadStatus: "current" | "alumni"
  movedAbroad?: boolean
} {
  if (situation === "ccfc") return { squadStatus: "current" }
  return { squadStatus: "alumni", movedAbroad: situation === "abroad" }
}
