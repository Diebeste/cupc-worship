import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js/,
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
    },
    {
      name: 'desktop',
      testMatch: /(?:typing|songs-page|library-languages|format-lyrics)\.spec.js/,
      use: {
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false
      }
    }
  ]
})
