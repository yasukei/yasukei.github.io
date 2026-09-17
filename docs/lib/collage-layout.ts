/**
 * Where each image goes on the collage canvas.
 *
 * Nothing here draws anything: the layout is a list of rectangles, which is
 * what makes the interesting part testable at all. The properties worth
 * holding -- every image placed, nothing overlapping, nothing outside the
 * canvas, no holes left over, and the same seed giving the same arrangement --
 * are all statements about rectangles.
 *
 * The filled region is built by splitting recursively rather than by placing
 * images one after another. A split can never leave a hole or an overlap, so
 * "fill the rest of the canvas" holds by construction for every mode; what the
 * modes differ in is only where each split lands.
 */

import type { Size } from './image-resize'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type FillMode = 'grid' | 'mosaic' | 'random'
export type HeroPosition = 'left' | 'right' | 'top' | 'none'

export interface CollageOptions {
  canvas: Size
  /** Images to place, hero included. */
  count: number
  mode: FillMode
  hero: HeroPosition
  /** Share of the canvas the hero takes along the split axis, 0.2 to 0.8. */
  heroFraction: number
  /** Space between images, in pixels. */
  gap: number
  /** Space around the whole collage, in pixels. */
  padding: number
  seed: number
}

export interface CollageLayout {
  hero: Rect | null
  cells: Rect[]
}

/** One image more than the resizer takes: a hero plus eleven. */
export const MAX_COLLAGE_FILES = 12

/**
 * mulberry32: a small seeded generator, here because the arrangement has to be
 * reproducible -- so a layout can be re-rolled deliberately with Shuffle
 * rather than changing under the user on every unrelated redraw, and so the
 * tests can assert an exact arrangement.
 */
export function randomFrom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function isUsable(rect: Rect): boolean {
  return rect.width > 0 && rect.height > 0
}

/**
 * Cuts `region` in two along one axis, leaving `gap` between the halves.
 * `ratio` is the first half's share of the space that is left once the gap is
 * taken out, so the two halves and the gap always add back up to the whole.
 */
function cut(region: Rect, horizontal: boolean, ratio: number, gap: number): [Rect, Rect] {
  const span = horizontal ? region.width : region.height
  const usable = Math.max(0, span - gap)
  const first = clamp(ratio, 0.05, 0.95) * usable
  const second = usable - first

  if (horizontal) {
    return [
      { x: region.x, y: region.y, width: first, height: region.height },
      { x: region.x + first + gap, y: region.y, width: second, height: region.height }
    ]
  }
  return [
    { x: region.x, y: region.y, width: region.width, height: first },
    { x: region.x, y: region.y + first + gap, width: region.width, height: second }
  ]
}

interface SplitStyle {
  /** How far the share of each split may wander from an even one. */
  ratioJitter: number
  /** Whether the images are divided evenly between the two halves. */
  evenCounts: boolean
  /** Chance of cutting across the short side instead of the long one. */
  flipChance: number
}

const STYLES: Record<Exclude<FillMode, 'grid'>, SplitStyle> = {
  // Varied, but recognisably deliberate: always halve the group, and let only
  // the proportions wander.
  mosaic: { ratioJitter: 0.1, evenCounts: true, flipChance: 0 },
  // Anything goes: a split can put one image against five, and occasionally
  // cuts the short way, which is what produces the tall and wide outliers.
  random: { ratioJitter: 0.18, evenCounts: false, flipChance: 0.25 }
}

function splitInto(region: Rect, count: number, gap: number, rng: () => number, style: SplitStyle): Rect[] {
  if (count <= 1 || !isUsable(region)) return [region]

  const firstCount = style.evenCounts
    ? Math.floor(count / 2)
    : 1 + Math.floor(rng() * (count - 1))
  const secondCount = count - firstCount

  const longWay = region.width >= region.height
  const horizontal = rng() < style.flipChance ? !longWay : longWay

  // The share follows the number of images on each side, so a half holding
  // four images gets roughly four times the room of one holding one.
  const even = firstCount / count
  const ratio = even + (rng() * 2 - 1) * style.ratioJitter

  const [first, second] = cut(region, horizontal, ratio, gap)
  return [
    ...splitInto(first, firstCount, gap, rng, style),
    ...splitInto(second, secondCount, gap, rng, style)
  ]
}

/** How the images divide between `rows` rows, the remainder going to the top ones. */
function rowCounts(count: number, rows: number): number[] {
  const base = Math.floor(count / rows)
  const extra = count % rows
  return Array.from({ length: rows }, (_, row) => base + (row < extra ? 1 : 0))
}

/**
 * A row count that divides the images evenly is worth a lot: nine images in a
 * 16:9 region want 3x3, not rows of five and four. This is how much worse an
 * uneven arrangement has to be in cell shape before an even one is preferred.
 */
const UNEVEN_PENALTY = 0.35

