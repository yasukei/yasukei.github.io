import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end smoke tests against the built site: open a tool page, give it an
 * image, and check that a real file comes back out of the Download button.
 * What the pixels should be is the browser suite's job, not this one's.
 *
 * It serves dist/ as it is and does not build it: `npm run test:e2e` builds
 * first, and CI runs this after its own build step so the site is built once.
 */

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: `http://localhost:${PORT}`
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Fake camera and microphone, and the permission dialog answered yes,
        // for the permission tab. Chromium is the only engine that offers either.
        launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }
      }
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  webServer: {
    command: `npm run docs:preview -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI
  }
})
