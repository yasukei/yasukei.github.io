import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

async function jpeg(page: Page, name: string) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 120
    canvas.height = 80
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3366cc'
    ctx.fillRect(0, 0, 120, 80)
    return canvas.toDataURL('image/jpeg').split(',')[1]
  })
  return { name, mimeType: 'image/jpeg', buffer: Buffer.from(data, 'base64') }
}

test('generates disjoint sorted collages on a separate Tools page and downloads a JPEG ZIP', async ({ page }) => {
  await page.goto('/tools/')
  await page.getByRole('main').getByRole('link', { name: '一括コラージュメーカー', exact: true }).click()
  await expect(page).toHaveURL(/\/tools\/batch-collage(?:\.html)?$/)
  await expect(page.getByRole('link', { name: 'コラージュメーカー', exact: true }).last()).toBeVisible()
  await expect(page.getByRole('button', { name: '生成して ZIP を作成' })).toBeDisabled()
  await page.getByLabel('画像をまとめて選択').setInputFiles(await Promise.all(
    ['8.jpg', '7.jpg', '6.jpg', '5.jpg', '4.jpg', '3.jpg', '2.jpg', '1.jpg'].map(name => jpeg(page, name))
  ))
  await page.getByLabel('生成枚数', { exact: true }).fill('2')
  await page.getByLabel('幅（px・省略可）').fill('201')
  await page.getByLabel('高さ（px・省略可）').fill('151')
  await page.getByLabel('透かしを入れる').check()
  await expect(page.getByLabel('透かしの文字')).toHaveValue('Sample')
  await page.getByRole('button', { name: '生成して ZIP を作成' }).click()
  await expect(page.getByAltText('最初のコラージュのプレビュー')).toBeVisible()
  await expect(page.getByText('生成済み: 2 / 2 枚')).toBeVisible()
  await page.getByText('生成画像と使用ファイル', { exact: true }).click()
  const groups = await page.locator('.batch-collage details li').allTextContents()
  expect(groups).toHaveLength(2)
  const used = groups.map(group => group.split(': ')[1].split(', '))
  expect(new Set(used.flat()).size).toBe(8)
  for (const group of used) expect(group).toEqual([...group].sort())
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: /ZIP をダウンロード/ }).click()
  const saved = await download
  expect(saved.suggestedFilename()).toBe('collages.zip')
  const entries = unzipSync(new Uint8Array(await readFile(await saved.path())))
  expect(Object.keys(entries)).toEqual(['collage-001.jpg', 'collage-002.jpg'])
  for (const bytes of Object.values(entries)) {
    expect([...bytes.slice(0, 2)]).toEqual([0xff, 0xd8])
    const size = await page.evaluate(async bytes => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }))
      const size = [bitmap.width, bitmap.height]
      bitmap.close()
      return size
    }, [...bytes])
    expect(size).toEqual([201, 151])
  }
  // Changing settings invalidates the previous selection and download.
  await page.getByLabel('列数', { exact: true }).fill('3')
  await expect(page.getByText(/画像が不足しています/)).toBeVisible()
  await expect(page.getByRole('link', { name: /ZIP をダウンロード/ })).toHaveCount(0)
})

test('reports corrupt JPEGs and allows retry with new inputs', async ({ page }) => {
  await page.goto('/tools/batch-collage')
  await page.getByLabel('行数', { exact: true }).fill('1')
  await page.getByLabel('列数', { exact: true }).fill('1')
  await page.getByLabel('画像をまとめて選択').setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('broken') })
  await page.getByRole('button', { name: '生成して ZIP を作成' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'broken.jpg' })).toBeVisible()
  await expect(page.getByRole('link', { name: /ZIP をダウンロード/ })).toHaveCount(0)
  await page.getByLabel('画像をまとめて選択').setInputFiles(await jpeg(page, 'valid.jpg'))
  await page.getByRole('button', { name: '生成して ZIP を作成' }).click()
  await expect(page.getByRole('link', { name: /ZIP をダウンロード/ })).toBeVisible()
})
