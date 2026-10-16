import { createCanvas, decode, release, toBlob } from './canvas-resize'
import { exceedsCanvasLimit } from './image-resize'

export const IMAGE_FORMATS = [
  { value: 'png', label: 'PNG', mime: 'image/png' },
  { value: 'jpg', label: 'JPEG', mime: 'image/jpeg' },
  { value: 'webp', label: 'WebP', mime: 'image/webp' }
] as const
export type ImageFormat = (typeof IMAGE_FORMATS)[number]['value']

// Narrow interfaces also let the filesystem workflow run against in-memory
// directories in tests. Directory iteration/picking are not in TypeScript's DOM lib.
export interface ImageFileHandle {
  kind: 'file'
  getFile(): Promise<File>
  isSameEntry(other: ImageFileHandle): Promise<boolean>
  createWritable(): Promise<{
    write(data: Blob): Promise<void>
    close(): Promise<void>
    abort(): Promise<void>
  }>
}
export interface ImageDirectory {
  kind: 'directory'
  name: string
  values(): AsyncIterable<ImageDirectory | (ImageFileHandle & { name: string })>
  resolve(other: ImageDirectory): Promise<string[] | null>
  getFileHandle(name: string, options?: { create: boolean }): Promise<ImageFileHandle>
  removeEntry(name: string): Promise<void>
}
export interface ConversionItem {
  path: string
  handle: Pick<ImageFileHandle, 'getFile'>
  output: string
}

export function validStart(value: string): boolean {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value))
}

export function numberedName(index: number, format: ImageFormat): string {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('開始番号には 0 以上の安全な整数を指定してください。')
  return `${String(index).padStart(3, '0')}.${format}`
}

export async function planConversion(
  source: ImageDirectory,
  destination: ImageDirectory,
  input: ImageFormat,
  output: ImageFormat,
  start: number
): Promise<ConversionItem[]> {
  numberedName(start, output)
  // A destination inside the source would become input on a later run.
  if (await source.resolve(destination) !== null) {
    throw new Error('dst は src と別のフォルダを選んでください。src のサブフォルダも指定できません。')
  }
  const found: { path: string; handle: ImageFileHandle }[] = []
  async function walk(directory: ImageDirectory, prefix: string) {
    for await (const entry of directory.values()) {
      if (isHiddenPath(entry.name)) continue
      const path = prefix + entry.name
      if (entry.kind === 'directory') await walk(entry, path + '/')
      else found.push({ path, handle: entry })
    }
  }
  await walk(source, '')
  const items = makePlan(found, input, output, start)
  for (const item of items) await assertAbsent(destination, item.output)
  return items
}

/** Folder inputs provide paths without needing directory write permissions. */
export function planFileConversion(
  files: readonly File[],
  input: ImageFormat,
  output: ImageFormat,
  start: number
): ConversionItem[] {
  return makePlan(files.map(file => ({
    // webkitRelativePath includes the selected root; direct picking starts below it.
    path: file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name,
    handle: { getFile: async () => file }
  })), input, output, start)
}

// AppleDouble sidecars and images under dot-directories are not source images.
function isHiddenPath(path: string): boolean {
  return path.split('/').some(part => part.startsWith('.'))
}

function makePlan(
  files: { path: string; handle: Pick<ImageFileHandle, 'getFile'> }[],
  input: ImageFormat,
  output: ImageFormat,
  start: number
): ConversionItem[] {
  numberedName(start, output)
  const extension = input === 'jpg' ? /\.jpe?g$/i : new RegExp(`\\.${input}$`, 'i')
  const found = files.filter(file => extension.test(file.path) && !isHiddenPath(file.path))
  // Numeric-aware path order, with a codepoint tiebreaker for e.g. 1 and 01.
  found.sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return found.map((item, i) => ({ ...item, output: numberedName(start + i, output) }))
}

async function assertAbsent(destination: ImageDirectory, name: string) {
  try {
    await destination.getFileHandle(name)
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') return
    // A directory with this name, lost permissions, etc. must also stop writing.
    throw error
  }
  throw new Error(`dst に ${name} が既にあります。開始番号または保存先を変更してください。`)
}

export async function encodeImage(file: File, format: ImageFormat, quality: number): Promise<Blob> {
  const bitmap = await decode(file)
  let canvas: HTMLCanvasElement | undefined
  try {
    if (exceedsCanvasLimit(bitmap)) throw new Error('画像がブラウザで変換できるサイズを超えています。')
    canvas = createCanvas(bitmap)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('画像の描画に失敗しました。')
    if (format === 'jpg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(bitmap, 0, 0)
    const mime = IMAGE_FORMATS.find(f => f.value === format)!.mime
    const blob = await toBlob(canvas, mime, quality)
    if (blob.type !== mime) throw new Error('このブラウザは選択した出力形式に対応していません。')
    return blob
  } finally {
    release(bitmap)
    if (canvas) canvas.width = canvas.height = 0
  }
}

/** Sequentially decode and write so a large folder does not retain every bitmap. */
export async function convertBatch(
  items: ConversionItem[],
  destination: ImageDirectory,
  format: ImageFormat,
  quality: number,
  options: { cancelled: () => boolean; saved: (item: ConversionItem) => void },
  encode = encodeImage
): Promise<void> {
  for (const item of items) {
    if (options.cancelled()) return
    try {
      const blob = await encode(await item.handle.getFile(), format, quality)
      if (options.cancelled()) return
      // Check again after conversion in case another run created the name.
      await assertAbsent(destination, item.output)
      const handle = await destination.getFileHandle(item.output, { create: true })
      try {
        const writable = await handle.createWritable()
        try {
          await writable.write(blob)
          await writable.close()
        } catch (error) {
          await writable.abort().catch(() => {})
          throw error
        }
      } catch (error) {
        // abort() discards the pending write, but leaves a newly created empty
        // file. Remove only our unchanged entry, so retrying does not collide
        // and an external replacement/nonempty file is preserved.
        try {
          const current = await destination.getFileHandle(item.output)
          if (await handle.isSameEntry(current) && (await current.getFile()).size === 0) {
            await destination.removeEntry(item.output)
          }
        } catch { /* Keep the original write error if cleanup is denied. */ }
        throw error
      }
      options.saved(item)
    } catch (error) {
      throw new Error(`${item.path}: ${error instanceof Error ? error.message : '変換・保存に失敗しました。'}`)
    }
  }
}
