import path from 'node:path'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    env: loadEnv(mode, process.cwd(), ''),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Ver o comentário em vitest.server-only.ts.
      'server-only': path.resolve(__dirname, 'vitest.server-only.ts'),
    },
  },
}))
