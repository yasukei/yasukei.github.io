import { test, expect, type Page } from '@playwright/test'

// Real origin-private filesystem handles exercise iteration, identity, and writes;
// only the native picker UI is replaced, as browsers cannot automate that dialog.
async function chooseFolders(page: Page, collision = false, input: 'png' | 'jpg' = 'png') {
  await page.evaluate(async ({collision, input}) => {
    const root = await navigator.storage.getDirectory()
    const src = await root.getDirectoryHandle('src', {create: true})
    const nested = await src.getDirectoryHandle('nested', {create: true})
    const dst = await root.getDirectoryHandle('dst', {create: true})
    const canvas = document.createElement('canvas')
    canvas.width = 4; canvas.height = 3
    const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), input === 'png' ? 'image/png' : 'image/jpeg'))
    for (const [directory, name] of [[src, input === 'png' ? '10.PNG' : '10.JPEG'], [src, `2.${input}`], [nested, `1.${input}`]] as const) {
      const f = await directory.getFileHandle(name, {create: true})
      const w = await f.createWritable(); await w.write(png); await w.close()
    }
    const hidden = await src.getDirectoryHandle('.hidden', {create: true})
    for (const [directory, name] of [[src, `._2.${input}`], [hidden, `1.${input}`]] as const) {
      const f = await directory.getFileHandle(name, {create: true})
      const w = await f.createWritable(); await w.write('AppleDouble or hidden image'); await w.close()
    }
    const ignored = await src.getFileHandle('ignore.txt', {create: true})
    const w = await ignored.createWritable(); await w.write('not an image'); await w.close()
    if (collision) {
      const f = await dst.getFileHandle('002.jpg', {create: true})
      const w = await f.createWritable(); await w.write('keep me'); await w.close()
    }
    Object.defineProperty(window, 'showDirectoryPicker', {configurable: true, value: async (options: {id: string}) => options.id === 'source' ? src : dst})
  }, {collision, input})
  await page.getByRole('button', {name: 'src フォルダを選択'}).click()
  await page.getByRole('button', {name: 'dst フォルダを選択'}).click()
}

async function outputs(page: Page) {
  return page.evaluate(async () => {
    const dst = await (await navigator.storage.getDirectory()).getDirectoryHandle('dst')
    const results = []
    // values() is implemented by the browser, but not declared in TS's DOM lib.
    for await (const entry of (dst as unknown as {values(): AsyncIterable<FileSystemFileHandle>}).values()) {
      const f = await entry.getFile()
      let pixel: number[] = []
      let size: number[] = []
      try {
        const bitmap = await createImageBitmap(f)
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0)
        pixel = [...ctx.getImageData(0, 0, 1, 1).data]; size = [bitmap.width, bitmap.height]; bitmap.close()
      } catch { /* collision fixtures are deliberately not images */ }
      results.push({name:f.name, type:f.type, pixel, size, text: size.length ? '' : await f.text()})
    }
    return results.sort((a,b) => a.name.localeCompare(b.name))
  })
}


