import { Zip, ZipPassThrough } from 'fflate'
import { encodeImage, type ConversionItem, type ImageFormat } from './batch-image-convert'

// ZIP downloads retain the encoded images in memory until the user saves them.
// Keep both memory use and classic ZIP (without ZIP64) bounds explicit.
export const MAX_ZIP_BYTES = 256 * 1024 * 1024
const MAX_ZIP_FILES = 65_535

export async function convertToZip(
  items: ConversionItem[],
  format: ImageFormat,
  quality: number,
  options: { cancelled: () => boolean; converted: (item: ConversionItem) => void },
  encode = encodeImage
): Promise<Blob | null> {
  if (items.length > MAX_ZIP_FILES) throw new Error('ZIP にまとめる画像は 65,535 枚以内に分けてください。')
  const parts: Blob[] = []
  let bytes = 0
  let archive: Blob | null = null
  // Pass-through entries emit synchronously; PNG/JPEG/WebP are already compressed.
  const zip = new Zip((error, data, final) => {
    if (error) throw error
    bytes += data.byteLength
    if (bytes > MAX_ZIP_BYTES) throw new Error('ZIP が 256 MiB を超えます。画像を少なくして再実行してください。')
    parts.push(new Blob([new Uint8Array(data).buffer]))
    if (final) archive = new Blob(parts, { type: 'application/zip' })
  })
  try {
    for (const item of items) {
      if (options.cancelled()) return null
      try {
        const blob = await encode(await item.handle.getFile(), format, quality)
        if (options.cancelled()) return null
        // Check before allocating an ArrayBuffer for a potentially large image.
        if (bytes + blob.size > MAX_ZIP_BYTES) throw new Error('ZIP が 256 MiB を超えます。画像を少なくして再実行してください。')
        const data = new Uint8Array(await blob.arrayBuffer())
        if (options.cancelled()) return null
        const entry = new ZipPassThrough(item.output)
        zip.add(entry)
        entry.push(data, true)
        options.converted(item)
      } catch (error) {
        throw new Error(`${item.path}: ${error instanceof Error ? error.message : '変換に失敗しました。'}`)
      }
    }
    if (options.cancelled()) return null
    zip.end()
    if (!archive) throw new Error('ZIP の作成が完了しませんでした。')
    return archive
  } finally {
    zip.terminate()
  }
}
