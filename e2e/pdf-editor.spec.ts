import { test, expect, type Download } from '@playwright/test'
import { PDFDocument, rgb } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

async function pdfFile(name: string, widths: number[]) {
  const pdf = await PDFDocument.create()
  for (const [index, width] of widths.entries()) {
    const page = pdf.addPage([width, 400])
    page.drawRectangle({ x: 0, y: 0, width, height: 400, color: rgb(index ? 0 : 1, index ? 1 : 0, 0) })
    page.drawText(`${name} page ${index + 1}`, { x: 15, y: 200, size: 16 })
  }
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) }
}

async function downloadedBytes(download: Download) {
  const path = await download.path()
  expect(path).not.toBeNull()
  return readFile(path!)
}

test('previews, reorders, merges, extracts and splits PDFs entirely on the site', async ({ page }) => {
  const external: string[] = []
  page.on('request', request => {
    if (!new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) external.push(request.url())
  })
  await page.goto('/tools/pdf-editor')
  await expect(page.getByLabel('PDFを追加', { exact: true })).toBeEnabled()
  await page.getByLabel('PDFを追加', { exact: true }).setInputFiles([
    await pdfFile('first.pdf', [200, 222]), await pdfFile('second.pdf', [333])
  ])
  await expect(page.locator('.pdf-editor')).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('.pdf-thumbnail img')).toHaveCount(3)
  for (const image of await page.locator('.pdf-thumbnail img').all()) {
    expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  }
  const cards = page.locator('.pdf-page')
  await cards.nth(2).dragTo(cards.nth(0))
  await expect(page.locator('.pdf-filename').first()).toHaveText('second.pdf')
  await page.getByLabel('2番目のページを選択', { exact: true }).uncheck()
  const mergedDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '選択ページをPDF保存', exact: true }).click()
  const merged = await PDFDocument.load(await downloadedBytes(await mergedDownload))
  expect(merged.getPages().map(item => item.getWidth())).toEqual([333, 222])

  await page.getByLabel('現在の並び順で選択', { exact: true }).fill('2-3')
  await page.getByRole('button', { name: 'ページ指定を適用' }).click()
  const splitDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '1ページずつ分割してZIP保存' }).click()
  const zip = unzipSync(await downloadedBytes(await splitDownload))
  expect(Object.keys(zip)).toEqual(['page-001.pdf', 'page-002.pdf'])
  expect((await PDFDocument.load(zip['page-001.pdf'])).getPage(0).getWidth()).toBe(200)
  expect((await PDFDocument.load(zip['page-002.pdf'])).getPage(0).getWidth()).toBe(222)

  await page.getByLabel('現在の並び順で選択', { exact: true }).fill('3')
  await page.getByRole('button', { name: 'ページ指定を適用' }).click()
  const extractedDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '選択ページをPDF保存', exact: true }).click()
  const extracted = await PDFDocument.load(await downloadedBytes(await extractedDownload))
  expect(extracted.getPageCount()).toBe(1)
  expect(extracted.getPage(0).getWidth()).toBe(222)
  expect(external).toEqual([])
})

test('rejects invalid files and supports keyboard page movement and narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tools/pdf-editor')
  await expect(page.getByLabel('PDFを追加', { exact: true })).toBeEnabled()
  const protectedPdf = await PDFDocument.create()
  protectedPdf.addPage()
  protectedPdf.context.trailerInfo.Encrypt = protectedPdf.context.register(protectedPdf.context.obj({ Filter: 'Standard' }))
  await page.getByLabel('PDFを追加', { exact: true }).setInputFiles([
    { name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('broken') },
    { name: 'protected.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await protectedPdf.save()) },
    await pdfFile('good.pdf', [200, 222])
  ])
  await expect(page.getByRole('alert')).toContainText('bad.pdf')
  await expect(page.getByRole('alert')).toContainText('パスワード付きPDFには対応していません')
  await expect(page.locator('.pdf-thumbnail img')).toHaveCount(2)
  const previous = page.getByRole('button', { name: '2番目のページを前へ', exact: true })
  await previous.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.pdf-original-page').first()).toHaveText('元の 2 ページ目')
  await page.getByRole('button', { name: '選択解除', exact: true }).click()
  await expect(page.getByRole('button', { name: '選択ページをPDF保存', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
