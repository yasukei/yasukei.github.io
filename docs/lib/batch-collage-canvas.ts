import { CanvasUnavailableError, createCanvas, decode, release, toBlob } from './canvas-resize'
import { collageCell, collageSize, validateBatchCollage, type BatchCollageOptions } from './batch-collage'
import type { Size } from './image-resize'

export interface RenderedCollage {
  blob: Blob
  size: Size
}

function checkCancelled(cancelled: () => boolean) {
  if (cancelled()) throw new DOMException('中止しました。', 'AbortError')
}

async function decodeSource(file: File): Promise<ImageBitmap> {
  try {
    return await decode(file)
  } catch {
    throw new Error(`${file.name} を読み込めませんでした。`)
  }
}

/** Draw the rotated, staggered text directly; avoid a second diagonal-sized canvas. */
export function drawCollageWatermark(ctx: CanvasRenderingContext2D, size: Size, text: string) {
  if (!text) return
  const fontSize = Math.max(12, Math.floor(size.height * 0.03))
  ctx.save()
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1960784314)'
  ctx.textBaseline = 'top'
  const metrics = ctx.measureText(text)
  const stepX = Math.max(100, Math.floor(metrics.width * 2.5))
  const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || fontSize
  const stepY = Math.max(80, Math.floor(textHeight * 4))
  const diagonal = Math.ceil(Math.hypot(size.width, size.height)) + 100
  ctx.translate(size.width / 2, size.height / 2)
  ctx.rotate(-Math.PI / 4)
  for (let row = 0, y = -diagonal / 2; y < diagonal / 2; row++, y += stepY) {
    const offset = row % 2 * Math.floor(stepX / 2)
    for (let x = -diagonal / 2 - stepX; x < diagonal / 2; x += stepX) {
      ctx.fillText(text, x + offset, y)
    }
  }
  ctx.restore()
}

export async function renderBatchCollage(
  files: File[], options: BatchCollageOptions, cancelled = () => false
): Promise<RenderedCollage> {
  checkCancelled(cancelled)
  validateBatchCollage(options)
  if (files.length !== options.rows * options.columns) throw new Error('行数 × 列数と画像数が一致しません。')
  // Automatic sizing needs a measurement pass. With both dimensions specified,
  // decode each source only once. Both paths hold just one source at a time.
  const measureSources = options.width === undefined || options.height === undefined
  const sources: Size[] = []
  if (measureSources) {
    for (const file of files) {
      checkCancelled(cancelled)
      let bitmap: ImageBitmap | null = null
      try {
        bitmap = await decodeSource(file)
        sources.push({ width: bitmap.width, height: bitmap.height })
      } finally { release(bitmap) }
    }
  }
  checkCancelled(cancelled)
  const size = collageSize(measureSources ? sources : null, options)
  const canvas = createCanvas(size)
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new CanvasUnavailableError()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    for (let i = 0; i < files.length; i++) {
      checkCancelled(cancelled)
      let bitmap: ImageBitmap | null = null
      try {
        bitmap = await decodeSource(files[i])
        checkCancelled(cancelled)
        const cell = collageCell(size, options.rows, options.columns, i)
        ctx.drawImage(bitmap, cell.x, cell.y, cell.width, cell.height)
      } finally { release(bitmap) }
    }
    if (options.watermark !== undefined) drawCollageWatermark(ctx, size, options.watermark)
    checkCancelled(cancelled)
    const blob = await toBlob(canvas, 'image/jpeg', 0.9)
    checkCancelled(cancelled)
    return { blob, size }
  } finally {
    canvas.width = canvas.height = 0
  }
}
