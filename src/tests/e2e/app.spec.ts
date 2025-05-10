// tests/e2e/app.spec.ts
import { test, expect, _electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

let electronApp: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  // Launch the Electron app.
  // Adjust the path to your main process entry point as needed.
  // __dirname here will be tests/e2e, so we go up two levels to the project root.
  const mainProcessPath = path.join(__dirname, '..', '..', 'dist', 'main.js');
  
  electronApp = await _electron.launch({ 
    args: [mainProcessPath],
    // You might need to set cwd if your app depends on the current working directory
    // cwd: path.join(__dirname, '..', '..') 
  });

  // Wait for the first window to open and assign it to the window variable.
  window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  // Close the app
  if (electronApp) {
    await electronApp.close();
  }
});

test('App launches and has correct title', async () => {
  await expect(window).toHaveTitle('AI-Augmented Terminal (React)');
});

test('App displays main UI panels', async () => {
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
});

// Add more tests here later, e.g., for AI interaction with mocking
