// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CanvasUnavailableError,
  EncodeFailedError,
  decode,
  drawStep,
  release,
  renderPlan,
  toBlob
} from './canvas-resize'
import { stepPlan } from './image-resize'

/**
 * happy-dom has no 2D context, so the context is stubbed and what this module
 * asks of it is checked instead. That is the part worth pinning down: the
 * number of draws, the size of each one, and the smoothing settings -- a
 * regression in any of them is a quietly blurrier image, which no type check
 * or build would notice.
 */

interface DrawCall {
  width: number
  height: number
  source: unknown
  /** The source rectangle, when the call cropped. */
  crop?: { x: number; y: number; width: number; height: number }
}

const draws: DrawCall[] = []
let smoothing: { enabled: unknown; quality: unknown }[] = []
let getContext: ReturnType<typeof vi.fn>

beforeEach(() => {
  draws.length = 0
  smoothing = []

  getContext = vi.fn(() => {
    const record = { enabled: undefined as unknown, quality: undefined as unknown }
    smoothing.push(record)
    return {
      set imageSmoothingEnabled(value: boolean) {
        record.enabled = value
      },
      set imageSmoothingQuality(value: string) {
        record.quality = value
      },
      drawImage: (source: unknown, ...rest: number[]) => {
        // Three arities exist; the nine argument form is the cropping one.
        if (rest.length === 8) {
          const [x, y, width, height, , , destWidth, destHeight] = rest
          draws.push({ source, width: destWidth, height: destHeight, crop: { x, y, width, height } })
        } else {
          const [, , width, height] = rest
          draws.push({ source, width, height })
        }
      }
    }
  })

  HTMLCanvasElement.prototype.getContext = getContext as never
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Stands in for a decoded bitmap. */
const source = { width: 4000, height: 3000 } as unknown as CanvasImageSource

describe('drawStep', () => {
  it('sizes the canvas to the step, not to the source', () => {
    const canvas = drawStep(source, { width: 640, height: 480 })

    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(480)
    expect(draws).toEqual([{ source, width: 640, height: 480 }])
  })

  it('asks for the best resampling the browser has', () => {
    drawStep(source, { width: 640, height: 480 })

    expect(smoothing).toEqual([{ enabled: true, quality: 'high' }])
  })

  it('says so when the browser gives no 2D context', () => {
    getContext.mockReturnValue(null)

    expect(() => drawStep(source, { width: 10, height: 10 })).toThrow(CanvasUnavailableError)
  })
})

describe('renderPlan', () => {
  it('draws once per step', () => {
    const plan = [
      { width: 2000, height: 1500 },
      { width: 1000, height: 750 },
      { width: 800, height: 600 }
    ]

    renderPlan(source, plan)

    expect(draws.map(({ width, height }) => ({ width, height }))).toEqual(plan)
  })

  it('feeds each step the canvas the last one produced', () => {
    renderPlan(source, [
      { width: 2000, height: 1500 },
      { width: 1000, height: 750 }
    ])

    // The first draw reads the bitmap; the second reads the canvas from the
    // first. Drawing the original every time would defeat the whole plan.
    expect(draws[0].source).toBe(source)
    expect(draws[1].source).not.toBe(source)
    expect((draws[1].source as HTMLCanvasElement).width).toBe(2000)
  })

  it('returns a canvas of the final size', () => {
    const canvas = renderPlan(source, stepPlan({ width: 4000, height: 3000 }, { width: 400, height: 300 }))

    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(300)
  })

  it('carries a big reduction through several passes', () => {
    // The point of the whole exercise: 10:1 is not done in one draw.
    renderPlan(source, stepPlan({ width: 4000, height: 3000 }, { width: 400, height: 300 }))

    expect(draws.length).toBe(4)
  })

  it('refuses an empty plan rather than returning nothing', () => {
    expect(() => renderPlan(source, [])).toThrow()
  })
})

describe('cropping', () => {
  const crop = { x: 500, y: 0, width: 3000, height: 3000 }

  it('takes only the cropped part of the source', () => {
    drawStep(source, { width: 400, height: 400 }, crop)

    expect(draws).toEqual([{ source, width: 400, height: 400, crop }])
  })

  it('crops on the first pass only', () => {
    // After the first draw the canvas in hand is already the cropped image;
    // cropping again would cut into what was kept.
    renderPlan(source, [{ width: 1500, height: 1500 }, { width: 400, height: 400 }], crop)

    expect(draws[0].crop).toEqual(crop)
    expect(draws[1].crop).toBeUndefined()
  })

  it('still steps down, so a crop is not resampled in one go', () => {
    renderPlan(source, stepPlan(crop, { width: 300, height: 300 }), crop)

    expect(draws.length).toBeGreaterThan(1)
    expect(draws[draws.length - 1]).toMatchObject({ width: 300, height: 300 })
  })
})

describe('toBlob', () => {
  it('resolves with what the browser encoded', async () => {
    const blob = new Blob(['x'], { type: 'image/webp' })
    const canvas = document.createElement('canvas')
    canvas.toBlob = vi.fn((cb: BlobCallback) => cb(blob)) as never

    await expect(toBlob(canvas, 'image/webp', 0.8)).resolves.toBe(blob)
  })

  it('passes the type and quality through', async () => {
    const canvas = document.createElement('canvas')
    const spy = vi.fn((cb: BlobCallback) => cb(new Blob()))
    canvas.toBlob = spy as never

    await toBlob(canvas, 'image/jpeg', 0.6)

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.6)
  })

  it('rejects when the browser hands back nothing', async () => {
    const canvas = document.createElement('canvas')
    canvas.toBlob = vi.fn((cb: BlobCallback) => cb(null)) as never

    await expect(toBlob(canvas, 'image/webp')).rejects.toThrow(EncodeFailedError)
  })
})

describe('decode', () => {
  const bitmap = { width: 10, height: 10 } as ImageBitmap

  it('asks for the EXIF orientation to be applied', async () => {
    const create = vi.fn().mockResolvedValue(bitmap)
    vi.stubGlobal('createImageBitmap', create)
    const file = new Blob([], { type: 'image/jpeg' })

    await expect(decode(file)).resolves.toBe(bitmap)
    expect(create).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' })
  })

  it('still decodes on a browser that rejects the option', async () => {
    // Rather than failing the file outright: only a rotated JPEG is affected.
    const create = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('unknown option'))
      .mockResolvedValue(bitmap)
    vi.stubGlobal('createImageBitmap', create)

    await expect(decode(new Blob())).resolves.toBe(bitmap)
    expect(create).toHaveBeenCalledTimes(2)
  })
})

describe('release', () => {
  it('closes a bitmap and tolerates one that cannot be closed', () => {
    const close = vi.fn()

    release({ close } as unknown as ImageBitmap)
    release({} as ImageBitmap)
    release(null)

    expect(close).toHaveBeenCalledOnce()
  })
})
