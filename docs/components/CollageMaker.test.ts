// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CollageMaker from './CollageMaker.vue'

/**
 * The geometry is covered in docs/lib/collage-layout.test.ts and the drawing
 * pipeline in docs/lib/canvas-resize.test.ts. What the component adds is the
 * composition: which image goes in which rectangle, on a canvas of the right
 * size, with the background filled in.
 *
 * happy-dom has no 2D context, so one is stubbed -- but recorded per canvas,
 * which is what lets the draws onto the output canvas be told apart from the
 * step-down passes onto the temporary ones.
 */

interface Draw {
  canvas: HTMLCanvasElement
  source: unknown
  x: number
  y: number
  width: number
  height: number
}

let draws: Draw[]
let fills: { canvas: HTMLCanvasElement; style: unknown }[]
let createImageBitmap: ReturnType<typeof vi.fn>
let downloads: string[]

/** Source images are 2000x1500 unless a test says otherwise. */
const SOURCE = { width: 2000, height: 1500 }
const CANVAS = { width: 1920, height: 1080 }

function stubCanvas() {
  draws = []
  fills = []

  HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement) {
    const canvas = this
    const state = { fillStyle: '' as unknown }
    return {
      set fillStyle(value: unknown) {
        state.fillStyle = value
      },
      get fillStyle() {
        return state.fillStyle
      },
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      fillRect: () => fills.push({ canvas, style: state.fillStyle }),
      drawImage: (source: unknown, ...rest: number[]) => {
        // The nine argument form crops; only its destination matters here.
        const [x, y, width, height] = rest.length === 8 ? rest.slice(4) : rest
        draws.push({ canvas, source, x, y, width, height })
      }
    }
  }) as never

  HTMLCanvasElement.prototype.toBlob = vi.fn(function (callback: BlobCallback, type?: string) {
    callback(new Blob([new Uint8Array(50_000)], { type: type ?? 'image/png' }))
  }) as never
}

/**
 * Forgets what has been drawn so far. Redraws append, so a test that changes a
 * setting has to start counting again or it sees both arrangements at once.
 */
function forget() {
  draws.length = 0
  fills.length = 0
}

/** Only the draws onto the finished collage, not the step-down passes. */
function composited(size = CANVAS): Draw[] {
  return draws.filter(
    (draw) => draw.canvas.width === size.width && draw.canvas.height === size.height
  )
}

function image(name: string): File {
  return new File([new Uint8Array(1000)], name, { type: 'image/jpeg' })
}

function images(count: number): File[] {
  return Array.from({ length: count }, (_, i) => image(`shot-${i}.jpg`))
}

async function withImages(files: File[]) {
  const wrapper = mount(CollageMaker)
  await wrapper.get('.cm-drop').trigger('drop', { dataTransfer: { files } })
  await flushPromises()
  return wrapper
}

