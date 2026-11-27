import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'

if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local')

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:3000', trace: 'off' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'NODE_USE_ENV_PROXY=1 npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
