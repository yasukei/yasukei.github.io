import { test, expect } from '@playwright/test'
import { expectControlsToWaitForHydration, pngOf, pngSizeOf } from './helpers'

test('keeps resize controls disabled until the page hydrates', async ({ page }) => {
  const fileInput = page.getByLabel('画像を選択')
  const sizeInput = page.getByLabel('サイズ', { exact: true })
  await expectControlsToWaitForHydration(page, 'image-resizer', fileInput, sizeInput)
  await sizeInput.fill('400')
  await fileInput.setInputFiles(await pngOf(page, 'photo.png', 800, 600))
  await expect(page.getByText('800 × 600 → 400 × 300')).toBeVisible()
})

test('resizes a chosen image and downloads it', async ({ page }) => {
  await page.goto('/tools/image-resizer')

  const fileInput = page.getByLabel('画像を選択')
  await expect(fileInput).toBeEnabled()
  await page.getByLabel('サイズ', { exact: true }).fill('400')
  await fileInput.setInputFiles(await pngOf(page, 'photo.png', 800, 600))

  await expect(page.getByText('800 × 600 → 400 × 300')).toBeVisible()

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ダウンロード', exact: true }).click()
  const download = await downloading

  expect(download.suggestedFilename()).toBe('photo-400x300.png')
  expect(await pngSizeOf(download)).toEqual({ width: 400, height: 300 })
})
