import { test, expect } from '@playwright/test'
import { vrmFixture } from '../test/vrm-fixture'
import { mockDisplayMedia } from './helpers'

const FIRST_FRAME = 30_000

test('tracks pose, face and hands together and toggles each without ending the share', async ({ page }) => {
  test.slow()
  await mockDisplayMedia(page)
  const pose = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }))
  for (const [i, x, y] of [[11, .2, -.5], [12, -.2, -.5], [23, .1, 0], [24, -.1, 0]]) pose[i] = { x, y, z: 0, visibility: 1 }
  const face = Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }))
  face[454] = { x: 0, y: -.8, z: -.1, visibility: 1 }
  face[234] = { x: 0, y: -.8, z: .1, visibility: 1 }
  face[1] = { x: -.15, y: -.8, z: 0, visibility: 1 }
  const hand = Array.from({ length: 21 }, (_, i) => ({ x: (i % 4) * .02, y: -Math.floor(i / 4) * .02, z: i * -.01, visibility: 1 }))
  await page.route(/\/assets\/chunks\/pose-estimator\.[^/]+\.js$/, route => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function createPoseEstimator() { return { delegate: 'CPU', draw(input, timestamp, callback) { callback({ points: ${JSON.stringify(pose)}, timestamp }); return 1 }, close() {} } }`
  }))
  await page.route(/\/assets\/chunks\/detail-estimator\.[^/]+\.js$/, route => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function createDetailEstimator(kind) {
      window.__detailCreated = [...(window.__detailCreated || []), kind];
      return { delegate: 'CPU', draw(input, output, timestamp) {
        if (input === output) throw new Error('Expected clean input');
        return kind === 'face' ? { count: 1, face: { points: ${JSON.stringify(face)}, blendshapes: { jawOpen: .7 }, timestamp }, hands: [] }
        : { count: 2, face: null, hands: ['left', 'right'].map(side => ({ side, score: 1, wrist: { x: .5, y: .5 }, points: ${JSON.stringify(hand)} })) }
      }, close() { window.__detailClosed = [...(window.__detailClosed || []), kind] } }
    }`
  }))
  await page.goto('/tools/pose-capture')
  const hasWebGL = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')))
  const avatar = page.getByLabel('VRM モデル', { exact: true })
  if (hasWebGL) {
    await page.getByLabel('VRM ファイル').setInputFiles({ name: 'mannequin.vrm', mimeType: 'model/gltf-binary', buffer: vrmFixture() })
    await expect(page.getByText('mannequin.vrm を表示中', { exact: true })).toBeVisible({ timeout: FIRST_FRAME })
  }
  const resting = hasWebGL ? await avatar.screenshot() : undefined
  await page.getByRole('checkbox', { name: 'Face（顔・表情）', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Hand（手・指）', exact: true }).check()
  await page.getByRole('button', { name: '画面共有を開始', exact: true }).click()
  await page.getByRole('button', { name: '追跡を開始', exact: true }).click()
  await expect(page.getByText(/Face（顔）：CPU・1 顔検出/)).toBeVisible()
  await expect(page.getByText(/Hand（両手）：CPU・2 手検出/)).toBeVisible()
  if (resting) await expect.poll(async () => (await avatar.screenshot()).equals(resting)).toBe(false)
  await page.getByRole('checkbox', { name: 'Pose（全身）', exact: true }).uncheck()
  await expect(page.getByText(/Pose：骨格表示は停止中/)).toBeVisible()
  await expect(page.getByText(/Face（顔）：CPU・1 顔検出/)).toBeVisible()
  await page.getByRole('checkbox', { name: 'Face（顔・表情）', exact: true }).uncheck()
  await expect(page.getByText('Face（顔）：停止中', { exact: true })).toBeVisible()
  await expect(page.getByText(/Hand（両手）：CPU・2 手検出/)).toBeVisible()
  await expect(page.getByRole('button', { name: '共有を停止', exact: true })).toBeEnabled()
  await page.getByRole('checkbox', { name: 'Face（顔・表情）', exact: true }).check()
  await expect(page.getByText(/Face（顔）：CPU・1 顔検出/)).toBeVisible()
  await page.getByRole('button', { name: '追跡を停止', exact: true }).click()
  await expect(page.getByText('Face（顔）：停止中', { exact: true })).toBeVisible()
  await expect(page.getByText('Hand（両手）：停止中', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as typeof window & { __detailClosed: string[] }).__detailClosed)).toEqual(['face', 'face', 'hands'])
})
