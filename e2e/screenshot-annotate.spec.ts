import { test, expect } from '@playwright/test'
import { pngOf, pngSizeOf } from './helpers'

test('marks up a chosen image and saves it at its own size', async ({ page }) => {
  await page.goto('/tools/screenshot-annotate')

  await page.getByLabel('画像を選択').setInputFiles(await pngOf(page, 'shot.png', 1200, 700))
  await expect(page.getByText('1200 × 700 px')).toBeVisible()

  const undo = page.getByRole('button', { name: '元に戻す' })
  await expect(undo).toBeDisabled()

  const box = await page.getByLabel('注釈を書き込む画像').boundingBox()
  if (!box) throw new Error('the canvas is not on screen')
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 5 })
  await page.mouse.up()
  await expect(undo).toBeEnabled()

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PNG で保存' }).click()
  const download = await downloading

  expect(download.suggestedFilename()).toBe('shot-annotated.png')
  expect(await pngSizeOf(download)).toEqual({ width: 1200, height: 700 })
})
