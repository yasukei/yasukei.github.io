import { test, expect } from '@playwright/test'
import { mockDisplayMedia } from './helpers'

test('captures a stream, crops source pixels, and releases tracks on stop', async ({ page, browserName }) => {
  await mockDisplayMedia(page)
  await page.goto('/tools/pose-capture')
  await page.getByRole('button', { name: '画面共有を開始', exact: true }).click()
  const frame = page.getByRole('group', { name: /^切り出し枠/ })
  await expect(frame).toBeVisible()
  await expect(page.locator('canvas[aria-label="切り出した映像"]')).toHaveJSProperty('width', 640)
  const handle = page.getByRole('button', { name: /^枠のサイズ変更/ })
  await handle.focus()
  await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.press('Shift+ArrowUp')
  // Crop changes must redraw even when the shared source is static.
  await expect(page.getByText(/枠 x=0, y=0, 630 × 350 px/)).toBeVisible()
  await expect(page.locator('canvas[aria-label="切り出した映像"]')).toHaveJSProperty('width', 630)
  await frame.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(page.getByText(/枠 x=10, y=0, 630 × 350 px/)).toBeVisible()
  const [red, green, blue, alpha] = await page.locator('canvas[aria-label="切り出した映像"]').evaluate((element: HTMLCanvasElement) => Array.from(element.getContext('2d')!.getImageData(0, 0, 1, 1).data))
  // WebKit decodes a recorded fixture, so even the alpha channel can round.
  const tolerance = browserName === 'webkit' ? 3 : 0
  expect(red).toBeGreaterThanOrEqual(255 - tolerance)
  expect(green).toBeLessThanOrEqual(tolerance)
  expect(blue).toBeLessThanOrEqual(tolerance)
  expect(alpha).toBeGreaterThanOrEqual(255 - tolerance)
  await page.getByRole('button', { name: '共有を停止', exact: true }).click()
  await expect(frame).toHaveCount(0)
  expect(await page.evaluate(() => (window as typeof window & { captureTrack?: MediaStreamTrack }).captureTrack?.readyState)).toBe('ended')
  await expect(page.getByRole('button', { name: '画面共有を開始', exact: true })).toBeEnabled()
})

test('cancelled sharing can be retried', async ({ page }) => {
  await mockDisplayMedia(page, 'cancel')
  await page.goto('/tools/pose-capture')
  await page.getByRole('button', { name: '画面共有を開始', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('共有がキャンセルされたか')
  await expect(page.getByRole('button', { name: '画面共有を開始', exact: true })).toBeEnabled()
})