test.describe('folder conversion', () => {
  test.skip(({browserName}) => browserName !== 'chromium', 'Directory picker support requires Chromium')
  test('recursively converts PNGs into numbered JPEGs with white transparency', async ({page}) => {
    await page.goto('/tools/batch-image-converter')
    await chooseFolders(page)
    await expect(page.getByLabel('開始番号')).toHaveValue('1')
    await page.getByRole('button', {name:'変換して保存'}).click()
    await expect(page.getByText('変換・保存が完了しました。')).toBeVisible()
    const result = await outputs(page)
    expect(result.map(f => f.name)).toEqual(['001.jpg', '002.jpg', '003.jpg'])
    for (const f of result) {
      expect(f.type).toBe('image/jpeg'); expect(f.size).toEqual([4,3]); expect(f.pixel).toEqual([255,255,255,255])
    }
  })
  test('reports completion when cancelled during the final save without double dimming buttons', async ({page}) => {
    await page.goto('/tools/batch-image-converter')
    await chooseFolders(page)
    await page.evaluate(() => {
      const controls = window as unknown as { finalWritePending: boolean; releaseFinalWrite: () => void }
      const create = FileSystemFileHandle.prototype.createWritable
      FileSystemFileHandle.prototype.createWritable = async function(options) {
        const writable = await create.call(this, options)
        if (this.name === '003.jpg') {
          const close = writable.close.bind(writable)
          writable.close = async () => {
            controls.finalWritePending = true
            await new Promise<void>(resolve => { controls.releaseFinalWrite = resolve })
            await close()
          }
        }
        return writable
      }
    })
    await page.getByRole('button', {name:'変換して保存'}).click()
    await page.waitForFunction(() => (window as unknown as {finalWritePending: boolean}).finalWritePending)
    await expect(page.locator('fieldset')).toHaveCSS('opacity', '0.6')
    await expect(page.getByRole('button', {name:'src フォルダを選択'})).toBeDisabled()
    await expect(page.getByRole('button', {name:'src フォルダを選択'})).toHaveCSS('opacity', '1')
    await page.getByRole('button', {name:'中止', exact:true}).click()
    await page.evaluate(() => (window as unknown as {releaseFinalWrite: () => void}).releaseFinalWrite())
    await expect(page.getByText('変換・保存が完了しました。')).toBeVisible()
    await expect(page.getByText('保存済み 3 / 3 枚')).toBeVisible()
    expect((await outputs(page)).map(f => f.name)).toEqual(['001.jpg','002.jpg','003.jpg'])
  })
  test('allows a custom start and output format', async ({page}) => {
    await page.goto('/tools/batch-image-converter')
    await chooseFolders(page)
    await page.getByLabel('開始番号').fill('999')
    await page.getByLabel('出力形式').selectOption('webp')
    await page.getByRole('button', {name:'変換して保存'}).click()
    await expect(page.getByText('変換・保存が完了しました。')).toBeVisible()
    expect((await outputs(page)).map(f => [f.name, f.type])).toEqual([['999.webp','image/webp'], ['1000.webp','image/webp'], ['1001.webp','image/webp']].sort((a,b) => a[0].localeCompare(b[0])))
  })
  test('accepts JPEG inputs and writes PNG output', async ({page}) => {
    await page.goto('/tools/batch-image-converter')
    await chooseFolders(page, false, 'jpg')
    await page.getByLabel('入力形式').selectOption('jpg')
    await page.getByLabel('出力形式').selectOption('png')
    await page.getByRole('button', {name:'変換して保存'}).click()
    await expect(page.getByText('変換・保存が完了しました。')).toBeVisible()
    expect((await outputs(page)).map(f => [f.name, f.type])).toEqual([
      ['001.png', 'image/png'], ['002.png', 'image/png'], ['003.png', 'image/png']
    ])
  })
  test('refuses conversion while another tab holds the batch lock', async ({page}) => {
    await page.goto('/tools/batch-image-converter')
    await chooseFolders(page)
    const other = await page.context().newPage()
    await other.goto('/tools/batch-image-converter')
    await other.evaluate(() => new Promise<void>(resolve => {
      void navigator.locks.request('batch-image-converter', async () => {
        resolve()
        await new Promise(() => {})
      })
    }))
    await page.getByRole('button', {name:'変換して保存'}).click()
    await expect(page.getByRole('alert')).toContainText('別のタブで変換中')
    expect(await outputs(page)).toEqual([])
    await other.close()
    await page.getByRole('button', {name:'変換して保存'}).click()
    await expect(page.getByText('変換・保存が完了しました。')).toBeVisible()
  })
  test('preflights all names and leaves existing files unchanged', async ({page}) => {
    await page.goto('/tools/batch-image-converter')
    await chooseFolders(page, true)
    await page.getByRole('button', {name:'変換して保存'}).click()
    await expect(page.getByRole('alert')).toContainText('002.jpg が既にあります')
    expect((await outputs(page)).map(f => [f.name, f.text])).toEqual([['002.jpg','keep me']])
  })
})
