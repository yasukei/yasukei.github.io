import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

// Vite emits these dependencies on our own site, including CMaps for Japanese
// PDFs. Resolve hashed asset URLs instead of depending on a third-party CDN.
const assets = import.meta.glob<string>(
  '../../node_modules/pdfjs-dist/{cmaps,standard_fonts,wasm}/*.{bcmap,pfb,ttf,wasm}',
  { eager: true, query: '?url', import: 'default' }
)
const directories: Record<string, string> = {
  cMapUrl: 'cmaps', standardFontDataUrl: 'standard_fonts', wasmUrl: 'wasm'
}

class LocalBinaryDataFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const url = assets[`../../node_modules/pdfjs-dist/${directories[kind]}/${filename}`]
    if (!url) throw new Error(`PDF表示用データが見つかりません: ${filename}`)
    const response = await fetch(url)
    if (!response.ok) throw new Error('PDF表示用データを読み込めませんでした。')
    return new Uint8Array(await response.arrayBuffer())
  }
}

export function openPdfPreview(bytes: Uint8Array) {
  // PDF.js transfers the buffer to its worker; keep pdf-lib's input independent.
  const task = getDocument({
    data: bytes.slice(),
    BinaryDataFactory: LocalBinaryDataFactory,
    useWorkerFetch: false,
    maxImageSize: 16_000_000,
    canvasMaxAreaInBytes: 16_000_000
  })
  return {
    destroy: () => task.destroy(),
    async thumbnail(pageIndex: number): Promise<string> {
      const pdf = await task.promise
      const page = await pdf.getPage(pageIndex + 1)
      const natural = page.getViewport({ scale: 1 })
      const scale = Math.min(240 / natural.width, 320 / natural.height)
      if (!Number.isFinite(scale) || scale <= 0) throw new Error('ページサイズが不正です。')
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(viewport.width))
      canvas.height = Math.max(1, Math.ceil(viewport.height))
      try {
        await page.render({ canvas, viewport }).promise
        return canvas.toDataURL('image/png')
      } finally {
        page.cleanup()
        canvas.width = canvas.height = 0
      }
    }
  }
}
