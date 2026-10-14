import { test, expect } from '@playwright/test'

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
