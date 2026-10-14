import { test, expect } from '@playwright/test'
import { pngOf, pngSizeOf } from './helpers'

test('lays out chosen images and downloads the collage', async ({ page }) => {
  await page.goto('/tools/collage')

  await page.getByLabel('画像を選択').setInputFiles([
    await pngOf(page, 'a.png', 800, 600),
    await pngOf(page, 'b.png', 600, 800),
    await pngOf(page, 'c.png', 500, 500)
  ])

  // 16:9 at a 1920px long edge are the defaults.
  await expect(page.getByAltText('コラージュ')).toBeVisible()
  await expect(page.getByText('1920 × 1080')).toBeVisible()

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ダウンロード', exact: true }).click()
  const download = await downloading

  expect(download.suggestedFilename()).toBe('collage-1920x1080.png')
  expect(await pngSizeOf(download)).toEqual({ width: 1920, height: 1080 })
})
