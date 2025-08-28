import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  use: {
    baseURL: process.env.APP_WEB_URL || 'https://app.st4ge.com',
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE || './e2e/web/auth/.app_state.json',
    permissions: ['camera', 'microphone'],
    headless: process.env.HEADLESS === '1',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { 
      ...devices['Desktop Chrome'],
      launchOptions: {
        args: [
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          ...(process.env.CAMERA_Y4M ? [`--use-file-for-fake-video-capture=${process.env.CAMERA_Y4M}`] : [])
        ]
      }
    } },
  ]
});


