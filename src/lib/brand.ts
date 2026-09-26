import { copy } from "./copy"

/** Canonical Capital City FC crest served from /public */
export const TEAM_LOGO_URL = "/ccfc-crest.png";

/**
 * The club's public contact address.
 *
 * The address is editable in /admin/settings, but every reader has to fall back to the brand
 * default rather than show nothing: a club that has never opened that screen still has one email,
 * and `copy.brand.email` is where it lives. Routing every caller through here is what keeps the
 * footer, the contact page and the structured data from disagreeing after an admin edit.
 */
export function contactEmailOf(team?: { contactEmail?: string } | null): string {
  return team?.contactEmail?.trim() || copy.brand.email
}

/** Always use the canonical crest in the UI (Firestore may still store uploads for admin). */
export function teamLogoUrl(_logoUrl?: string | null): string {
  return TEAM_LOGO_URL;
}
