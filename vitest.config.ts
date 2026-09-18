import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'

/**
 * Two suites, told apart by file name: `unit` needs nothing installed and is
 * what `npm test` and CI run, `browser` needs browsers downloaded first and so
 * is kept off the default path. What each is for is in the README.
 */

export default defineConfig({
  // Needed to compile the .vue components that tests mount. Projects declared
  // inline inherit it, so neither of them lists it again.
  plugins: [vue()],
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          // Tests live next to the code they cover. `test/` is for checks that
          // span the whole repository rather than a single module.
          include: ['docs/**/*.test.ts', 'test/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/*.browser.test.ts']
          // A file opts into a DOM with `@vitest-environment happy-dom`, so the
          // plain logic suites keep running on node.
        }
      },
      {
        test: {
          name: 'browser',
          include: ['docs/**/*.browser.test.ts', 'test/**/*.browser.test.ts'],
          exclude: ['**/node_modules/**'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }]
          }
        }
      }
    ]
  }
})
