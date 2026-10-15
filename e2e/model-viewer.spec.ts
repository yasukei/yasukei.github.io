import { test, expect, type Page } from '@playwright/test'
import { boxStl, pngSizeOf } from './helpers'

/**
 * How long the first model may take to appear. CI runners have no GPU, so
 * Chromium draws WebGL in software (SwiftShader), and compiling the shaders
 * for the first frame alone has taken several seconds there -- well past
 * Playwright's 5 s default, though a real GPU does it in milliseconds.
 */
const FIRST_FRAME = 30_000

/** Headless Firefox has no WebGL at all, with or without a GPU. */
function hasWebGL(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')))
}

test('shows a chosen model and saves the view as a PNG', async ({ page }) => {
  test.slow()
  await page.goto('/tools/model-viewer')
  const chooser = page.getByLabel('モデルを選択')

  if (!(await hasWebGL(page))) {
    await chooser.setInputFiles(boxStl('bracket.stl', 40, 20, 10))
    await expect(page.getByRole('status')).toHaveText('このブラウザでは 3D 表示 (WebGL) が使えません。')
    return
  }

  await chooser.setInputFiles(boxStl('bracket.stl', 40, 20, 10))
  await expect(page.getByText('12 三角形')).toBeVisible({ timeout: FIRST_FRAME })
  await expect(page.getByText('40 × 20 × 10')).toBeVisible()
  // An STL is taken to be Z-up, as CAD and slicers have it.
  await expect(page.getByRole('button', { name: 'Z 軸を上に' })).toHaveAttribute('aria-pressed', 'true')

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PNG で保存' }).click()
  const download = await downloading

  expect(download.suggestedFilename()).toBe('bracket.png')
  const size = await pngSizeOf(download)
  expect(size?.width).toBeGreaterThan(0)
  expect(size?.height).toBeGreaterThan(0)
})

test('says which formats it takes when given something else', async ({ page }) => {
  await page.goto('/tools/model-viewer')

  await page.getByLabel('モデルを選択').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') })

  await expect(page.getByRole('status')).toHaveText('対応している形式は GLB / glTF / STL / OBJ です。')
})

test('loads three.js on its own, without a second copy of the page', async ({ page }) => {
  test.slow()
  // A page opened directly runs its "lean" chunk. Were the on-demand three.js
  // chunk to import anything from the page, it would pull in the full page
  // chunk as well and run that code a second time -- which has broken
  // `instanceof` across the copies before. See docs/lib/model-viewer.ts.
  const requested: string[] = []
  page.on('request', (request) => requested.push(new URL(request.url()).pathname))

  await page.goto('/tools/model-viewer')
  await page.getByLabel('モデルを選択').setInputFiles(boxStl('box.stl', 1, 1, 1))
  await expect(page.locator('.mv-meta, [role="status"]:not(:empty)').first()).toBeVisible({ timeout: FIRST_FRAME })

  expect(requested.some((path) => /\/model-scene\.[\w-]+\.js$/.test(path))).toBe(true)
  expect(requested.filter((path) => /\/tools_model-viewer\.md\.[\w-]+\.js$/.test(path))).toEqual([])
})
