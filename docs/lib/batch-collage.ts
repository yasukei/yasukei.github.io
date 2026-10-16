import { exceedsCanvasLimit, type Size } from './image-resize'
import type { Rect } from './collage-layout'

export interface BatchCollageOptions {
  rows: number
  columns: number
  count: number
  width?: number
  height?: number
  watermark?: string
}

export interface CollageJob {
  path: string
  output: string
  files: File[]
}

export function validateBatchCollage(options: BatchCollageOptions): number {
  for (const [label, value] of [
    ['行数', options.rows], ['列数', options.columns], ['生成枚数', options.count],
    ['幅', options.width], ['高さ', options.height]
  ] as const) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
      throw new Error(`${label}には 1 以上の整数を指定してください。`)
    }
  }
  const needed = options.rows * options.columns * options.count
  if (!Number.isSafeInteger(needed)) throw new Error('必要な画像数が大きすぎます。')
  if (options.count > 65_535) throw new Error('一度に生成する枚数は 65,535 枚以内にしてください。')
  if ((options.width !== undefined && options.width > 16_384) ||
      (options.height !== undefined && options.height > 16_384)) {
    throw new Error('出力画像の一辺は 16,384 px 以内にしてください。')
  }
  return needed
}

/** Like Path.iterdir(), folder input includes only files directly under the chosen folder. */
export function collageSources(files: readonly File[]): File[] {
  return files.filter(file => /\.jpe?g$/i.test(file.name) &&
    (!file.webkitRelativePath || file.webkitRelativePath.split('/').length === 2))
}

export function planCollages(
  files: readonly File[], options: BatchCollageOptions, random = Math.random
): CollageJob[] {
  const needed = validateBatchCollage(options)
  const candidates = collageSources(files)
  if (candidates.length < needed) {
    throw new Error(`画像が不足しています。必要: ${needed} 枚、選択済み: ${candidates.length} 枚（JPG / JPEG）。`)
  }
  // Shuffle a copy once for the entire batch so no file can appear in two outputs.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }
  const perCollage = options.rows * options.columns
  return Array.from({ length: options.count }, (_, i) => {
    const output = `collage-${String(i + 1).padStart(3, '0')}.jpg`
    return {
      path: output,
      output,
      files: candidates.slice(i * perCollage, (i + 1) * perCollage)
        .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    }
  })
}

export function collageSize(sources: readonly Size[], options: BatchCollageOptions): Size {
  validateBatchCollage(options)
  if (sources.length !== options.rows * options.columns) throw new Error('行数 × 列数と画像数が一致しません。')
  const defaultWidth = Math.floor(sources.reduce((sum, size) => sum + size.width, 0) / sources.length) * options.columns
  const defaultHeight = Math.floor(sources.reduce((sum, size) => sum + size.height, 0) / sources.length) * options.rows
  const width = options.width ?? (options.height === undefined ? defaultWidth : Math.floor(defaultWidth * options.height / defaultHeight))
  const height = options.height ?? (options.width === undefined ? defaultHeight : Math.floor(defaultHeight * options.width / defaultWidth))
  const size = { width, height }
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < options.columns || height < options.rows) {
    throw new Error('出力サイズが小さすぎます。各セルが 1 px 以上になる幅・高さを指定してください。')
  }
  if (width > 16_384 || height > 16_384 || exceedsCanvasLimit(size)) {
    throw new Error('出力画像が大きすぎます。幅・高さを小さくしてください（最大 16,777,216 画素・一辺 16,384 px）。')
  }
  return size
}

/** Integer boundaries share edges even when the dimensions do not divide evenly. */
export function collageCell(size: Size, rows: number, columns: number, index: number): Rect {
  const column = index % columns
  const row = Math.floor(index / columns)
  const x = Math.floor(column * size.width / columns)
  const y = Math.floor(row * size.height / rows)
  return {
    x, y,
    width: Math.floor((column + 1) * size.width / columns) - x,
    height: Math.floor((row + 1) * size.height / rows) - y
  }
}
