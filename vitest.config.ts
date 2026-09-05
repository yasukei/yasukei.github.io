import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Needed to compile the .vue components that component tests mount.
  plugins: [vue()],
  test: {
    // Tests live next to the code they cover. `test/` is for checks that span
    // the whole repository rather than a single module.
    include: ['docs/**/*.test.ts', 'test/**/*.test.ts']
    // Component tests opt into a DOM per file with `@vitest-environment
    // happy-dom`, so the plain logic suites keep running on node.
  }
})
