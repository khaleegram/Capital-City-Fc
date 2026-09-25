"use client"

/**
 * How the "get club updates" prompt decides when to appear, kept apart from the UI so the
 * cadence can be tuned without touching the component.
 */

export const CONSENT_STORAGE_KEY = "ccfc.push.consent.v1"

/**
 * Days to wait before asking again, indexed by how many times the visitor has already
 * dismissed the prompt.
 *
 * Declining once buys a week; declining again buys a month; the third buys a quarter. After
 * the list runs out the prompt stops for good, because a fourth ask is nagging rather than
 * persuading. Shorten these to ask more often.
 */
export const REPROMPT_SCHEDULE_DAYS: readonly number[] = [7, 30, 90]

/** Delay before the first appearance, so the prompt never competes with the hero loading. */
export const FIRST_PROMPT_DELAY_MS = 4000

const DAY_MS = 86_400_000

export type ConsentState = {
  /** How many times the visitor has dismissed or declined the prompt. */
  declined: number
  /** Epoch ms of the last dismissal. */
  dismissedAt?: number
  /** True once a push token has been stored for this device. */
  enabled?: boolean
}

const EMPTY: ConsentState = { declined: 0 }

/** Reads the stored state. Returns a fresh one when storage is unavailable or corrupt. */
export function readConsent(): ConsentState {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<ConsentState>
    return {
      declined: typeof parsed.declined === "number" && parsed.declined >= 0 ? parsed.declined : 0,
      dismissedAt: typeof parsed.dismissedAt === "number" ? parsed.dismissedAt : undefined,
      enabled: parsed.enabled === true,
    }
  } catch {
    return EMPTY
  }
}

export function writeConsent(state: ConsentState) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Private mode. The prompt simply reappears next visit, which is acceptable.
  }
}

export function clearConsent() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY)
  } catch {
    /* nothing to do */
  }
}

/** Records a dismissal and returns the state to persist. */
export function markDeclined(state: ConsentState): ConsentState {
  return { ...state, declined: state.declined + 1, dismissedAt: Date.now() }
}

/** Records that push is on, which retires the prompt permanently. */
export function markEnabled(state: ConsentState): ConsentState {
  return { ...state, enabled: true, dismissedAt: undefined }
}

/**
 * Whether the prompt should appear on this visit.
 *
 * `permissionBlocked` short-circuits the whole thing: once the browser has notifications
 * set to blocked there is nothing the prompt can offer, so showing it again only repeats bad
 * news. Being already enabled also retires it.
 */
export function shouldPrompt(state: ConsentState, now = Date.now(), permissionBlocked = false): boolean {
  if (state.enabled) return false
  if (permissionBlocked) return false
  if (state.declined === 0) return true
  if (state.declined > REPROMPT_SCHEDULE_DAYS.length) return false

  const waitDays = REPROMPT_SCHEDULE_DAYS[state.declined - 1]
  if (!state.dismissedAt) return true
  return now - state.dismissedAt >= waitDays * DAY_MS
}
