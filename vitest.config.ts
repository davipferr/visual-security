import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // The lib is pure logic plus Web Crypto, which Node provides as globalThis.crypto.
    environment: 'node',
  },
})