/**
 * How badly `rows` rows suit the region: how far the cells stray from square,
 * plus a penalty when the rows do not hold the same number of images.
 *
 * Square is the target rather than the shape of the region, because the cells
 * hold photographs. Aiming at the region's own shape is self-similar and picks
 * absurd arrangements -- four images in a 4000x300 strip would come out as two
 * rows of two, each cell another 13:1 strip, instead of the single row that is
 * obviously wanted. The logarithm makes a cell twice too wide and one twice
 * too tall equally wrong.
 */
function gridCost(region: Rect, count: number, rows: number): number {
  const counts = rowCounts(count, rows)
  if (counts.some((columns) => columns === 0)) return Number.POSITIVE_INFINITY

  const rowHeight = region.height / rows
  const shape =
    counts.reduce(
      (sum, columns) => sum + Math.abs(Math.log(region.width / columns / rowHeight)),
      0
    ) / rows

  return shape + (new Set(counts).size > 1 ? UNEVEN_PENALTY : 0)
}

/**
 * Rows of equal height, each filled edge to edge by an equal share of the
 * images. The row count is the one that suits the region best; any remainder
 * is spread one per row from the top, so no row is ever left part empty with a
 * hole where an image should be.
 */
export function gridCells(region: Rect, count: number, gap: number): Rect[] {
  if (count <= 0 || !isUsable(region)) return []
  if (count === 1) return [region]

  let rows = 1
  let best = Number.POSITIVE_INFINITY
  for (let candidate = 1; candidate <= count; candidate++) {
    const cost = gridCost(region, count, candidate)
    if (cost < best) {
      best = cost
      rows = candidate
    }
  }

  const counts = rowCounts(count, rows)

  const rowHeight = (region.height - gap * (rows - 1)) / rows
  const cells: Rect[] = []

  for (let row = 0; row < rows; row++) {
    const columns = counts[row]
    const columnWidth = (region.width - gap * (columns - 1)) / columns
    const y = region.y + row * (rowHeight + gap)

    for (let column = 0; column < columns; column++) {
      cells.push({
        x: region.x + column * (columnWidth + gap),
        y,
        width: columnWidth,
        height: rowHeight
      })
    }
  }
  return cells
}

/** The canvas with the outer padding taken off. */
export function innerRegion(canvas: Size, padding: number): Rect {
  return {
    x: padding,
    y: padding,
    width: canvas.width - padding * 2,
    height: canvas.height - padding * 2
  }
}

export function layout(options: CollageOptions): CollageLayout {
  const { canvas, count, mode, hero, heroFraction, gap, padding, seed } = options
  const inner = innerRegion(canvas, padding)

  if (count <= 0 || !isUsable(inner)) return { hero: null, cells: [] }

  if (hero === 'none') return { hero: null, cells: fill(inner, count, mode, gap, seed) }
  // One image on its own is the hero, filling everything: there is nothing
  // left to give the other share of the canvas to.
  if (count === 1) return { hero: inner, cells: [] }

  const horizontal = hero !== 'top'
  const fraction = clamp(heroFraction, 0.2, 0.8)
  const [first, second] = cut(inner, horizontal, fraction, gap)
  // 'right' is the same cut with the two halves read the other way round.
  const heroRect = hero === 'right' ? second : first
  const rest = hero === 'right' ? first : second

  return { hero: heroRect, cells: fill(rest, count - 1, mode, gap, seed) }
}

function fill(region: Rect, count: number, mode: FillMode, gap: number, seed: number): Rect[] {
  if (count <= 0 || !isUsable(region)) return []
  if (mode === 'grid') return gridCells(region, count, gap)
  return splitInto(region, count, gap, randomFrom(seed), STYLES[mode])
}

/**
 * The part of the source to take so it fills `cell` completely, keeping the
 * aspect ratio and cropping what does not fit, centred.
 */
export function coverCrop(source: Size, cell: Size): Rect {
  const scale = Math.max(cell.width / source.width, cell.height / source.height)
  const width = Math.min(source.width, cell.width / scale)
  const height = Math.min(source.height, cell.height / scale)

  return {
    x: (source.width - width) / 2,
    y: (source.height - height) / 2,
    width,
    height
  }
}

/**
 * Where to draw the whole source inside `cell` so all of it shows, keeping the
 * aspect ratio and leaving the background visible around it.
 */
export function containBox(source: Size, cell: Rect): Rect {
  const scale = Math.min(cell.width / source.width, cell.height / source.height)
  const width = source.width * scale
  const height = source.height * scale

  return {
    x: cell.x + (cell.width - width) / 2,
    y: cell.y + (cell.height - height) / 2,
    width,
    height
  }
}

export function overlaps(a: Rect, b: Rect, tolerance = 0.001): boolean {
  return (
    a.x + a.width - tolerance > b.x &&
    b.x + b.width - tolerance > a.x &&
    a.y + a.height - tolerance > b.y &&
    b.y + b.height - tolerance > a.y
  )
}
