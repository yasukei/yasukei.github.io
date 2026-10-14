import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end smoke tests against the built site: open a tool page, give it an
 * image, and check that a real file comes back out of the Download button.
 * What the pixels should be is the browser suite's job, not this one's.
 */

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: `http://localhost:${PORT}`
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  webServer: {
    command: `npm run build && npm run docs:preview -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
})
