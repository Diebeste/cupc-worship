import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173/cupc-worship/',
    trace: 'off',
    screenshot: 'off'
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173/cupc-worship/',
    reuseExistingServer: true,
    timeout: 30_000
  },
  projects: [
    {
      name: 'phone',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 }
      }
    }
  ]
})
