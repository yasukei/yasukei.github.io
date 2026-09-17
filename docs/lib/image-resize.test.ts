import { describe, it, expect } from 'vitest'
import {
  MAX_FILES,
  MAX_PIXELS,
  acceptFiles,
  exceedsCanvasLimit,
  extensionFor,
  formatBytes,
  isEnlargement,
  outputMime,
  outputName,
  qualityApplies,
  sizeDelta,
  stepPlan,
  targetSize,
  type SourceFile
} from './image-resize'

const PHOTO = { width: 4000, height: 3000 }

function file(name: string, type: string): SourceFile {
  return { name, type }
}

describe('targetSize', () => {
  it('scales to a longest edge, whichever side that is', () => {
    expect(targetSize(PHOTO, { mode: 'longest-edge', value: 1000 })).toEqual({
      width: 1000,
      height: 750
    })
    expect(targetSize({ width: 3000, height: 4000 }, { mode: 'longest-edge', value: 1000 })).toEqual(
      { width: 750, height: 1000 }
    )
  })

  it('scales from a width or a height', () => {
    expect(targetSize(PHOTO, { mode: 'width', value: 800 })).toEqual({ width: 800, height: 600 })
    expect(targetSize(PHOTO, { mode: 'height', value: 600 })).toEqual({ width: 800, height: 600 })
  })

  it('scales by percentage', () => {
    expect(targetSize(PHOTO, { mode: 'percent', value: 25 })).toEqual({ width: 1000, height: 750 })
  })

  it('rounds to whole pixels', () => {
    // 4000x3000 at 33% is 1320x990 exactly; 1333x999.75 is the interesting one.
    expect(targetSize(PHOTO, { mode: 'width', value: 1333 })).toEqual({ width: 1333, height: 1000 })
  })

  it('never returns a side below one pixel', () => {
    const wide = { width: 4000, height: 10 }

    expect(targetSize(wide, { mode: 'width', value: 100 })).toEqual({ width: 100, height: 1 })
  })

  it('leaves an image alone rather than enlarging it', () => {
    // Asking for more than the source has is a no-op, so a batch of mixed sizes
    // can be run at one setting without blowing the small ones up.
    expect(targetSize({ width: 1200, height: 900 }, { mode: 'longest-edge', value: 2000 })).toEqual({
      width: 1200,
      height: 900
    })
    expect(targetSize({ width: 1200, height: 900 }, { mode: 'percent', value: 150 })).toEqual({
      width: 1200,
      height: 900
    })
  })

  it('enlarges when explicitly allowed', () => {
    expect(
      targetSize({ width: 1200, height: 900 }, { mode: 'percent', value: 150 }, { allowEnlarge: true })
    ).toEqual({ width: 1800, height: 1350 })
  })

  it('refuses a source or a value it cannot work from', () => {
    expect(targetSize(PHOTO, { mode: 'width', value: 0 })).toBeNull()
    expect(targetSize(PHOTO, { mode: 'width', value: -100 })).toBeNull()
    expect(targetSize(PHOTO, { mode: 'width', value: Number.NaN })).toBeNull()
    expect(targetSize({ width: 0, height: 0 }, { mode: 'width', value: 100 })).toBeNull()
  })
})

