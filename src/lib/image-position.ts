/**
 * Where inside a photo a frame looks.
 *
 * Every photo in the app is drawn with `object-cover`, which fills its frame by scaling the
 * image until it covers the box and then hiding the overflow. What that overflow hides is the
 * whole problem: a tall photo of two people placed in a wide 16:9 hero has its top and bottom
 * cut off, and because the default is centre it shows the middle band — a chest, not a face.
 *
 * A `position` is the writer's answer, stored as the CSS value itself (`"50% 25%"`) so it needs
 * no translation at render time and stays readable in the database. The X and Y are percentages
 * of the *overflow*, not of the image: `0%` shows the top/left edge, `100%` the bottom/right,
 * `50%` the middle. That is exactly what `object-position` means, so the number stored is the
 * number the browser gets.
 *
 * Kept out of the picker component because server components need `focusStyle` to render an
 * article — a helper exported from a client module cannot be called during server rendering.
 */

/** Centre of the frame — the CSS default, and what every photo without a position gets. */
export const DEFAULT_FOCUS = "50% 50%"

const FOCUS_RE = /^\s*(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/

/**
 * Reads a stored position into numbers, falling back to centre.
 *
 * Anything unparseable becomes centre rather than throwing: a bad value in the database should
 * cost a writer a crop they can redo, not take the page down.
 */
export function readFocus(position: string | undefined): { x: number; y: number } {
  const match = FOCUS_RE.exec(position ?? "")
  if (!match) return { x: 50, y: 50 }
  return { x: clamp(Number(match[1])), y: clamp(Number(match[2])) }
}

/** Rounds and formats, so a drag does not store `33.73882%`. */
export function formatFocus(x: number, y: number): string {
  return `${clamp(x).toFixed(1).replace(/\.0$/, "")}% ${clamp(y).toFixed(1).replace(/\.0$/, "")}%`
}

/**
 * The inline style for an element showing a photo at the writer's position.
 *
 * Returns `undefined` when there is no position, so an article written before this existed
 * renders byte-for-byte as it did before — no style attribute, browser default, centre.
 */
export function focusStyle(position?: string): { objectPosition: string } | undefined {
  return position ? { objectPosition: position } : undefined
}

/** Whether a position is still the default, for deciding whether to offer a reset. */
export function isCentred(position?: string): boolean {
  if (!position) return true
  const { x, y } = readFocus(position)
  return x === 50 && y === 50
}

/**
 * The position a drag lands on.
 *
 * Done in overflow pixels rather than percentages so the photo tracks the pointer 1:1 whatever
 * the frame's size — a 200px preview and a full-width hero move the crop by the same amount.
 * `object-position: Y%` puts the image's Y% point against the frame's Y% point, so a drag applies
 * to the overflow left after `object-cover` scaled the picture up, not to the frame itself. The
 * sign is inverted because pulling the photo down reveals what sits above it.
 *
 * An axis with no overflow — the short side of a picture that already fits the frame — has
 * nowhere to move, so it stays centred instead of dividing by zero.
 */
export function dragToFocus(
  from: { x: number; y: number },
  drag: { dx: number; dy: number },
  box: { width: number; height: number },
  image: { width: number; height: number }
): string {
  // Before the picture decodes there is nothing to measure, so the frame is left where it is.
  if (!box.width || !box.height || !image.width || !image.height) return formatFocus(from.x, from.y)

  const scale = Math.max(box.width / image.width, box.height / image.height)
  const overflowX = image.width * scale - box.width
  const overflowY = image.height * scale - box.height

  const x = overflowX > 1 ? from.x - (drag.dx / overflowX) * 100 : 50
  const y = overflowY > 1 ? from.y - (drag.dy / overflowY) * 100 : 50
  return formatFocus(x, y)
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 50
  return Math.min(100, Math.max(0, n))
}
