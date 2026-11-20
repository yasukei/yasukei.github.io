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
  const { actual, expected } = await page.getByLabel('切り出した映像', { exact: true }).evaluate((crop: HTMLCanvasElement) => {
    const video = document.querySelector<HTMLVideoElement>('video[aria-label="共有映像"]')!
    const source = document.createElement('canvas')
    source.width = 630
    source.height = 350
    const context = source.getContext('2d')!
    context.drawImage(video, -10, 0)
    return {
      actual: Array.from(crop.getContext('2d')!.getImageData(8, 8, 1, 1).data),
      expected: Array.from(context.getImageData(8, 8, 1, 1).data)
    }
  })
  // The two WebKit draw calls can sample different decoded frames of the
  // solid red recording and use different compositing paths.
  expect(expected[3]).toBeGreaterThan(0)
  if (browserName !== 'webkit') expect(expected).toEqual([255, 0, 0, 255])
  const channelDifference = Math.max(...actual.map((channel, index) => Math.abs(channel - expected[index])))
  expect(channelDifference, `Cropped pixel [${actual}] vs source [${expected}]`).toBeLessThanOrEqual(browserName === 'webkit' ? 16 : 0)
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
