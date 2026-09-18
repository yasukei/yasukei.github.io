import { describe, it, expect } from 'vitest'
import { decode, drawStep, renderPlan, toBlob } from './canvas-resize'
import { stepPlan, type Size } from './image-resize'

/**
 * What the unit suite cannot reach: the pixels themselves, and the differences
 * between the engines that draw them.
 *
 * The measure throughout is the area average -- the mean of every source pixel
 * a given output pixel covers. For a reduction by a whole number of pixels that
 * is not an approximation of the right answer, it is the right answer, so a
 * result can be compared against it directly rather than against a screenshot.
 */

const SOURCE = 1600
const TARGET = 100

function canvasOf(size: Size): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  return canvas
}

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d context in the browser running these tests')
  return ctx
}

/**
 * A one pixel checkerboard: the highest frequency an image can hold, and the
 * pattern that shows aliasing most plainly. Reduced by any even factor its
 * correct answer is a flat mid grey, so every departure from flat is the
 * resampler dropping pixels instead of averaging them.
 */
function checkerboard(side: number): HTMLCanvasElement {
  const tile = canvasOf({ width: 2, height: 2 })
  const tileCtx = contextOf(tile)
  tileCtx.fillStyle = '#000000'
  tileCtx.fillRect(0, 0, 2, 2)
  tileCtx.fillStyle = '#ffffff'
  tileCtx.fillRect(0, 0, 1, 1)
  tileCtx.fillRect(1, 1, 1, 1)

  const canvas = canvasOf({ width: side, height: side })
  const ctx = contextOf(canvas)
  const pattern = ctx.createPattern(tile, 'repeat') as CanvasPattern
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, side, side)
  return canvas
}

/**
 * Thin diagonal lines: the pattern that separates the browsers. A checkerboard
 * is regular enough that every engine happens to average it; diagonals at an
 * angle are what a one-pass resample visibly breaks up.
 */
function diagonals(side: number, spacing = 6): HTMLCanvasElement {
  const canvas = canvasOf({ width: side, height: side })
  const ctx = contextOf(canvas)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, side, side)
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1
  for (let offset = -side; offset < side * 2; offset += spacing) {
    ctx.beginPath()
    ctx.moveTo(offset, 0)
    ctx.lineTo(offset + side, side)
    ctx.stroke()
  }
  return canvas
}

/** A smooth ramp, where a resampler has nothing to alias but plenty to get wrong. */
function gradient(side: number): HTMLCanvasElement {
  const canvas = canvasOf({ width: side, height: side })
  const ctx = contextOf(canvas)
  const ramp = ctx.createLinearGradient(0, 0, side, side)
  ramp.addColorStop(0, '#000000')
  ramp.addColorStop(1, '#ffffff')
  ctx.fillStyle = ramp
  ctx.fillRect(0, 0, side, side)
  return canvas
}

/** The green channel of every pixel, which for these greys is the value itself. */
function values(canvas: HTMLCanvasElement): Float64Array {
  const { data, width, height } = contextOf(canvas).getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  )
  const out = new Float64Array(width * height)
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 1]
  return out
}

/** The correct downscale: each output pixel is the mean of the block it covers. */
function areaAverage(source: HTMLCanvasElement, target: Size): Float64Array {
  const pixels = values(source)
  const blockWidth = source.width / target.width
  const blockHeight = source.height / target.height
  const out = new Float64Array(target.width * target.height)

  for (let y = 0; y < target.height; y++) {
    for (let x = 0; x < target.width; x++) {
      let total = 0
      let count = 0
      for (let sy = Math.floor(y * blockHeight); sy < (y + 1) * blockHeight; sy++) {
        for (let sx = Math.floor(x * blockWidth); sx < (x + 1) * blockWidth; sx++) {
          total += pixels[sy * source.width + sx]
          count++
        }
      }
      out[y * target.width + x] = total / count
    }
  }
  return out
}

function meanAbsoluteError(a: Float64Array, b: Float64Array): number {
  let total = 0
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i])
  return total / a.length
}

function standardDeviation(pixels: Float64Array): number {
  const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length
  const variance =
    pixels.reduce((sum, value) => sum + (value - mean) ** 2, 0) / pixels.length
  return Math.sqrt(variance)
}

const target = { width: TARGET, height: TARGET }

/** The whole reduction in one draw: what this project exists not to do. */
function singlePass(source: CanvasImageSource): HTMLCanvasElement {
  return drawStep(source, target)
}

function stepped(source: HTMLCanvasElement): HTMLCanvasElement {
  return renderPlan(source, stepPlan({ width: source.width, height: source.height }, target))
}

describe('the browser really is drawing', () => {
  it('gives a 2D context and honours the smoothing settings', () => {
    const ctx = contextOf(canvasOf({ width: 10, height: 10 }))
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // The unit tests can only assert that these are set; here they are read
    // back from the browser that will act on them.
    expect(ctx.imageSmoothingEnabled).toBe(true)
    expect(ctx.imageSmoothingQuality).toBe('high')
  })

  it('draws the checkerboard the tests are built on', () => {
    const pixels = values(checkerboard(4))

    expect([...pixels]).toEqual([255, 0, 255, 0, 0, 255, 0, 255, 255, 0, 255, 0, 0, 255, 0, 255])
  })
})

