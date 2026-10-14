import { test, expect, type Page } from '@playwright/test'

async function openTab(page: Page, name: string) {
  await page.getByRole('tab', { name }).click()
}

test('reads the browser it is opened in', async ({ page, browserName }) => {
  await page.goto('/tools/browser-reveals')

  // The page is prerendered without a browser, so this only passes once the
  // component has read the real navigator after hydration.
  const ua = await page.evaluate(() => navigator.userAgent)
  await expect(page.locator('[data-section="user-agent"]')).toContainText(ua)

  for (const id of ['client-hints', 'locale', 'privacy', 'display']) {
    await expect(page.locator(`[data-section="${id}"]`)).toBeVisible()
  }

  // Only Chromium has navigator.userAgentData.
  const platformRow = page.locator('.bi-row', { hasText: 'navigator.userAgentData.platform' })
  if (browserName === 'chromium') {
    await expect(platformRow).not.toContainText('取得できない')
  } else {
    await expect(platformRow).toContainText('取得できない')
  }
})

test('reads the hardware it runs on', async ({ page }) => {
  await page.goto('/tools/browser-reveals')
  await openTab(page, 'ハードウェア')

  const cores = await page.evaluate(() => navigator.hardwareConcurrency)
  const coresRow = page.locator('.bi-row', { hasText: 'navigator.hardwareConcurrency' })
  await expect(coresRow.locator('.bi-text')).toHaveText(String(cores))

  // The canvas probe works in every engine, and shows what it drew.
  const canvasRow = page.locator('.bi-row', { hasText: 'canvas.toDataURL()' })
  await expect(canvasRow.locator('.bi-text')).toHaveText(/^[0-9a-f]{8}$/)
  await expect(canvasRow.locator('img')).toBeVisible()
})

test('finds installed fonts', async ({ page }) => {
  await page.goto('/tools/browser-reveals')
  await openTab(page, 'インストール環境')

  // Whatever the machine, at least one candidate is installed and not all are.
  const counted = page.locator('[data-section="fonts"] .bi-row', { hasText: '見つかった数' }).locator('.bi-text')
  await expect(counted).toHaveText(/^\d+ \/ \d+$/)
  const [found, total] = (await counted.textContent())!.split(' / ').map(Number)
  expect(found).toBeGreaterThan(0)
  expect(found).toBeLessThan(total)
})

test('reads the state of its own window', async ({ page }) => {
  await page.goto('/tools/browser-reveals')
  await openTab(page, 'ウィンドウとページ')

  const viewport = page.viewportSize()!
  const section = page.locator('[data-section="window"]')
  await expect(section.locator('.bi-row', { hasText: 'innerWidth × innerHeight' }).locator('.bi-text')).toHaveText(
    `${viewport.width} × ${viewport.height}`
  )
  await expect(
    page.locator('[data-section="focus"] .bi-row', { hasText: 'visibilityState' }).locator('.bi-text')
  ).toHaveText('visible')
  await expect(page.locator('[data-section="load"]')).toContainText('navigate (リンクやURL入力で来た)')
})

test('records the mouse and the typing as they happen', async ({ page }) => {
  await page.goto('/tools/browser-reveals')
  const row = (label: string) => page.locator('.bi-row', { hasText: label }).locator('.bi-value')

  // Moved while another tab is open: the log records from the moment the page opens.
  await page.mouse.move(100, 100)
  await page.mouse.move(300, 250, { steps: 10 })
  await openTab(page, '操作の情報')
  await expect(row('動かした距離')).toHaveText(/^[1-9]\d* px/)

  const field = page.getByLabel('試しに入力する欄')
  await field.click()
  await field.pressSequentially('hello', { delay: 30 })
  await expect(row('入力欄の中身 (送信前)')).toHaveText(/^hello/)
  await expect(row('キーを押している時間の平均')).toHaveText(/^\d+ ms/)
})

test('opens the tab a link points at, and keeps the choice in the URL', async ({ page }) => {
  await page.goto('/tools/browser-reveals#install')
  await expect(page.getByRole('tab', { name: 'インストール環境' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-section="fonts"]')).toBeVisible()
  await expect(page.locator('[data-section="user-agent"]')).toBeHidden()

  await openTab(page, 'ハードウェア')
  await expect(page).toHaveURL(/#hardware$/)
})

test.describe('what needs a permission', () => {
  const row = (page: Page, label: string) => page.locator('.bi-row', { hasText: label }).locator('.bi-value')

  test('asks for nothing until the button is pressed', async ({ page }) => {
    await page.goto('/tools/browser-reveals#permission')

    await expect(row(page, '緯度')).toContainText('未取得')
    await expect(page.getByRole('button', { name: '現在地の許可をリクエスト' })).toBeEnabled()
  })

  test.describe('with the position allowed', () => {
    test.use({
      permissions: ['geolocation'],
      geolocation: { latitude: 35.681236, longitude: 139.767125, accuracy: 20 }
    })

    test('reads the current position', async ({ page }) => {
      await page.goto('/tools/browser-reveals#permission')
      await page.getByRole('button', { name: '現在地の許可をリクエスト' }).click()

      await expect(row(page, '緯度').locator('.bi-text')).toHaveText('35.681236')
      await expect(row(page, '経度').locator('.bi-text')).toHaveText('139.767125')
      await expect(row(page, '誤差の範囲').locator('.bi-text')).toHaveText('20 m')
    })
  })

  test('shows the camera and microphone, then lets go of them', async ({ page, browserName }) => {
    // Only Chromium can be given fake devices, and have their dialog accepted,
    // with launch flags (see playwright.config.ts).
    test.skip(browserName !== 'chromium', 'fake devices are Chromium-only')
    await page.goto('/tools/browser-reveals#permission')

    await page.getByRole('button', { name: 'カメラの許可をリクエスト' }).click()
    await expect(row(page, '映像の大きさ').locator('.bi-text')).toHaveText(/^\d+ × \d+$/)
    await expect(page.locator('video')).toBeVisible()
    // The names only become readable once a stream was allowed.
    await expect(page.locator('[data-section="device-names"] .bi-row', { hasText: 'カメラの名前' }).locator('li')).not.toHaveCount(0)

    await page.getByRole('button', { name: 'マイクの許可をリクエスト' }).click()
    await expect(row(page, 'サンプリングレート').locator('.bi-text')).toHaveText(/^\d+ Hz$/)
    await expect(page.getByRole('img', { name: 'マイクに入っている音の大きさ' })).toBeVisible()

    await page.getByRole('button', { name: 'カメラを止める' }).click()
    await expect(page.locator('video')).toBeHidden()
    await page.getByRole('button', { name: 'マイクを止める' }).click()
    await expect(page.getByRole('button', { name: 'マイクの許可をリクエスト' })).toBeVisible()
  })
})
