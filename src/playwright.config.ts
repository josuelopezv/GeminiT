// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e', // Directory where E2E tests will be located
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // Fail the build on CI if you accidentally left test.only in the source code
  retries: process.env.CI ? 2 : 0, // Retry on CI only
  workers: process.env.CI ? 1 : undefined, // Opt out of parallel tests on CI by default
  reporter: 'html', // Generates an HTML report
  use: {
    trace: 'on-first-retry', // Collect trace when retrying the failed test
  },

  projects: [
    {
      name: 'electron-app',
      // Playwright doesn't have a built-in Electron device, 
      // so we don't specify `use: { ...devices['Desktop Chrome'] }` here.
      // The Electron app launching will be handled in the test setup.
    },
  ],

  // Example of setting a global timeout for all tests (optional)
  // timeout: 30 * 1000,

  // Example of setting expectations timeout (optional)
  // expect: {
  //   timeout: 5 * 1000,
  // },
});