describe('downscaling a checkerboard 16:1', () => {
  it('comes out flat, which is the correct answer', () => {
    // Every output pixel covers 128 black and 128 white pixels, so a resampler
    // that reads them all can only return mid grey.
    const result = values(stepped(checkerboard(SOURCE)))

    expect(standardDeviation(result)).toBeLessThan(2)
    expect(meanAbsoluteError(result, areaAverage(checkerboard(SOURCE), target))).toBeLessThan(2)
  })

  it('is no worse than resampling in one pass', () => {
    // Stated as "no worse" rather than "better" on purpose: a browser whose
    // one-pass filter is already good is a fine outcome. What would not be
    // fine is stepping making the image worse, which is what this catches.
    const source = checkerboard(SOURCE)
    const reference = areaAverage(source, target)

    const steppedError = meanAbsoluteError(values(stepped(source)), reference)
    const onePassError = meanAbsoluteError(values(singlePass(source)), reference)

    expect(steppedError).toBeLessThanOrEqual(onePassError + 0.5)
  })
})

describe('downscaling thin diagonals', () => {
  /**
   * The case the halving exists for, and the one where the engines disagree
   * most -- the measurements are in `stepPlan`, which they justify. The bar
   * below is set where stepping clears it on all three engines and a single
   * pass fails it on two of them.
   */
  it('stays close to the average of the pixels it covers, on every engine', () => {
    const source = diagonals(1600)

    const error = meanAbsoluteError(
      values(renderPlan(source, stepPlan({ width: 1600, height: 1600 }, { width: 200, height: 200 }))),
      areaAverage(source, { width: 200, height: 200 })
    )

    expect(error).toBeLessThan(20)
  })

  it('is no worse than one pass, and on some engines far better', () => {
    const source = diagonals(1600)
    const size = { width: 200, height: 200 }
    const reference = areaAverage(source, size)

    const steppedError = meanAbsoluteError(
      values(renderPlan(source, stepPlan({ width: 1600, height: 1600 }, size))),
      reference
    )
    const onePassError = meanAbsoluteError(values(drawStep(source, size)), reference)

    expect(steppedError).toBeLessThanOrEqual(onePassError + 0.5)
  })

  it('holds up at a reduction too small to halve more than once', () => {
    // 3:1 is one halving and a final pass, where there is least to gain.
    const source = diagonals(1200)
    const size = { width: 400, height: 400 }

    const error = meanAbsoluteError(
      values(renderPlan(source, stepPlan({ width: 1200, height: 1200 }, size))),
      areaAverage(source, size)
    )

    expect(error).toBeLessThan(30)
  })
})

describe('downscaling a gradient 16:1', () => {
  it('lands on the average of every pixel it covers', () => {
    const source = gradient(SOURCE)

    const error = meanAbsoluteError(values(stepped(source)), areaAverage(source, target))

    // A couple of levels out of 255, which is rounding and gamma, not detail
    // being dropped.
    expect(error).toBeLessThan(3)
  })
})

describe('cropping', () => {
  it('takes the part it was asked for and nothing else', () => {
    // The left half of the source is white, the right half black; cropping the
    // right half has to come back black.
    const source = canvasOf({ width: 400, height: 400 })
    const ctx = contextOf(source)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 200, 400)
    ctx.fillStyle = '#000000'
    ctx.fillRect(200, 0, 200, 400)

    const result = values(
      drawStep(source, { width: 50, height: 50 }, { x: 200, y: 0, width: 200, height: 400 })
    )

    expect(Math.max(...result)).toBe(0)
  })
})

describe('what toBlob actually encodes', () => {
  async function magic(blob: Blob): Promise<number[]> {
    return [...new Uint8Array(await blob.slice(0, 12).arrayBuffer())]
  }

  const png = [0x89, 0x50, 0x4e, 0x47]
  const jpeg = [0xff, 0xd8, 0xff]

  it('writes a real PNG, JPEG and WebP', async () => {
    const canvas = gradient(64)

    expect(await magic(await toBlob(canvas, 'image/png'))).toEqual(expect.arrayContaining(png))
    expect((await magic(await toBlob(canvas, 'image/jpeg', 0.8))).slice(0, 3)).toEqual(jpeg)

    const webp = await toBlob(canvas, 'image/webp', 0.8)
    const bytes = await magic(webp)
    // "RIFF" .... "WEBP"
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WEBP')
  })

  it('hands back a PNG for a format it cannot encode', async () => {
    // The browser behaviour `outputMime` is built around, confirmed for real.
    const blob = await toBlob(gradient(64), 'image/gif')

    expect(blob.type).not.toBe('image/gif')
    expect((await magic(blob)).slice(0, 4)).toEqual(png)
  })
})

describe('decode', () => {
  it('reads a real encoded image back to its size', async () => {
    const blob = await toBlob(gradient(120), 'image/png')

    const bitmap = await decode(blob)

    expect([bitmap.width, bitmap.height]).toEqual([120, 120])
  })
})
