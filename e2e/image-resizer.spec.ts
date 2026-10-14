import { test, expect } from '@playwright/test'
import { pngOf, pngSizeOf } from './helpers'

test('resizes a chosen image and downloads it', async ({ page }) => {
  await page.goto('/tools/image-resizer')

  await page.getByLabel('Amount').fill('400')
  await page.getByLabel('Choose images').setInputFiles(await pngOf(page, 'photo.png', 800, 600))

  await expect(page.getByText('800 × 600 → 400 × 300')).toBeVisible()

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  const download = await downloading

  expect(download.suggestedFilename()).toBe('photo-400x300.png')
  expect(await pngSizeOf(download)).toEqual({ width: 400, height: 300 })
})
