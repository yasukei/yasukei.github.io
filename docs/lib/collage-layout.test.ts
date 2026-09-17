import { describe, it, expect } from 'vitest'
import {
  MAX_COLLAGE_FILES,
  containBox,
  coverCrop,
  gridCells,
  innerRegion,
  layout,
  overlaps,
  randomFrom,
  type CollageOptions,
  type FillMode,
  type Rect
} from './collage-layout'

const CANVAS = { width: 1920, height: 1080 }

const BASE: CollageOptions = {
  canvas: CANVAS,
  count: 6,
  mode: 'mosaic',
  hero: 'left',
  heroFraction: 0.5,
  gap: 0,
  padding: 0,
  seed: 1
}

function options(overrides: Partial<CollageOptions> = {}): CollageOptions {
  return { ...BASE, ...overrides }
}

function all(result: { hero: Rect | null; cells: Rect[] }): Rect[] {
  return result.hero ? [result.hero, ...result.cells] : result.cells
}

function area(rects: Rect[]): number {
  return rects.reduce((sum, rect) => sum + rect.width * rect.height, 0)
}

const MODES: FillMode[] = ['grid', 'mosaic', 'random']
/** Counts worth trying: one, two, an odd prime, and the maximum. */
const COUNTS = [1, 2, 3, 5, 7, MAX_COLLAGE_FILES]

describe('layout', () => {
  describe.each(MODES)('%s', (mode) => {
    it.each(COUNTS)('places all %i images', (count) => {
      expect(all(layout(options({ mode, count })))).toHaveLength(count)
    })

    it.each(COUNTS)('leaves nothing overlapping with %i images', (count) => {
      const rects = all(layout(options({ mode, count, gap: 12 })))

      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(overlaps(rects[i], rects[j]), `${i} overlaps ${j}`).toBe(false)
        }
      }
    })

    it.each(COUNTS)('keeps %i images inside the canvas', (count) => {
      const rects = all(layout(options({ mode, count, gap: 10, padding: 24 })))

      for (const rect of rects) {
        expect(rect.x).toBeGreaterThanOrEqual(24 - 0.001)
        expect(rect.y).toBeGreaterThanOrEqual(24 - 0.001)
        expect(rect.x + rect.width).toBeLessThanOrEqual(CANVAS.width - 24 + 0.001)
        expect(rect.y + rect.height).toBeLessThanOrEqual(CANVAS.height - 24 + 0.001)
      }
    })

    it.each(COUNTS)('leaves no holes with %i images when there is no gap', (count) => {
      // With no gap, the pieces have to add back up to the whole canvas: a hole
      // would show as background where an image was meant to be.
      const rects = all(layout(options({ mode, count, gap: 0, padding: 0 })))

      expect(area(rects)).toBeCloseTo(CANVAS.width * CANVAS.height, 4)
    })

    it('gives no rectangle a negative or zero side', () => {
      const rects = all(layout(options({ mode, count: MAX_COLLAGE_FILES, gap: 16, padding: 16 })))

      for (const rect of rects) {
        expect(rect.width).toBeGreaterThan(0)
        expect(rect.height).toBeGreaterThan(0)
      }
    })
  })

  it('gives the hero the share it was asked for', () => {
    const { hero } = layout(options({ heroFraction: 0.6, gap: 0 }))

    expect(hero?.width).toBeCloseTo(CANVAS.width * 0.6, 4)
    expect(hero?.height).toBe(CANVAS.height)
  })

  it('puts the hero on the side it was asked for', () => {
    const left = layout(options({ hero: 'left' }))
    const right = layout(options({ hero: 'right' }))
    const top = layout(options({ hero: 'top' }))

    expect(left.hero?.x).toBe(0)
    expect(right.hero?.x).toBeGreaterThan(0)
    expect(right.hero?.x ?? 0).toBeCloseTo(CANVAS.width - (right.hero?.width ?? 0), 4)
    expect(top.hero?.y).toBe(0)
    expect(top.hero?.width).toBe(CANVAS.width)
  })

  it('keeps the rest of the images clear of the hero', () => {
    const { hero, cells } = layout(options({ hero: 'left', heroFraction: 0.5, gap: 20 }))

    for (const cell of cells) {
      expect(cell.x).toBeGreaterThanOrEqual((hero as Rect).width + 20 - 0.001)
    }
  })

  it('fills the canvas with a single image, which has nothing to share with', () => {
    const { hero, cells } = layout(options({ count: 1 }))

    expect(cells).toEqual([])
    expect(hero).toEqual({ x: 0, y: 0, width: CANVAS.width, height: CANVAS.height })
  })

  it('treats every image equally when there is no hero', () => {
    const { hero, cells } = layout(options({ hero: 'none', count: 6 }))

    expect(hero).toBeNull()
    expect(cells).toHaveLength(6)
  })

  it('has nothing to lay out for no images', () => {
    expect(layout(options({ count: 0 }))).toEqual({ hero: null, cells: [] })
  })

  it('survives padding that swallows the canvas', () => {
    const result = layout(options({ padding: 700 }))

    expect(all(result)).toEqual([])
  })

  describe('reproducibility', () => {
    it('gives the same arrangement for the same seed', () => {
      expect(layout(options({ mode: 'random', seed: 42 }))).toEqual(
        layout(options({ mode: 'random', seed: 42 }))
      )
    })

    it('gives a different one for a different seed, which is what Shuffle is for', () => {
      expect(layout(options({ mode: 'random', seed: 1 }))).not.toEqual(
        layout(options({ mode: 'random', seed: 2 }))
      )
    })

    it('ignores the seed in grid mode, which has nothing to vary', () => {
      expect(layout(options({ mode: 'grid', seed: 1 }))).toEqual(
        layout(options({ mode: 'grid', seed: 9 }))
      )
    })
  })

  describe('the modes differ in the way they are meant to', () => {
    /** How far the cell areas spread around their mean, 0 for identical cells. */
    function spread(cells: Rect[]): number {
      const areas = cells.map((cell) => cell.width * cell.height)
      const mean = areas.reduce((a, b) => a + b, 0) / areas.length
      const variance = areas.reduce((sum, a) => sum + (a - mean) ** 2, 0) / areas.length
      return Math.sqrt(variance) / mean
    }

    it('makes grid cells uniform, mosaic varied, and random more varied still', () => {
      const cells = (mode: FillMode, seed: number) =>
        layout(options({ mode, count: 9, hero: 'none', seed })).cells

      expect(spread(cells('grid', 1))).toBeLessThan(0.05)
      expect(spread(cells('mosaic', 1))).toBeGreaterThan(spread(cells('grid', 1)))

      // Over several seeds, since a single random layout can come out tidy.
      const averageSpread = (mode: FillMode) =>
        [1, 2, 3, 4, 5].map((seed) => spread(cells(mode, seed))).reduce((a, b) => a + b, 0) / 5

      expect(averageSpread('random')).toBeGreaterThan(averageSpread('mosaic'))
    })
  })
})

