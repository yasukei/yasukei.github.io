// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { PDFDocument, PDFName, PDFNumber } from 'pdf-lib'
import PdfEditor from './PdfEditor.vue'
import { MAX_PDF_BYTES, MAX_PDF_PAGES } from '../lib/pdf-selection'

const preview = vi.hoisted(() => ({
  thumbnail: vi.fn<() => Promise<string>>(), destroy: vi.fn<() => Promise<void>>()
}))
vi.mock('../lib/pdf-preview', () => ({ openPdfPreview: () => preview }))

async function file(name = 'input.pdf', count = 2) {
  const pdf = await PDFDocument.create()
  for (let index = 0; index < count; index++) pdf.addPage([200 + index, 300])
  return new File([new Uint8Array(await pdf.save()).buffer], name, { type: 'application/pdf' })
}

const wrappers: ReturnType<typeof mount>[] = []
function editor() {
  const wrapper = mount(PdfEditor)
  wrappers.push(wrapper)
  return wrapper
}

async function add(wrapper: ReturnType<typeof editor>, files: File[]) {
  await wrapper.get('.pdf-upload').trigger('drop', { dataTransfer: { files } })
  await vi.waitFor(() => expect(wrapper.attributes('aria-busy')).toBe('false'))
  await flushPromises()
}

beforeEach(() => {
  preview.thumbnail.mockReset().mockResolvedValue('data:image/png;base64,test')
  preview.destroy.mockReset().mockResolvedValue()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('PDF editor', () => {
  it('adds multiple sources, reorders, selects ranges and removes pages', async () => {
    const wrapper = editor()
    await add(wrapper, [await file('a.pdf'), await file('b.pdf', 1)])
    expect(wrapper.findAll('.pdf-page')).toHaveLength(3)
    expect(wrapper.findAll('.pdf-thumbnail img')).toHaveLength(3)
    await wrapper.get('[aria-label="3番目のページを前へ"]').trigger('click')
    expect(wrapper.findAll('.pdf-filename').map(node => node.text())).toEqual(['a.pdf', 'b.pdf', 'a.pdf'])
    await wrapper.get('#pdf-range').setValue('1,3')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]').map(node => node.element.checked)).toEqual([true, false, true])
    await wrapper.get('#pdf-range').setValue('99')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('1〜3')
    expect(wrapper.get('[data-testid="pdf-count"]').text()).toContain('2ページ選択')
    await wrapper.get('[aria-label="2番目のページを削除"]').trigger('click')
    expect(wrapper.findAll('.pdf-page')).toHaveLength(2)
  })

  it('reports malformed files while accepting the remaining valid PDF', async () => {
    const wrapper = editor()
    await add(wrapper, [new File(['broken'], 'bad.pdf'), await file()])
    expect(wrapper.get('[role="alert"]').text()).toContain('bad.pdf')
    expect(wrapper.findAll('.pdf-page')).toHaveLength(2)
  })

  it('reports a corrupt page tree and continues to the next file', async () => {
    const corrupt = await PDFDocument.create()
    corrupt.catalog.set(PDFName.of('Pages'), PDFNumber.of(123))
    const bytes = await corrupt.save({ addDefaultPage: false, updateFieldAppearances: false })
    const wrapper = editor()
    await add(wrapper, [new File([new Uint8Array(bytes).buffer], 'corrupt.pdf'), await file()])
    expect(wrapper.get('[role="alert"]').text()).toContain('corrupt.pdf')
    expect(wrapper.findAll('.pdf-page')).toHaveLength(2)
  })

  it('rejects password-protected documents without attempting previews', async () => {
    const encrypted = await PDFDocument.create()
    encrypted.addPage()
    encrypted.context.trailerInfo.Encrypt = encrypted.context.register(encrypted.context.obj({ Filter: 'Standard' }))
    const bytes = await encrypted.save()
    const wrapper = editor()
    await add(wrapper, [new File([new Uint8Array(bytes).buffer], 'protected.pdf')])
    expect(wrapper.get('[role="alert"]').text()).toContain('保護（暗号化）されたPDF')
    expect(preview.thumbnail).not.toHaveBeenCalled()
    expect(wrapper.findAll('.pdf-page')).toHaveLength(0)
  })

  it('enforces byte and page limits and releases source capacity after removal', async () => {
    const large = await file('large.pdf', 1)
    const second = await file('second.pdf', 1)
    for (const item of [large, second]) Object.defineProperty(item, 'size', { value: Math.ceil(MAX_PDF_BYTES * 0.6) })
    const wrapper = editor()
    await add(wrapper, [large, second])
    expect(wrapper.get('[role="alert"]').text()).toContain('100MB')
    expect(wrapper.findAll('.pdf-page')).toHaveLength(1)
    await wrapper.get('[aria-label="1番目のページを削除"]').trigger('click')
    await add(wrapper, [second])
    expect(wrapper.findAll('.pdf-page')).toHaveLength(1)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await add(wrapper, [await file('too-many.pdf', MAX_PDF_PAGES + 1)])
    expect(wrapper.get('[role="alert"]').text()).toContain('300ページ')
    expect(wrapper.findAll('.pdf-page')).toHaveLength(1)
  })

  it('still allows export when thumbnails cannot be rendered and cleans up downloads', async () => {
    preview.thumbnail.mockRejectedValue(new Error('cannot render'))
    const wrapper = editor()
    await add(wrapper, [await file()])
    expect(wrapper.get('[role="alert"]').text()).toContain('プレビューを表示できませんでした。')
    expect(wrapper.get('[role="alert"]').text()).not.toContain('一部')
    expect(preview.destroy).toHaveBeenCalled()
    await wrapper.get('.pdf-primary').trigger('click')
    await vi.waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled())
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    wrapper.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-test')
    wrappers.splice(wrappers.indexOf(wrapper), 1)
  })

  it('distinguishes partial preview failures from total failures', async () => {
    preview.thumbnail.mockRejectedValueOnce(new Error('one page failed'))
    const wrapper = editor()
    await add(wrapper, [await file()])
    expect(wrapper.findAll('.pdf-thumbnail img')).toHaveLength(1)
    expect(wrapper.get('[role="alert"]').text()).toContain('一部のプレビュー')
  })

  it('disables export when no pages are selected and clears all source state', async () => {
    const wrapper = editor()
    await add(wrapper, [await file()])
    await wrapper.findAll('button').find(button => button.text() === '選択解除')!.trigger('click')
    expect(wrapper.get('.pdf-primary').attributes('disabled')).toBeDefined()
    await wrapper.findAll('button').find(button => button.text() === 'すべてクリア')!.trigger('click')
    expect(wrapper.findAll('.pdf-page')).toHaveLength(0)
    await add(wrapper, [await file()])
    expect(wrapper.get('[data-testid="pdf-count"]').text()).toBe('2ページ中 2ページ選択')
  })
})
