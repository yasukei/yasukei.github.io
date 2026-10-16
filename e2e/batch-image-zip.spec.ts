import { test, expect, type Page } from '@playwright/test'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { unzipSync } from 'fflate'
import { pngOf } from './helpers'

async function withFolder(page: Page, action: (folder: string) => Promise<void>) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'batch-images-'))
  const folder = path.join(temporary, 'src')
  try {
    await mkdir(path.join(folder, 'nested'), { recursive: true })
    for (const [name, width] of [['2.PNG', 2], ['10.png', 10], ['nested/1.png', 4]] as const) {
      const png = await pngOf(page, name, width, 3)
      await writeFile(path.join(folder, name), png.buffer)
    }
    await writeFile(path.join(folder, 'ignored.txt'), 'not an image')
    await action(folder)
  } finally { await rm(temporary, {recursive: true, force: true}) }
}

async function downloadZip(page: Page) {
  const downloaded = page.waitForEvent('download')
  await page.getByRole('link', {name: 'ZIP をダウンロード'}).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('converted-images.zip')
  return unzipSync(new Uint8Array(await readFile(await download.path())))
}

test.beforeEach(async ({page}) => {
  // Force the fallback on Chromium too. Neither directory write permissions nor
  // Web Locks may be prerequisites for choosing a folder and downloading a ZIP.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {value: undefined})
    Object.defineProperty(navigator, 'locks', {value: undefined})
  })
  await page.goto('/tools/batch-image-converter')
})

test('automatically offers ZIP when direct folder writes are unavailable', async ({page}) => {
  await expect(page.getByLabel('保存方法')).toHaveValue('zip')
  await expect(page.getByLabel('src フォルダを読み込む')).toBeVisible()
  await expect(page.getByText('このブラウザでは、フォルダを読み込んで ZIP でダウンロードできます。', {exact: false})).toBeVisible()
  await expect(page.getByRole('button', {name:'変換して ZIP を作成'})).toBeDisabled()
})

test('downloads numbered JPEGs from a recursive folder in natural path order', async ({page}) => {
  await withFolder(page, async folder => {
    await page.getByLabel('src フォルダを読み込む').setInputFiles(folder)
    await page.getByRole('button', {name:'変換して ZIP を作成'}).click()
    await expect(page.getByText('ZIP を作成しました。ダウンロードボタンから保存してください。')).toBeVisible()
    const entries = await downloadZip(page)
    expect(Object.keys(entries)).toEqual(['001.jpg','002.jpg','003.jpg'])
    for (const bytes of Object.values(entries)) expect([...bytes.slice(0,3)]).toEqual([255,216,255])
    const dimensions = await page.evaluate(async entries => {
      const result = []
      for (const bytes of entries) {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], {type:'image/jpeg'}))
        result.push([bitmap.width, bitmap.height]); bitmap.close()
      }
      return result
    }, Object.values(entries).map(bytes => [...bytes]))
    expect(dimensions).toEqual([[2,3],[10,3],[4,3]])
  })
})

test('uses a custom start and PNG output, and clears stale ZIPs when settings change', async ({page}) => {
  await withFolder(page, async folder => {
    await page.getByLabel('src フォルダを読み込む').setInputFiles(folder)
    await page.getByLabel('開始番号').fill('999')
    await page.getByLabel('出力形式').selectOption('png')
    await page.getByRole('button', {name:'変換して ZIP を作成'}).click()
    await expect(page.getByRole('link', {name:'ZIP をダウンロード'})).toBeVisible()
    const entries = await downloadZip(page)
    expect(Object.keys(entries)).toEqual(['999.png','1000.png','1001.png'])
    for (const bytes of Object.values(entries)) expect([...bytes.slice(0,8)]).toEqual([137,80,78,71,13,10,26,10])
    await page.getByLabel('開始番号').fill('10')
    await expect(page.getByRole('link', {name:'ZIP をダウンロード'})).toHaveCount(0)
    await expect(page.getByLabel('開始番号')).toHaveValue('10')
  })
})

test('does not generate a ZIP when no files match or a source image is broken', async ({page}) => {
  await withFolder(page, async folder => {
    await page.getByLabel('src フォルダを読み込む').setInputFiles(folder)
    await page.getByLabel('入力形式').selectOption('webp')
    await page.getByRole('button', {name:'変換して ZIP を作成'}).click()
    await expect(page.getByText('対象の画像が見つかりませんでした。')).toBeVisible()
    await expect(page.getByRole('link', {name:'ZIP をダウンロード'})).toHaveCount(0)
    await writeFile(path.join(folder, '10.png'), 'broken png')
    await page.getByLabel('src フォルダを読み込む').setInputFiles(folder)
    await page.getByLabel('入力形式').selectOption('png')
    await page.getByRole('button', {name:'変換して ZIP を作成'}).click()
    await expect(page.getByRole('alert')).toContainText('10.png:')
    await expect(page.getByRole('link', {name:'ZIP をダウンロード'})).toHaveCount(0)
  })
})

test('allows multiple image files when folder input is unavailable', async ({page}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(HTMLInputElement.prototype, 'webkitdirectory')
    Reflect.deleteProperty(File.prototype, 'webkitRelativePath')
  })
  await page.reload()
  await page.getByLabel('画像をまとめて選択').setInputFiles([
    await pngOf(page, '10.png', 10, 3), await pngOf(page, '2.png', 2, 3)
  ])
  await expect(page.getByText('2 枚の画像（2 ファイル読み込み済み）')).toBeVisible()
  await page.getByRole('button', {name:'変換して ZIP を作成'}).click()
  await expect(page.getByRole('link', {name:'ZIP をダウンロード'})).toBeVisible()
  const entries = await downloadZip(page)
  expect(Object.keys(entries)).toEqual(['001.jpg', '002.jpg'])
})
