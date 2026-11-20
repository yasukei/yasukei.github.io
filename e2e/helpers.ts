import { readFile } from 'node:fs/promises'
import type { Download, Page } from '@playwright/test'

export async function mockDisplayMedia(page: Page, mode: 'stream' | 'cancel' = 'stream'): Promise<void> {
  const recordedFrame = mode === 'stream' && page.context().browser()?.browserType().name() === 'webkit'
    ? `data:video/webm;base64,${(await readFile(new URL('../test/fixtures/pose-source.webm', import.meta.url))).toString('base64')}`
    : undefined
  await page.addInitScript(({ mode, recordedFrame }) => {
    // Headless WebKit does not reliably play canvas streams. Use the same red
    // frame as a video fixture while keeping the track for the stop assertions.
    if (recordedFrame) {
      const srcObject = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject')!
      Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
        get: srcObject.get,
        set(this: HTMLVideoElement, stream: MediaProvider | null) {
          if (this.getAttribute('aria-label') !== '共有映像') {
            srcObject.set!.call(this, stream)
          } else if (stream) {
            this.src = recordedFrame
            this.loop = true
          } else {
            this.removeAttribute('src')
            this.load()
          }
        }
      })
    }
    // WebKit can recreate the navigator.mediaDevices wrapper between calls.
    Object.defineProperty(MediaDevices.prototype, 'getDisplayMedia', { value: async () => {
      if (mode === 'cancel') throw new DOMException('Cancelled', 'NotAllowedError')
      const source = document.createElement('canvas')
      source.width = 640
      source.height = 360
      const context = source.getContext('2d')!
      context.fillStyle = '#ff0000'
      context.fillRect(0, 0, 640, 360)
      const stream = source.captureStream(30)
      const state = window as typeof window & { captureTrack?: MediaStreamTrack }
      state.captureTrack = stream.getVideoTracks()[0]
      return stream
    } })
  }, { mode, recordedFrame })
}

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

/**
 * An ASCII STL of a box with one corner at the origin: twelve triangles, so a
 * viewer's counts and size can be checked without a fixture file.
 */
export function boxStl(name: string, x: number, y: number, z: number): ImageFile {
  const corner = (i: number) => [i & 1 ? x : 0, i & 2 ? y : 0, i & 4 ? z : 0]
  // Two triangles per face, wound counter-clockwise seen from outside.
  const faces = [
    [0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]
  ]
  const facet = (a: number, b: number, c: number) =>
    ['facet normal 0 0 0', 'outer loop', ...[a, b, c].map((i) => `vertex ${corner(i).join(' ')}`), 'endloop', 'endfacet']
  const lines = faces.flatMap(([a, b, c, d]) => [...facet(a, b, c), ...facet(a, c, d)])
  const text = ['solid box', ...lines, 'endsolid box'].join('\n')
  return { name, mimeType: 'model/stl', buffer: Buffer.from(text) }
}