async function settle(wrapper: ReturnType<typeof mount>) {
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  downloads = []
  stubCanvas()

  createImageBitmap = vi.fn(async () => ({ ...SOURCE, close: vi.fn() }))
  vi.stubGlobal('createImageBitmap', createImageBitmap)

  let urls = 0
  URL.createObjectURL = vi.fn(() => `blob:stub/${++urls}`)
  URL.revokeObjectURL = vi.fn()

  HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) {
    downloads.push(this.download)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('CollageMaker', () => {
  it('draws every image onto a canvas of the chosen size', async () => {
    const wrapper = await withImages(images(4))

    expect(composited()).toHaveLength(4)
    expect(wrapper.get('.cm-preview img').attributes('src')).toBe('blob:stub/1')
    expect(wrapper.get('.cm-totals').text()).toContain('1920 × 1080')
  })

  it('waits for images before drawing anything', () => {
    const wrapper = mount(CollageMaker)

    expect(wrapper.find('.cm-preview').exists()).toBe(false)
    expect(wrapper.get('.cm-hint').text()).toContain('Drop two or more images')
  })

  describe('the hero', () => {
    it('is drawn first, on the side it was given, at the share it was given', async () => {
      await withImages(images(4))

      const [hero, ...rest] = composited()
      // Half of a 1920 canvas, less the margin and half the gap.
      expect(hero.x).toBeLessThan(20)
      expect(hero.width).toBeGreaterThan(900)
      expect(hero.width).toBeLessThan(960)
      for (const cell of rest) expect(cell.x).toBeGreaterThan(hero.x + hero.width)
    })

    it('moves to the right when asked', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(4))

      forget()
      await wrapper.get('select[aria-label="Hero position"]').setValue('right')
      await settle(wrapper)

      const [hero, ...rest] = composited()
      expect(hero.x).toBeGreaterThan(CANVAS.width / 2)
      for (const cell of rest) expect(cell.x).toBeLessThan(hero.x)
    })

    it('takes more of the canvas as the slider moves', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(4))
      const before = composited()[0].width

      forget()
      await wrapper.get('input[aria-label="Hero size"]').setValue('80')
      await settle(wrapper)

      expect(composited()[0].width).toBeGreaterThan(before)
    })

    it('can be turned off, leaving every image equal', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(4))

      forget()
      await wrapper.get('select[aria-label="Hero position"]').setValue('none')
      await wrapper.get('select[aria-label="Layout"]').setValue('grid')
      await settle(wrapper)

      const cells = composited()
      expect(cells).toHaveLength(4)
      expect(new Set(cells.map((cell) => `${cell.width}x${cell.height}`)).size).toBe(1)
      expect(wrapper.find('input[aria-label="Hero size"]').exists()).toBe(false)
    })

    it('is whichever thumbnail was clicked', async () => {
      const wrapper = await withImages(images(3))
      const heroBefore = composited()[0].source

      await wrapper.findAll('.cm-chip-name')[2].trigger('click')
      await flushPromises()

      expect(composited().at(-3)?.source).not.toBe(heroBefore)
      expect(wrapper.findAll('.cm-chip')[2].classes()).toContain('cm-chip-hero')
    })

    it('passes to another image when the hero is removed', async () => {
      const wrapper = await withImages(images(3))

      await wrapper.findAll('.cm-chip-x')[0].trigger('click')
      await flushPromises()

      expect(wrapper.findAll('.cm-chip')).toHaveLength(2)
      expect(wrapper.findAll('.cm-chip')[0].classes()).toContain('cm-chip-hero')
      expect(composited().slice(-2)).toHaveLength(2)
    })
  })

  describe('layouts', () => {
    it('puts a grid of even cells in the filled region', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(5))

      forget()
      await wrapper.get('select[aria-label="Layout"]').setValue('grid')
      await settle(wrapper)

      // Four cells beside the hero, all the same size.
      const cells = composited().slice(1)
      expect(cells).toHaveLength(4)
      expect(new Set(cells.map((cell) => `${cell.width}x${cell.height}`)).size).toBe(1)
    })

    it('mixes the sizes in mosaic, which is the difference from grid', async () => {
      await withImages(images(5))

      const sizes = new Set(composited().slice(1).map((cell) => `${cell.width}x${cell.height}`))
      expect(sizes.size).toBeGreaterThan(1)
    })

    it('rearranges on Shuffle, and only where there is something to vary', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(5))
      const before = composited().map((cell) => `${cell.x},${cell.y}`)

      forget()
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      await wrapper.get('.cm-toolbar .cm-btn:nth-child(2)').trigger('click')
      await settle(wrapper)

      expect(composited().map((cell) => `${cell.x},${cell.y}`)).not.toEqual(before)
    })

    it('has nothing to shuffle in grid mode', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(5))

      await wrapper.get('select[aria-label="Layout"]').setValue('grid')
      await settle(wrapper)

      expect(wrapper.get('.cm-toolbar .cm-btn:nth-child(2)').attributes('disabled')).toBeDefined()
    })
  })

  describe('fit', () => {
    const rect = (draw: Draw) => `${draw.x},${draw.y} ${draw.width}x${draw.height}`

    it('keeps the whole hero visible by default', async () => {
      await withImages(images(4))

      // Contain: the hero is drawn at its own 4:3, smaller than the cell it
      // sits in, rather than cropped to fill it.
      const hero = composited()[0]
      expect(hero.width / hero.height).toBeCloseTo(SOURCE.width / SOURCE.height, 1)
      expect(hero.height).toBeLessThan(CANVAS.height - 24)
    })

    it('fills a cell by cropping rather than by stretching', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(4))

      forget()
      await wrapper.get('select[aria-label="Hero fit"]').setValue('cover')
      await settle(wrapper)

      // Cover draws onto exactly the cell, with the crop doing the work, so
      // the hero now fills the full height between the margins.
      expect(composited()[0].height).toBeCloseTo(CANVAS.height - 24, 0)
    })

    it('fits the hero and the rest independently', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(4))
      const before = composited().map(rect)

      forget()
      await wrapper.get('select[aria-label="Fit"]').setValue('contain')
      await settle(wrapper)
      const after = composited().map(rect)

      // Changing the fit of the rest leaves the hero exactly where it was.
      expect(after[0]).toBe(before[0])
      expect(after.slice(1)).not.toEqual(before.slice(1))

      forget()
      await wrapper.get('select[aria-label="Hero fit"]').setValue('cover')
      await settle(wrapper)
      const both = composited().map(rect)

      // And changing the hero's leaves the rest where they were.
      expect(both[0]).not.toBe(after[0])
      expect(both.slice(1)).toEqual(after.slice(1))
    })
  })

  describe('the canvas itself', () => {
    it('follows the chosen ratio and long edge', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(3))

      await wrapper.get('select[aria-label="Canvas ratio"]').setValue('9:16')
      await settle(wrapper)

      expect(wrapper.get('.cm-totals').text()).toContain('1080 × 1920')

      await wrapper.get('input[aria-label="Long edge"]').setValue('1200')
      await settle(wrapper)

      expect(wrapper.get('.cm-totals').text()).toContain('675 × 1200')
    })

    it('paints the background before the images', async () => {
      await withImages(images(3))

      const background = fills.filter((fill) => fill.canvas.width === CANVAS.width)
      expect(background).toHaveLength(1)
      expect(background[0].style).toBe('#ffffff')
    })

    it('leaves the background unpainted when it should be transparent', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(3))

      forget()
      await wrapper.get('select[aria-label="Background"]').setValue('transparent')
      await settle(wrapper)

      expect(fills.filter((fill) => fill.canvas.width === CANVAS.width)).toHaveLength(0)
    })

    it('still paints one for JPEG, which has no transparency to keep', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(3))

      await wrapper.get('select[aria-label="Background"]').setValue('transparent')
      await wrapper.get('select[aria-label="Format"]').setValue('image/jpeg')
      await settle(wrapper)

      // Otherwise every gap in the collage comes out black.
      const background = fills.filter((fill) => fill.canvas.width === CANVAS.width)
      expect(background.at(-1)?.style).toBe('#ffffff')
    })

    it('refuses a canvas too large to draw', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(3))

      await wrapper.get('input[aria-label="Long edge"]').setValue('9000')
      await settle(wrapper)

      expect(wrapper.get('.cm-error').text()).toContain('too large')
    })
  })

  describe('the images it is given', () => {
    it('takes at most twelve, saying what it left out', async () => {
      const wrapper = await withImages(images(13))

      expect(wrapper.findAll('.cm-chip')).toHaveLength(12)
      expect(wrapper.get('.cm-rejected').text()).toContain('Over the limit of 12')
    })

    it('prepares each image once, not on every redraw', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(4))
      expect(createImageBitmap).toHaveBeenCalledTimes(4)

      await wrapper.get('input[aria-label="Gap"]').setValue(40)
      await settle(wrapper)

      // Moving a slider redraws from the prepared copies; decoding four photos
      // again on every frame would make the sliders unusable.
      expect(createImageBitmap).toHaveBeenCalledTimes(4)
    })

    it('prepares them again when the canvas grows, so quality follows', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages(images(2))

      await wrapper.get('input[aria-label="Long edge"]').setValue('2400')
      await settle(wrapper)

      expect(createImageBitmap).toHaveBeenCalledTimes(4)
    })

    it('carries on with the images that worked', async () => {
      createImageBitmap
        .mockRejectedValueOnce(new Error('broken'))
        .mockRejectedValueOnce(new Error('broken'))
        .mockResolvedValue({ ...SOURCE, close: vi.fn() })

      await withImages(images(3))

      expect(composited()).toHaveLength(2)
    })

    it('says so when none of them could be read', async () => {
      createImageBitmap.mockRejectedValue(new Error('broken'))

      const wrapper = await withImages(images(2))

      expect(wrapper.get('.cm-error').text()).toContain('None of these images')
    })
  })

  it('downloads the collage under its size and format', async () => {
    const wrapper = await withImages(images(3))

    await wrapper.get('.cm-btn-main').trigger('click')

    expect(downloads).toEqual(['collage-1920x1080.png'])
  })

  it('clears back to an empty page', async () => {
    const wrapper = await withImages(images(3))

    await wrapper.get('.cm-toolbar .cm-btn:nth-child(3)').trigger('click')

    expect(wrapper.findAll('.cm-chip')).toHaveLength(0)
    expect(wrapper.find('.cm-preview').exists()).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:stub/1')
  })

  it('lets go of the preview when the page moves on', async () => {
    const wrapper = await withImages(images(3))

    wrapper.unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:stub/1')
  })
})
