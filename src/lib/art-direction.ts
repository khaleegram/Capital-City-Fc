/**
 * Types and constants for hero art direction.
 *
 * Deliberately free of React and `next/image` imports so client components can use them
 * without dragging the image loader into the browser bundle.
 */

/** Width at which the mobile art takes over. Matches Tailwind's `md` (768px) elsewhere. */
export const ART_MOBILE_MAX = 767

/**
 * One art-direction slot, flattened into plain serializable values.
 *
 * It is deliberately not a React element: the homepage hero is a client component, and this
 * lets the server compute both slots and hand them across as props.
 */
export type ArtSlot = {
  src: string
  srcSet?: string
  sizes?: string
  loading?: "lazy" | "eager"
  fetchPriority?: "high" | "low" | "auto"
}

export type ArtDirection = {
  /** Always present — the fallback every screen gets when there is no mobile photo. */
  desktop: ArtSlot
  /** Optional. Only phones/tablets see this. */
  mobile?: ArtSlot
}