describe('stepPlan', () => {
  it('halves until the last step is less than a 2:1 reduction', () => {
    // 4000 -> 400 in one draw reads a fraction of the source pixels; these
    // steps each average the pixels they cover.
    expect(stepPlan({ width: 4000, height: 3000 }, { width: 400, height: 300 })).toEqual([
      { width: 2000, height: 1500 },
      { width: 1000, height: 750 },
      { width: 500, height: 375 },
      { width: 400, height: 300 }
    ])
  })

  it('always ends exactly on the target', () => {
    const plan = stepPlan({ width: 4032, height: 3024 }, { width: 640, height: 480 })

    expect(plan[plan.length - 1]).toEqual({ width: 640, height: 480 })
  })

  it('never steps below the target on the way down', () => {
    const target = { width: 300, height: 200 }
    const plan = stepPlan({ width: 6000, height: 4000 }, target)

    for (const step of plan) {
      expect(step.width).toBeGreaterThanOrEqual(target.width)
      expect(step.height).toBeGreaterThanOrEqual(target.height)
    }
  })

  it('shrinks monotonically', () => {
    const plan = stepPlan({ width: 5000, height: 2500 }, { width: 320, height: 160 })

    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].width).toBeLessThan(plan[i - 1].width)
    }
  })

  it('takes a single step when the reduction is 2:1 or less', () => {
    expect(stepPlan({ width: 800, height: 600 }, { width: 400, height: 300 })).toEqual([
      { width: 400, height: 300 }
    ])
    expect(stepPlan({ width: 800, height: 600 }, { width: 700, height: 525 })).toEqual([
      { width: 700, height: 525 }
    ])
  })

  it('takes a single step when enlarging, which gains nothing from halving', () => {
    expect(stepPlan({ width: 400, height: 300 }, { width: 800, height: 600 })).toEqual([
      { width: 800, height: 600 }
    ])
  })

  it('is a no-op draw when the size is unchanged', () => {
    expect(stepPlan({ width: 800, height: 600 }, { width: 800, height: 600 })).toEqual([
      { width: 800, height: 600 }
    ])
  })

  it('terminates on an extreme reduction rather than looping', () => {
    const plan = stepPlan({ width: 20000, height: 20000 }, { width: 1, height: 1 })

    expect(plan.length).toBeLessThan(20)
    expect(plan[plan.length - 1]).toEqual({ width: 1, height: 1 })
  })

  it('has nothing to plan for an unusable size', () => {
    expect(stepPlan({ width: 0, height: 0 }, { width: 10, height: 10 })).toEqual([])
    expect(stepPlan({ width: 100, height: 100 }, { width: Number.NaN, height: 10 })).toEqual([])
  })
})

describe('isEnlargement', () => {
  it('is true when either side grows', () => {
    expect(isEnlargement({ width: 100, height: 100 }, { width: 101, height: 100 })).toBe(true)
    expect(isEnlargement({ width: 100, height: 100 }, { width: 100, height: 100 })).toBe(false)
    expect(isEnlargement({ width: 100, height: 100 }, { width: 50, height: 50 })).toBe(false)
  })
})

describe('exceedsCanvasLimit', () => {
  it('passes sizes a phone can hold', () => {
    expect(exceedsCanvasLimit({ width: 4032, height: 3024 })).toBe(false)
  })

  it('catches the ones iOS returns blank', () => {
    expect(exceedsCanvasLimit({ width: 8000, height: 6000 })).toBe(true)
    expect(exceedsCanvasLimit({ width: MAX_PIXELS, height: 2 })).toBe(true)
  })
})

