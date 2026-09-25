/** Canonical Capital City FC crest served from /public */
export const TEAM_LOGO_URL = "/ccfc-crest.png";

/** Always use the canonical crest in the UI (Firestore may still store uploads for admin). */
export function teamLogoUrl(_logoUrl?: string | null): string {
  return TEAM_LOGO_URL;
}
