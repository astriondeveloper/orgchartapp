import { defineConfig } from 'vitest/config'

// Unit tests cover the pure layers (model, layout, templates), so the default
// Node environment is enough — no DOM needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
