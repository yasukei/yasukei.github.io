/**
 * Aspect ratio arithmetic: given a ratio and one side, work out the other.
 *
 * A ratio is kept as the pair the user wrote (16:9 stays 16 and 9) rather than
 * as a single quotient, so it can be echoed back and simplified. Both sides may
 * be fractional, which is what makes the cinema ratios (2.39:1) and the ISO
 * paper ratio (1.414:1) expressible at all.
 *
 * Nothing here clamps or rounds on its own: `widthFor` and `heightFor` return
 * the exact quotient and the caller decides how to present it, because whether
 * 1707.7 should become 1708 depends on whether it is a pixel or a millimetre.
 */

export interface Ratio {
  width: number
  height: number
}

export interface Preset {
  /** As it is written, e.g. "16:9". */
  label: string
  ratio: Ratio
  /** Where the ratio is normally met, for the button's title text. */
  note: string
}

export const PRESETS: Preset[] = [
  { label: '16:9', ratio: { width: 16, height: 9 }, note: 'Widescreen video, 1080p and 4K' },
  { label: '4:3', ratio: { width: 4, height: 3 }, note: 'Classic displays, older video' },
  { label: '3:2', ratio: { width: 3, height: 2 }, note: '35mm film, most DSLR sensors' },
  { label: '21:9', ratio: { width: 21, height: 9 }, note: 'Ultrawide monitors' },
  { label: '1:1', ratio: { width: 1, height: 1 }, note: 'Square' },
  { label: '9:16', ratio: { width: 9, height: 16 }, note: 'Vertical video, phone screens' },
  { label: '5:4', ratio: { width: 5, height: 4 }, note: 'Large format prints' },
  { label: '2.39:1', ratio: { width: 2.39, height: 1 }, note: 'Anamorphic widescreen cinema' },
  { label: '1.414:1', ratio: { width: 1.414, height: 1 }, note: 'ISO 216 paper, A4 and friends' }
]

/**
 * A non-negative decimal and nothing else. parseFloat is deliberately not used
 * on its own: it reads "16abc" as 16, which would silently accept a typo.
 */
const DECIMAL = /^(?:\d+(?:\.\d+)?|\.\d+)$/

/** ":", "/", "x" or plain whitespace, as people write ratios in the wild. */
const SEPARATOR = /\s*(?::|\/|[x×]|\s)\s*/

function toNumber(text: string): number | null {
  const trimmed = text.trim()
  if (!DECIMAL.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

/**
 * Reads "16:9", "16/9", "16x9", "16 9" and the bare quotient "1.7778", which is
 * taken as <value>:1. Either side may be fractional. Returns null for anything
 * unparseable or with a zero side, since a zero side has no reciprocal.
 */
export function parseRatio(input: string): Ratio | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  const parts = trimmed.split(SEPARATOR)
  if (parts.length > 2) return null

  const width = toNumber(parts[0])
  // A single number is a quotient: "1.7778" means 1.7778:1.
  const height = parts.length === 2 ? toNumber(parts[1]) : 1
  if (width === null || height === null) return null
  if (width <= 0 || height <= 0) return null

  return { width, height }
}

/** A dimension typed into a width or height field. 0 is allowed; it is what an empty box grows out of. */
export function parseDimension(input: string): number | null {
  const value = toNumber(input)
  return value === null || !Number.isFinite(value) ? null : value
}

function isUsable(ratio: Ratio): boolean {
  return (
    Number.isFinite(ratio.width) &&
    Number.isFinite(ratio.height) &&
    ratio.width > 0 &&
    ratio.height > 0
  )
}

/** The width that pairs with `height` at this ratio, or null if either is unusable. */
export function widthFor(height: number, ratio: Ratio): number | null {
  if (!Number.isFinite(height) || height < 0 || !isUsable(ratio)) return null
  return (height * ratio.width) / ratio.height
}

/** The height that pairs with `width` at this ratio, or null if either is unusable. */
export function heightFor(width: number, ratio: Ratio): number | null {
  if (!Number.isFinite(width) || width < 0 || !isUsable(ratio)) return null
  return (width * ratio.height) / ratio.width
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * 1920:1080 -> 16:9. Only whole numbers are reduced; 2.39:1 is already in the
 * form it is known by, and scaling it up to hunt for a common divisor would
 * turn a familiar label into 239:100.
 */
export function simplifyRatio(ratio: Ratio): Ratio {
  if (!isUsable(ratio)) return ratio
  if (!Number.isInteger(ratio.width) || !Number.isInteger(ratio.height)) return ratio

  const divisor = gcd(ratio.width, ratio.height)
  return { width: ratio.width / divisor, height: ratio.height / divisor }
}

/** Rounds away binary floating point fuzz, then drops trailing zeros: 1707.7000000000003 -> "1707.7". */
export function formatDimension(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return ''
  const rounded = Number(value.toFixed(Math.max(0, decimals)))
  return String(rounded)
}

export function formatRatio(ratio: Ratio): string {
  return `${formatDimension(ratio.width, 4)}:${formatDimension(ratio.height, 4)}`
}
