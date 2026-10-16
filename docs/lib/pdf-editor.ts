import { PDFDocument, PDFName, PDFObjectCopier, PDFPage, PDFPageLeaf } from 'pdf-lib'
import { zipSync } from 'fflate'
import type { PdfPageRef } from './pdf-selection'

// Copy page content, geometry and transparency only. Annotation/action graphs
// can reference other pages (Dest, GoTo, P, Parent/Kids) and pull their complete
// contents into an extraction, even though viewers don't display those pages.
const PAGE_CONTENT_KEYS = new Set([
  'Type', 'Contents', 'Resources', 'MediaBox', 'CropBox', 'BleedBox', 'TrimBox',
  'ArtBox', 'Rotate', 'UserUnit', 'Group'
])

function contentOnlyPage(page: PDFPage): PDFPageLeaf {
  // Clone before filtering so that exporting never changes the source PDF.
  const leaf = page.node.clone()
  for (const key of PDFPageLeaf.InheritableEntries) {
    const name = PDFName.of(key)
    const inherited = leaf.getInheritableAttribute(name)
    if (inherited) leaf.set(name, inherited)
  }
  for (const key of leaf.keys()) {
    if (!PAGE_CONTENT_KEYS.has(key.decodeText())) leaf.delete(key)
  }
  return leaf
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
    await source.flush()
    // One copier per source still shares fonts/images across selected pages.
    // Filter BEFORE copying: deleting annotations afterwards leaves objects in
    // the destination context, and pdf-lib serializes those hidden pages too.
    const copier = PDFObjectCopier.for(source.context, result.context)
    for (const [index, pageIndex] of group.indexes.entries()) {
      const leaf = copier.copy(contentOnlyPage(source.getPage(pageIndex)))
      const ref = result.context.register(leaf)
      ordered[group.positions[index]] = PDFPage.of(leaf, ref, result)
    }
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
