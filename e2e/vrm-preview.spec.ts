import { test, expect } from '@playwright/test'
import { vrmFixture } from '../test/vrm-fixture'
import { mockDisplayMedia } from './helpers'

// Software WebGL can take several seconds to render the first frame in CI.
const FIRST_FRAME = 30_000

for (const version of ['1', '0'] as const) {
  test(`loads a local VRM ${version}, synchronizes it, and keeps it after invalid input`, async ({ page }) => {
    test.slow()
    await mockDisplayMedia(page)
    // Use known observations, including an older timestamp from a slow initial inference.
    const points = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }))
    for (const [index, x, y, z] of [
      [11, .2, -.5, 0], [12, -.2, -.5, 0], [23, .1, 0, 0], [24, -.1, 0, 0],
      [13, .2, -.8, 0], [15, .2, -1.1, -.2], [14, -.2, -.2, 0], [16, -.2, .1, 0],
      [25, .1, .4, 0], [27, .1, .8, 0], [26, -.1, .4, 0], [28, -.1, .8, 0]
    ]) points[index] = { x, y, z, visibility: 1 }
    await page.route(/\/assets\/chunks\/pose-estimator\.[^/]+\.js$/, route => route.fulfill({
      contentType: 'application/javascript',
      body: `export async function createPoseEstimator(model) { window.__poseModel = model; return { delegate: 'CPU', draw(canvas, timestamp, onPose) { onPose({ points: ${JSON.stringify(points)}, timestamp: timestamp - 1000 }); return 1 }, close() {} } }`
    }))
    await page.goto('/tools/pose-capture')
    const hasWebGL = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')))
    await page.getByLabel('VRM ファイル').setInputFiles({ name: 'mannequin.vrm', mimeType: 'model/gltf-binary', buffer: vrmFixture(version) })
    if (!hasWebGL) {
      await expect(page.getByText(/VRM を読み込めませんでした/)).toBeVisible({ timeout: FIRST_FRAME })
      return
    }
    await expect(page.getByText('mannequin.vrm を表示中', { exact: true })).toBeVisible({ timeout: FIRST_FRAME })
    const avatar = page.getByLabel('VRM モデル', { exact: true })
    const resting = await avatar.screenshot()
    await page.getByRole('button', { name: '画面共有を開始', exact: true }).click()
    await page.getByRole('combobox', { name: '推定モデル' }).selectOption('full')
    await page.getByRole('button', { name: '追跡を開始', exact: true }).click()
    await expect(page.getByText('推定したポーズに同期中', { exact: true })).toBeVisible()
    // Wait for smoothing to visibly move the model, without asserting renderer-specific pixels.
    await expect.poll(async () => (await avatar.screenshot()).equals(resting)).toBe(false)
    expect(await page.evaluate(() => (window as typeof window & { __poseModel: string }).__poseModel)).toBe('full')
    await page.getByRole('combobox', { name: '推定モデル' }).selectOption('heavy')
    await expect.poll(() => page.evaluate(() => (window as typeof window & { __poseModel: string }).__poseModel)).toBe('heavy')
    await expect(page.getByText('推定したポーズに同期中', { exact: true })).toBeVisible()
    await expect(page.getByText('mannequin.vrm を表示中', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '追跡を停止', exact: true }).click()
    await expect(page.getByText('ポーズ推定待ち（最後の姿勢を保持）', { exact: true })).toBeVisible()
    await page.getByLabel('VRM ファイル').setInputFiles({ name: 'invalid.vrm', mimeType: 'model/gltf-binary', buffer: Buffer.from('invalid') })
    await expect(page.getByText(/VRM を読み込めませんでした/)).toBeVisible()
    await expect(page.getByRole('button', { name: '視点を戻す', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'ポーズをリセット', exact: true }).click()
  })
}