describe('gridCells', () => {
  const region = { x: 0, y: 0, width: 1000, height: 1000 }

  it('lays four images out as two rows of two', () => {
    const cells = gridCells(region, 4, 0)

    expect(cells).toHaveLength(4)
    expect(new Set(cells.map((cell) => cell.y)).size).toBe(2)
    expect(new Set(cells.map((cell) => cell.x)).size).toBe(2)
  })

  it('prefers an arrangement that divides evenly', () => {
    // Nine in a 16:9 region is 3x3. Rows of five and four would give cells
    // marginally closer to square, which is not worth the ragged look.
    const cells = gridCells({ x: 0, y: 0, width: 1920, height: 1080 }, 9, 0)

    expect(new Set(cells.map((cell) => cell.y)).size).toBe(3)
    expect(new Set(cells.map((cell) => cell.x)).size).toBe(3)
    expect(new Set(cells.map((cell) => `${cell.width}x${cell.height}`)).size).toBe(1)
  })

  it('spreads a remainder across rows instead of leaving a hole', () => {
    // Five in two rows is 3 + 2, both rows full width.
    const cells = gridCells(region, 5, 0)
    const rows = new Map<number, Rect[]>()
    for (const cell of cells) rows.set(cell.y, [...(rows.get(cell.y) ?? []), cell])

    expect([...rows.values()].map((row) => row.length).sort()).toEqual([2, 3])
    for (const row of rows.values()) {
      expect(area(row)).toBeCloseTo(region.width * (row[0].height), 4)
    }
  })

  it('follows the shape of the region', () => {
    // A wide strip should end up as one row, not a square-ish block.
    const wide = gridCells({ x: 0, y: 0, width: 4000, height: 300 }, 4, 0)

    expect(new Set(wide.map((cell) => cell.y)).size).toBe(1)
  })

  it('has nothing to place for no images or no room', () => {
    expect(gridCells(region, 0, 0)).toEqual([])
    expect(gridCells({ x: 0, y: 0, width: 0, height: 100 }, 4, 0)).toEqual([])
  })
})

