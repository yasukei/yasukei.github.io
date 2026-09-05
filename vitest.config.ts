import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Tests live next to the code they cover. `test/` is for checks that span
    // the whole repository rather than a single module.
    include: ['docs/**/*.test.ts', 'test/**/*.test.ts']
  }
})
