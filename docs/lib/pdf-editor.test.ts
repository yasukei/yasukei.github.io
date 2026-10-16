import { describe, expect, it } from 'vitest'
import { degrees, PDFDocument, PDFName } from 'pdf-lib'
import { unzipSync } from 'fflate'
import { exportPdf, parsePageSelection, splitPdf } from './pdf-editor'

async function fixtures() {
  const first = await PDFDocument.create()
  first.addPage([200, 300]).drawText('First page')
  first.addPage([400, 500]).setRotation(degrees(90))
  const second = await PDFDocument.create()
  second.addPage([600, 700]).drawText('Other PDF')
  return new Map([[1, first], [2, second]])
}

describe('PDF page selection', () => {
  it('accepts ranges, spaces and overlaps without duplicating pages', () => {
    expect([...parsePageSelection(' 1-3, 2, 5 ', 5)]).toEqual([0, 1, 2, 4])
  })

  it.each(['', '0', '6', '3-2', '1-6', '-1', '1.5', '1,', '1,,2', '1e2', '9007199254740993'])('rejects invalid range %j', value => {
    expect(() => parsePageSelection(value, 5)).toThrow()
  })
})

describe('PDF export', () => {
  it('merges and extracts pages in the requested order, preserving size and rotation', async () => {
    const bytes = await exportPdf([
      { sourceId: 2, pageIndex: 0 },
      { sourceId: 1, pageIndex: 1 },
      { sourceId: 1, pageIndex: 0 }
    ], await fixtures())
    const output = await PDFDocument.load(bytes)
    expect(output.getPages().map(page => page.getSize())).toEqual([
      { width: 600, height: 700 }, { width: 400, height: 500 }, { width: 200, height: 300 }
    ])
    expect(output.getPage(1).getRotation().angle).toBe(90)
    expect(output.getPage(0).node.Contents()).toBeDefined()
  })

  it('creates a valid archive of independent one-page PDFs', async () => {
    const bytes = await splitPdf([{ sourceId: 1, pageIndex: 1 }, { sourceId: 2, pageIndex: 0 }], await fixtures())
    const files = unzipSync(bytes)
    expect(Object.keys(files)).toEqual(['page-001.pdf', 'page-002.pdf'])
    for (const [index, data] of Object.values(files).entries()) {
      const pdf = await PDFDocument.load(data)
      expect(pdf.getPageCount()).toBe(1)
      expect(pdf.getPage(0).getWidth()).toBe(index === 0 ? 400 : 600)
    }
  })

  it('copies shared resources once even when source pages are interleaved', async () => {
    const source = await PDFDocument.create()
    const shared = source.context.register(source.context.stream(`%${'shared page content '.repeat(2000)}\nq Q\n`))
    for (let index = 0; index < 12; index++) {
      source.addPage([200 + index, 300]).node.set(PDFName.of('Contents'), shared)
    }
    const other = await PDFDocument.create()
    other.addPage([999, 300])
    const sources = new Map([[1, source], [2, other]])
    const pages = source.getPageIndices().map(pageIndex => ({ sourceId: 1, pageIndex }))
    pages.splice(1, 0, { sourceId: 2, pageIndex: 0 })
    const bytes = await exportPdf(pages, sources)
    const output = await PDFDocument.load(bytes)
    expect(output.getPages().map(page => page.getWidth())).toEqual([200, 999, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211])
    const references = output.getPages().filter(page => page.getWidth() !== 999)
      .map(page => page.node.get(PDFName.of('Contents'))!.toString())
    expect(new Set(references).size).toBe(1)
    expect(bytes.length).toBeLessThan((await source.save()).length * 2)
  })

  it('rejects empty exports and missing source pages', async () => {
    const sources = await fixtures()
    await expect(exportPdf([], sources)).rejects.toThrow('選択')
    await expect(splitPdf([], sources)).rejects.toThrow('選択')
    await expect(exportPdf([{ sourceId: 3, pageIndex: 0 }], sources)).rejects.toThrow('見つかりません')
    await expect(exportPdf([{ sourceId: 1, pageIndex: -1 }], sources)).rejects.toThrow('見つかりません')
    await expect(exportPdf([{ sourceId: 1, pageIndex: 2 }], sources)).rejects.toThrow('見つかりません')
  })
})