describe('coverCrop', () => {
  it('takes a centred slice of a wide source for a square cell', () => {
    const crop = coverCrop({ width: 4000, height: 2000 }, { width: 500, height: 500 })

    expect(crop).toEqual({ x: 1000, y: 0, width: 2000, height: 2000 })
  })

  it('takes a centred slice of a tall source for a wide cell', () => {
    const crop = coverCrop({ width: 1000, height: 4000 }, { width: 800, height: 400 })

    expect(crop).toEqual({ x: 0, y: 1750, width: 1000, height: 500 })
  })

  it('keeps the aspect ratio of the cell, which is the point of cropping', () => {
    const cell = { width: 300, height: 200 }
    const crop = coverCrop({ width: 4000, height: 3000 }, cell)

    expect(crop.width / crop.height).toBeCloseTo(cell.width / cell.height, 6)
  })

  it('takes the whole source when the ratios already match', () => {
    const crop = coverCrop({ width: 1600, height: 1200 }, { width: 400, height: 300 })

    expect(crop).toEqual({ x: 0, y: 0, width: 1600, height: 1200 })
  })

  it('never asks for more than the source has', () => {
    const crop = coverCrop({ width: 100, height: 100 }, { width: 4000, height: 10 })

    expect(crop.width).toBeLessThanOrEqual(100)
    expect(crop.height).toBeLessThanOrEqual(100)
  })
})

describe('containBox', () => {
  const cell = { x: 100, y: 50, width: 400, height: 400 }

  it('fits a wide image with room above and below, centred', () => {
    const box = containBox({ width: 2000, height: 1000 }, cell)

    expect(box).toEqual({ x: 100, y: 150, width: 400, height: 200 })
  })

  it('fits a tall image with room either side, centred', () => {
    const box = containBox({ width: 1000, height: 2000 }, cell)

    expect(box).toEqual({ x: 200, y: 50, width: 200, height: 400 })
  })

  it('keeps the aspect ratio of the source, which is the point of containing', () => {
    const box = containBox({ width: 4000, height: 3000 }, cell)

    expect(box.width / box.height).toBeCloseTo(4 / 3, 6)
  })

  it('stays inside the cell', () => {
    const box = containBox({ width: 4000, height: 3000 }, cell)

    expect(box.x).toBeGreaterThanOrEqual(cell.x)
    expect(box.y).toBeGreaterThanOrEqual(cell.y)
    expect(box.x + box.width).toBeLessThanOrEqual(cell.x + cell.width + 0.001)
    expect(box.y + box.height).toBeLessThanOrEqual(cell.y + cell.height + 0.001)
  })
})

describe('innerRegion', () => {
  it('takes the padding off every side', () => {
    expect(innerRegion({ width: 1000, height: 800 }, 20)).toEqual({
      x: 20,
      y: 20,
      width: 960,
      height: 760
    })
  })
})

describe('overlaps', () => {
  it('sees an overlap, and lets touching edges alone', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }

    expect(overlaps(a, { x: 50, y: 50, width: 100, height: 100 })).toBe(true)
    expect(overlaps(a, { x: 100, y: 0, width: 100, height: 100 })).toBe(false)
    expect(overlaps(a, { x: 0, y: 100, width: 100, height: 100 })).toBe(false)
  })
})

describe('randomFrom', () => {
  it('repeats exactly for a seed', () => {
    const first = [...Array(5)].map(randomFrom(7))
    const again = randomFrom(7)

    expect([...Array(5)].map(() => again())).not.toEqual(first.map(() => 0))
    expect([...Array(5)].map(randomFrom(7))).toEqual(first)
  })

  it('stays between zero and one', () => {
    const rng = randomFrom(3)

    for (let i = 0; i < 500; i++) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('differs between seeds', () => {
    expect(randomFrom(1)()).not.toBe(randomFrom(2)())
  })
})
