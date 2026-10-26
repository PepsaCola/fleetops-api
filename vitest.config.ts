import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        // Fast, no database: `npm test`
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.int.test.ts'],
        },
      },
      {
        // Real Postgres from docker compose, one throwaway database per run: `npm run test:int`
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.int.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