describe('acceptFiles', () => {
  it('takes images', () => {
    const incoming = [file('a.png', 'image/png'), file('b.jpg', 'image/jpeg')]

    const { accepted, rejected } = acceptFiles([], incoming)

    expect(accepted).toEqual(incoming)
    expect(rejected).toEqual([])
  })

  it('turns away what is not an image, saying so', () => {
    const { accepted, rejected } = acceptFiles([], [file('notes.pdf', 'application/pdf')])

    expect(accepted).toEqual([])
    expect(rejected).toEqual([{ name: 'notes.pdf', reason: 'Not an image' }])
  })

  it('names HEIC as the reason, since that is what a phone hands over', () => {
    const { rejected } = acceptFiles([], [file('IMG_0001.HEIC', 'image/heic')])

    expect(rejected[0].reason).toContain('HEIC')
  })

  it('recognises HEIC by extension when the browser reports no type', () => {
    // Dropping from some file managers gives an empty type.
    const { accepted, rejected } = acceptFiles([], [file('IMG_0002.heic', '')])

    expect(accepted).toEqual([])
    expect(rejected[0].reason).toContain('HEIC')
  })

  it('turns away SVG with advice instead of a failed decode', () => {
    const { rejected } = acceptFiles([], [file('logo.svg', 'image/svg+xml')])

    expect(rejected[0].reason).toContain('vector')
  })

  it('stops at the limit and says which files were left out', () => {
    const held = Array.from({ length: 8 }, (_, i) => file(`held-${i}.png`, 'image/png'))
    const incoming = [
      file('x.png', 'image/png'),
      file('y.png', 'image/png'),
      file('z.png', 'image/png')
    ]

    const { accepted, rejected } = acceptFiles(held, incoming)

    expect(accepted.map((f) => f.name)).toEqual(['x.png', 'y.png'])
    expect(rejected).toEqual([{ name: 'z.png', reason: `Over the limit of ${MAX_FILES} images` }])
  })

  it('counts only what it actually accepted towards the limit', () => {
    const { accepted } = acceptFiles(
      [],
      [file('bad.pdf', 'application/pdf'), ...Array.from({ length: 10 }, (_, i) => file(`ok-${i}.png`, 'image/png'))]
    )

    expect(accepted).toHaveLength(10)
  })
})

describe('outputMime', () => {
  it('keeps a format the canvas can write back', () => {
    expect(outputMime('image/jpeg', 'source')).toBe('image/jpeg')
    expect(outputMime('image/webp', 'source')).toBe('image/webp')
    expect(outputMime('image/PNG', 'source')).toBe('image/png')
  })

  it('falls back to PNG for a format with no encoder', () => {
    // toBlob hands back a PNG for these whatever type is asked for, so the file
    // would otherwise be named .gif and not be one.
    expect(outputMime('image/gif', 'source')).toBe('image/png')
    expect(outputMime('image/bmp', 'source')).toBe('image/png')
    expect(outputMime('', 'source')).toBe('image/png')
  })

  it('takes an explicit choice as given', () => {
    expect(outputMime('image/png', 'image/webp')).toBe('image/webp')
  })
})

describe('outputName', () => {
  it('records the new size and the new extension', () => {
    expect(outputName('photo.JPG', { width: 800, height: 600 }, 'image/webp')).toBe(
      'photo-800x600.webp'
    )
  })

  it('replaces only the last extension', () => {
    expect(outputName('archive.tar.png', { width: 10, height: 10 }, 'image/png')).toBe(
      'archive.tar-10x10.png'
    )
  })

  it('copes with a name that has no extension', () => {
    expect(outputName('scan', { width: 10, height: 10 }, 'image/jpeg')).toBe('scan-10x10.jpg')
  })

  it('still produces a name for a file called nothing but an extension', () => {
    expect(outputName('.png', { width: 10, height: 10 }, 'image/png')).toBe('image-10x10.png')
  })
})

describe('extensionFor / qualityApplies', () => {
  it('maps the encodable types', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg')
    expect(extensionFor('image/webp')).toBe('webp')
    expect(extensionFor('image/png')).toBe('png')
  })

  it('offers quality only where it means something', () => {
    expect(qualityApplies('image/jpeg')).toBe(true)
    expect(qualityApplies('image/webp')).toBe(true)
    expect(qualityApplies('image/png')).toBe(false)
  })
})

describe('formatBytes', () => {
  it('climbs units as it goes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1_572_864)).toBe('1.5 MB')
  })

  it('has nothing to say about a non-size', () => {
    expect(formatBytes(-1)).toBe('')
    expect(formatBytes(Number.NaN)).toBe('')
  })
})

describe('sizeDelta', () => {
  it('signs the change', () => {
    expect(sizeDelta(1000, 620)).toBe('-38%')
    expect(sizeDelta(1000, 1120)).toBe('+12%')
    expect(sizeDelta(1000, 1000)).toBe('0%')
  })

  it('has nothing to compare against an empty original', () => {
    expect(sizeDelta(0, 100)).toBe('')
  })
})
