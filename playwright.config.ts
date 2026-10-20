import { defineConfig, devices } from '@playwright/test';

// Real-browser characterization of the Nix site and the offline demo, served from the production build.
const baseURL = 'http://localhost:4319';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: true,
  // CI retries once so an intermittent failure is reported as flaky, with its trace, instead of passing silently.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4319 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', testIgnore: /phone\.spec\.ts/, use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'phone', testMatch: /phone\.spec\.ts/, use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
});
