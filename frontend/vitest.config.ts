import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify('https://hiresync-production-483b.up.railway.app/api/v1'),
    'import.meta.env.VITE_WS_URL': JSON.stringify('wss://hiresync-production-483b.up.railway.app'),
    'import.meta.env.MODE': JSON.stringify('test'),
    'import.meta.env.DEV': JSON.stringify(false),
    'import.meta.env.PROD': JSON.stringify(false),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
    singleThread: true,
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/tests/**', 'src/main.tsx'],
      threshold: { lines: 80, functions: 70, branches: 60, statements: 80 },
    },
  },
})
