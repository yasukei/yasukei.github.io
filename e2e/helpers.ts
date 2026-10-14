import { readFile } from 'node:fs/promises'
import type { Download, Page } from '@playwright/test'

export interface ImageFile {
  name: string
  mimeType: string
  buffer: Buffer
}

/**
 * A PNG of the given size, drawn by the page's own canvas so the tests need no
 * fixture files. Two colours rather than one, so a resampler that drops the
 * image entirely still has something to get wrong.
 */
export async function pngOf(page: Page, name: string, width: number, height: number): Promise<ImageFile> {
  const base64 = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      ctx.fillStyle = '#3366cc'
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = '#ffcc00'
      ctx.fillRect(0, 0, width / 2, height / 2)
      return canvas.toDataURL('image/png').split(',')[1]
    },
    { width, height }
  )
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * The size written in a downloaded PNG's header, or null if the file is not a
 * PNG at all. Width and height are the first two fields of IHDR, which the
 * format requires to come first.
 */
export async function pngSizeOf(download: Download): Promise<{ width: number; height: number } | null> {
  const bytes = await readFile(await download.path())
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}
