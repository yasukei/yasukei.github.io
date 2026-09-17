/**
 * The arithmetic and the bookkeeping behind the image resizer.
 *
 * Everything here is pure, and deliberately so: the pixels themselves are moved
 * by the canvas, which the test environment does not implement
 * (`getContext('2d')` returns null under happy-dom), so anything that can be
 * decided without pixels is decided here where it can be tested -- the output
 * size, the sequence of draws that gets there, the file name, which files are
 * allowed in, and whether the result would exceed what a canvas can hold.
 *
 * The one piece of image quality that lives here is `stepPlan`, which is most
 * of the reason this tool exists at all. See its comment.
 */

import { heightFor, widthFor } from './aspect-ratio'

export interface Size {
  width: number
  height: number
}

export type ResizeMode = 'longest-edge' | 'width' | 'height' | 'percent'

export interface ResizeSpec {
  mode: ResizeMode
  /** Pixels for the first three modes, a percentage for 'percent'. */
  value: number
}

/** A dropped file, reduced to what the decisions here need. */
export interface SourceFile {
  name: string
  type: string
}

export interface Rejection {
  name: string
  reason: string
}

/** One batch at a time; ten images is already a slow minute on a phone. */
export const MAX_FILES = 10

/**
 * Canvas area ceiling, in pixels. Chrome and Firefox allow far more, but iOS
 * Safari refuses somewhere above 16.7M (4096x4096 is the number usually
 * quoted, though it is an area limit, not a side limit) and returns a blank
 * canvas rather than an error -- so the check is on the small side on purpose.
 */
export const MAX_PIXELS = 16_777_216

/** What a canvas can be asked to encode, whatever the browser can decode. */
const ENCODABLE = ['image/png', 'image/jpeg', 'image/webp'] as const

export type OutputChoice = 'source' | (typeof ENCODABLE)[number]

export const OUTPUT_FORMATS: { label: string; choice: OutputChoice }[] = [
  { label: 'Same as source', choice: 'source' },
  { label: 'WebP', choice: 'image/webp' },
  { label: 'JPEG', choice: 'image/jpeg' },
  { label: 'PNG', choice: 'image/png' }
]

/**
 * Sources the tool turns away, with the reason it can give the user. HEIC is
 * the one worth naming: it is what an iPhone hands over by default, and no
 * browser but Safari can decode it without a WASM decoder.
 */
function rejectionReason(file: SourceFile): string | null {
  const type = file.type.toLowerCase()

  if (type === 'image/heic' || type === 'image/heif' || /\.hei[cf]$/i.test(file.name)) {
    return 'HEIC is only decodable in Safari — convert to JPEG first'
  }
  if (type === 'image/svg+xml') {
    return 'SVG is a vector image; scale it by changing its width and height'
  }
  if (!type.startsWith('image/')) {
    return 'Not an image'
  }
  return null
}

/**
 * Adds what it can of `incoming` to what is already held, up to `max`.
 * Everything turned away comes back with a reason, because a file that simply
 * vanishes on drop looks like a bug in the page.
 */
export function acceptFiles<T extends SourceFile>(
  existing: readonly T[],
  incoming: readonly T[],
  max: number = MAX_FILES
): { accepted: T[]; rejected: Rejection[] } {
  const accepted: T[] = []
  const rejected: Rejection[] = []
  let room = Math.max(0, max - existing.length)

  for (const file of incoming) {
    const reason = rejectionReason(file)
    if (reason !== null) {
      rejected.push({ name: file.name, reason })
      continue
    }
    if (room === 0) {
      rejected.push({ name: file.name, reason: `Over the limit of ${max} images` })
      continue
    }
    accepted.push(file)
    room--
  }

  return { accepted, rejected }
}

function isUsableSize(size: Size): boolean {
  return (
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width >= 1 &&
    size.height >= 1
  )
}

/** Whole pixels, and never below 1: a zero-sided canvas throws. */
function round(size: Size): Size {
  return {
    width: Math.max(1, Math.round(size.width)),
    height: Math.max(1, Math.round(size.height))
  }
}

/**
 * The size `source` becomes under `spec`, with the aspect ratio kept.
 *
 * `allowEnlarge` is off by default: this tool is for making images smaller, and
 * asking for a 2000px longest edge from a 1200px photo should leave it alone
 * rather than quietly upscale it to something blurrier than the original.
 */
