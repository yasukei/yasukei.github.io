import { describe, expect, it } from 'vitest'
import { degrees, PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import { unzipSync } from 'fflate'
import { exportPdf, splitPdf } from './pdf-editor'
import { parsePageSelection } from './pdf-selection'

async function fixtures() {
  const first = await PDFDocument.create()
  first.addPage([200, 300]).drawText('First page')
  first.addPage([400, 500]).setRotation(degrees(90))
  const second = await PDFDocument.create()
  second.addPage([600, 700]).drawText('Other PDF')
  return new Map([[1, first], [2, second]])
}

async function linkedPages() {
  const source = await PDFDocument.create()
  const pages = Array.from({ length: 3 }, () => source.addPage([200, 300]))
  const markers = ['VISIBLE_COVER', 'PRIVATE_SECOND_PAGE', 'PRIVATE_THIRD_PAGE']
  pages.forEach((page, index) => {
    page.node.set(PDFName.of('Contents'), source.context.register(source.context.stream(`%${markers[index]}\nq Q\n`)))
  })
  const field = source.context.register(source.context.obj({ FT: 'Tx' }))
  const widget = source.context.register(source.context.obj({ Type: 'Annot', Subtype: 'Widget', Parent: field, P: pages[0].ref, Rect: [0, 0, 10, 10] }))
  const sibling = source.context.register(source.context.obj({ Type: 'Annot', Subtype: 'Widget', Parent: field, P: pages[2].ref, Rect: [0, 0, 10, 10] }))
  source.context.lookup(field, PDFDict).set(PDFName.of('Kids'), source.context.obj([widget, sibling]))
  pages[0].node.set(PDFName.of('Annots'), source.context.obj([
    source.context.register(source.context.obj({ Type: 'Annot', Subtype: 'Link', P: pages[0].ref, Rect: [0, 0, 10, 10], Dest: [pages[1].ref, 'Fit'] })),
    source.context.register(source.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 10, 10], A: { S: 'GoTo', D: [pages[2].ref, 'Fit'] } })),
    widget
  ]))
  pages[2].node.set(PDFName.of('Annots'), source.context.obj([sibling]))
  pages[0].node.set(PDFName.of('AA'), source.context.obj({ O: { S: 'GoTo', D: [pages[2].ref, 'Fit'] } }))
  // Materialize pending content/metadata before checking source immutability.
  const original = await source.save()
  return { source, markers, original }
}

async function expectOnlyPages(bytes: Uint8Array, included: string[], excluded: string[]) {
  const output = await PDFDocument.load(bytes)
  const pageObjects = output.context.enumerateIndirectObjects().filter(([, object]) =>
    object instanceof PDFDict && object.get(PDFName.of('Type')) === PDFName.of('Page'))
  expect(output.getPageCount()).toBe(included.length)
  // A viewer's page count alone misses page objects outside the page tree.
  expect(pageObjects).toHaveLength(included.length)
  const contents = new TextDecoder().decode(bytes)
  included.forEach(marker => expect(contents).toContain(marker))
  excluded.forEach(marker => expect(contents).not.toContain(marker))
  for (const page of output.getPages()) expect(page.node.Annots()).toBeUndefined()
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
  it('does not copy unselected pages through Dest, GoTo, annotation P, form Parent/Kids or page actions', async () => {
    const { source, markers, original } = await linkedPages()
    const bytes = await exportPdf([{ sourceId: 1, pageIndex: 0 }], new Map([[1, source]]))
    await expectOnlyPages(bytes, [markers[0]], markers.slice(1))
    expect(await source.save()).toEqual(original)
    expect(source.getPage(0).node.Annots()?.size()).toBe(3)
  })

  it('keeps every split PDF free of the other pages, including linked cover pages', async () => {
    const { source, markers } = await linkedPages()
    const archive = await splitPdf(source.getPageIndices().map(pageIndex => ({ sourceId: 1, pageIndex })), new Map([[1, source]]))
    const files = Object.values(unzipSync(archive))
    expect(files).toHaveLength(3)
    for (const [index, bytes] of files.entries()) {
      await expectOnlyPages(bytes, [markers[index]], markers.filter((_, other) => other !== index))
    }
  })

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
    const fonts = output.getPage(0).node.Resources()!.lookup(PDFName.of('Font'), PDFDict)
    expect(fonts.keys().length).toBeGreaterThan(0)
    for (const [, ref] of fonts.entries()) expect(output.context.lookup(ref)).toBeDefined()
  })

  it('preserves inherited resources, page boxes and rotation when removing the parent page tree', async () => {
    const source = await PDFDocument.create()
    const page = source.addPage([400, 500])
    page.drawText('Inherited font')
    await source.flush()
    const parent = page.node.Parent()!
    parent.set(PDFName.of('Resources'), page.node.Resources()!)
    parent.set(PDFName.of('MediaBox'), source.context.obj([0, 0, 400, 500]))
    parent.set(PDFName.of('CropBox'), source.context.obj([10, 20, 300, 450]))
    parent.set(PDFName.of('Rotate'), source.context.obj(90))
    for (const key of ['Resources', 'MediaBox', 'CropBox', 'Rotate']) page.node.delete(PDFName.of(key))
    page.node.set(PDFName.of('UserUnit'), source.context.obj(2))
    const output = await PDFDocument.load(await exportPdf([{ sourceId: 1, pageIndex: 0 }], new Map([[1, source]])))
    const copied = output.getPage(0)
    expect(copied.getSize()).toEqual({ width: 400, height: 500 })
    expect(copied.getCropBox()).toEqual({ x: 10, y: 20, width: 290, height: 430 })
    expect(copied.getRotation().angle).toBe(90)
    expect(copied.node.Resources()!.lookup(PDFName.of('Font'), PDFDict).keys()).not.toHaveLength(0)
    expect(copied.node.get(PDFName.of('UserUnit'))!.toString()).toBe('2')
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
