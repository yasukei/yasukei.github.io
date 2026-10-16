import { PDFDocument, type PDFPage } from 'pdf-lib'
import { zipSync } from 'fflate'

export const MAX_PDF_BYTES = 100 * 1024 * 1024
export const MAX_PDF_PAGES = 300

export interface PdfPageRef {
  sourceId: number
  pageIndex: number
}

/** The numbers refer to the current visible order, starting at one. */
export function parsePageSelection(value: string, count: number): Set<number> {
  const selected = new Set<number>()
  if (!value.trim()) throw new Error('ページ番号を入力してください。例: 1-3, 5')
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) throw new Error('ページ指定は「1-3, 5」の形式で入力してください。')
    const first = Number(match[1])
    const last = Number(match[2] ?? match[1])
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first || last > count) {
      throw new Error(`ページ番号は1〜${count}の範囲で指定してください。`)
    }
    for (let number = first; number <= last; number++) selected.add(number - 1)
  }
  return selected
}

/** Copy page objects without rasterizing: text and vector content stay intact. */
export async function exportPdf(pages: readonly PdfPageRef[], sources: ReadonlyMap<number, PDFDocument>): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error('保存するページを選択してください。')
  const result = await PDFDocument.create()
  const grouped = new Map<number, { indexes: number[]; positions: number[] }>()
  for (const [position, page] of pages.entries()) {
    const group = grouped.get(page.sourceId) ?? { indexes: [], positions: [] }
    group.indexes.push(page.pageIndex)
    group.positions.push(position)
    grouped.set(page.sourceId, group)
  }
  const ordered: PDFPage[] = new Array(pages.length)
  for (const [sourceId, group] of grouped) {
    const source = sources.get(sourceId)
    if (!source || group.indexes.some(index => !Number.isInteger(index) || index < 0 || index >= source.getPageCount())) {
      throw new Error('元のPDFページが見つかりません。PDFを追加し直してください。')
    }
    // A single copy per source shares fonts/images across its pages. Copying
    // separately duplicates those resources and can multiply the output size.
    const copied = await result.copyPages(source, group.indexes)
    copied.forEach((page, index) => { ordered[group.positions[index]] = page })
  }
  ordered.forEach(page => result.addPage(page))
  return result.save()
}

/** One archive avoids browser restrictions on downloading many files at once. */
export async function splitPdf(pages: readonly PdfPageRef[], sources: ReadonlyMap<number, PDFDocument>): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error('分割するページを選択してください。')
  const files: Record<string, Uint8Array> = {}
  for (let index = 0; index < pages.length; index++) {
    files[`page-${String(index + 1).padStart(3, '0')}.pdf`] = await exportPdf([pages[index]], sources)
  }
  // PDFs already contain compressed streams; store them without recompressing.
  return zipSync(files, { level: 0 })
}
