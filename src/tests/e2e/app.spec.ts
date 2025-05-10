// tests/e2e/app.spec.ts
import { test as base, expect, _electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

// Extend the base test with our fixture
const test = base.extend<{
  electronApp: ElectronApplication;
  window: Page;
}>({  electronApp: async ({}, use) => {
    // Setup test environment with initial store data
    const { setupTestStore } = require('../test-utils/store-helper');
    await setupTestStore();

    // Launch the Electron app
    const mainProcessPath = path.join(__dirname, '..', '..', 'dist', 'main.js');
    const app = await _electron.launch({ 
      args: [mainProcessPath],
    });

    await use(app);
    await app.close();
  },
  window: async ({ electronApp }, use) => {
    const win = await electronApp.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await use(win);
  },
});

test('App launches and has correct title', async ({ window }) => {
  await expect(window).toHaveTitle('AI-Augmented Terminal (React)');
});

test('App displays main UI panels', async ({ window }) => {
  // Check for elements rendered by React components.
  // We use text content or more robust selectors if available.
  // These locators assume some text or identifiable attributes are present.

  // Check for TerminalComponent (it renders a div with specific ID)
  const terminalContainer = window.locator('#terminal-component-container');
  await expect(terminalContainer).toBeVisible();

  // Check for AiPanelComponent (it renders a div with specific classes and content)
  // Let's look for the "AI Assistant" heading within the AI panel.
  const aiPanelHeading = window.locator('h2:has-text("AI Assistant")');
  await expect(aiPanelHeading).toBeVisible();

  // Check if the AI input placeholder is visible
  const aiQueryInput = window.locator('input[placeholder="Ask AI..."]');
  await expect(aiQueryInput).toBeVisible();
  await expect(aiQueryInput).toBeVisible();
});

// Add more tests here later, e.g., for AI interaction with mocking