export function targetSize(
  source: Size,
  spec: ResizeSpec,
  options: { allowEnlarge?: boolean } = {}
): Size | null {
  if (!isUsableSize(source)) return null
  if (!Number.isFinite(spec.value) || spec.value <= 0) return null

  const ratio = { width: source.width, height: source.height }
  let target: Size

  switch (spec.mode) {
    case 'width': {
      const height = heightFor(spec.value, ratio)
      if (height === null) return null
      target = { width: spec.value, height }
      break
    }
    case 'height': {
      const width = widthFor(spec.value, ratio)
      if (width === null) return null
      target = { width, height: spec.value }
      break
    }
    case 'longest-edge': {
      const scale = spec.value / Math.max(source.width, source.height)
      target = { width: source.width * scale, height: source.height * scale }
      break
    }
    case 'percent': {
      const scale = spec.value / 100
      target = { width: source.width * scale, height: source.height * scale }
      break
    }
    default:
      return null
  }

  const rounded = round(target)
  if (options.allowEnlarge !== true && isEnlargement(source, rounded)) {
    return { ...source }
  }
  return rounded
}

/** True when the target is bigger than the source on either side. */
export function isEnlargement(source: Size, target: Size): boolean {
  return target.width > source.width || target.height > source.height
}

/**
 * The sequence of sizes to draw through to get from `from` to `to`.
 *
 * This is the quality of the whole tool. `drawImage` resamples with a small
 * kernel, so drawing 4000px straight down to 400px reads only a fraction of the
 * source pixels and drops the rest -- thin lines break up and detail turns to
 * noise. Halving repeatedly instead makes every step a 2:1 reduction, where the
 * kernel covers the pixels it is averaging, so nothing is skipped; the last
 * step, always less than 2:1, lands exactly on the target.
 *
 * Enlarging gets a single step: there is no extra detail to preserve, and
 * repeated doubling only compounds the interpolation.
 */
export function stepPlan(from: Size, to: Size): Size[] {
  if (!isUsableSize(from) || !isUsableSize(to)) return []

  const steps: Size[] = []
  let current = round(from)
  const target = round(to)

  // Both sides are compared so a plan is never made that overshoots one axis;
  // with the ratio preserved they cross the threshold together anyway.
  while (current.width > target.width * 2 && current.height > target.height * 2) {
    current = round({
      width: Math.max(target.width, current.width / 2),
      height: Math.max(target.height, current.height / 2)
    })
    steps.push(current)
  }

  if (steps.length === 0 || !sameSize(steps[steps.length - 1], target)) {
    steps.push(target)
  }
  return steps
}

export function sameSize(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height
}

export function pixelCount(size: Size): number {
  return size.width * size.height
}

/** A canvas this big may come back blank on iOS rather than fail outright. */
export function exceedsCanvasLimit(size: Size, max: number = MAX_PIXELS): boolean {
  return pixelCount(size) > max
}

export function extensionFor(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'png'
  }
}

/**
 * What the output will actually be encoded as. 'source' keeps the format when
 * the canvas can write it back, and falls back to PNG when it cannot -- a GIF
 * or a BMP can be decoded and drawn, but `toBlob` has no encoder for it and
 * silently hands back a PNG under the old type, which would produce a file
 * named .gif that is not one.
 */
export function outputMime(sourceType: string, choice: OutputChoice): string {
  if (choice !== 'source') return choice
  const type = sourceType.toLowerCase()
  return (ENCODABLE as readonly string[]).includes(type) ? type : 'image/png'
}

/** Quality is meaningless for PNG; the slider is hidden rather than ignored. */
export function qualityApplies(mime: string): boolean {
  return mime === 'image/jpeg' || mime === 'image/webp'
}

/** "photo.JPG" at 800x600 as webp -> "photo-800x600.webp". */
export function outputName(sourceName: string, size: Size, mime: string): string {
  const base = sourceName.replace(/\.[^./\\]+$/, '') || 'image'
  return `${base}-${size.width}x${size.height}.${extensionFor(mime)}`
}

const UNITS = ['B', 'KB', 'MB', 'GB']

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  // Bytes are never fractional; everything else reads better with one decimal.
  const shown = unit === 0 ? String(Math.round(value)) : String(Number(value.toFixed(1)))
  return `${shown} ${UNITS[unit]}`
}

/** "-38%" for a file that came out smaller, "+12%" for one that grew. */
export function sizeDelta(before: number, after: number): string {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) return ''
  const percent = Math.round(((after - before) / before) * 100)
  return `${percent > 0 ? '+' : ''}${percent}%`
}
