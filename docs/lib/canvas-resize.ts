/**
 * The canvas half of the image resizer: decode, draw, encode.
 *
 * It is separated from the component so the pipeline can be tested at all.
 * happy-dom gives a canvas element whose `getContext('2d')` returns null, so
 * the tests stub the context and watch the calls this module makes -- which is
 * enough to check the thing worth checking, that the image is drawn through
 * every step of the plan rather than resampled once.
 *
 * The plan itself comes from `stepPlan` in ./image-resize.
 */

import type { Size } from './image-resize'

export class CanvasUnavailableError extends Error {
  constructor() {
    super('This browser would not give us a 2D canvas to draw on.')
    this.name = 'CanvasUnavailableError'
  }
}

export class EncodeFailedError extends Error {
  constructor(mime: string) {
    super(`The browser could not encode the result as ${mime}.`)
    this.name = 'EncodeFailedError'
  }
}

/**
 * Decodes a file into a bitmap, honouring the EXIF orientation so a photo
 * taken sideways is drawn the way it is displayed everywhere else.
 *
 * `imageOrientation` is the part that might not be supported, and a browser
 * that does not know the option rejects the whole call -- hence the retry,
 * which decodes correctly for everything except a rotated JPEG.
 */
export async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return await createImageBitmap(file)
  }
}

export function createCanvas(size: Size): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  return canvas
}

/** One resampling pass onto a canvas of exactly `size`. */
export function drawStep(source: CanvasImageSource, size: Size): HTMLCanvasElement {
  const canvas = createCanvas(size)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new CanvasUnavailableError()

  // The default is already 'low' in some browsers; downscaling is exactly the
  // case where the difference shows.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, size.width, size.height)
  return canvas
}

/**
 * Draws through every size in `plan`, each step feeding the next, and returns
 * the final canvas. Intermediate canvases are dropped as they are passed.
 */
export function renderPlan(source: CanvasImageSource, plan: readonly Size[]): HTMLCanvasElement {
  if (plan.length === 0) throw new Error('Nothing to draw: the plan is empty.')

  let current: HTMLCanvasElement | null = null
  for (const size of plan) {
    current = drawStep(current ?? source, size)
  }
  return current as HTMLCanvasElement
}

export function toBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // null means the browser refused the encode outright; a type it has no
        // encoder for comes back as a PNG instead, which is why the caller
        // settles the output type before getting here.
        if (blob) resolve(blob)
        else reject(new EncodeFailedError(mime))
      },
      mime,
      quality
    )
  })
}

/** Frees a decoded bitmap, on browsers old enough to lack `close`. */
export function release(bitmap: ImageBitmap | null | undefined): void {
  bitmap?.close?.()
}
