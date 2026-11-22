import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: true, reporter: 'list',
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120000 },
  projects: [{ name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }, { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }]
});
