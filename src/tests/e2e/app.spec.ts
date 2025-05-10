// tests/e2e/app.spec.ts
import { test as base, expect, _electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

// Extend the base test with our fixture
const test = base.extend<{
  electronApp: ElectronApplication;
  window: Page;
}>({  
  electronApp: async ({}, use) => {
    const mainProcessPath = path.join(__dirname, '..', '..', 'dist', 'main.js');
    
    // Script to mock electron-store in the renderer process
    const mockScript = `
      const Store = require('electron-store');
      const mockStoreData = {
        geminiApiKey: 'test-api-key',
        geminiModelName: 'gemini-test-model',
        initialModelInstruction: 'TEST_INSTRUCTION: Default test mode.'
      };
      if (Store) {
        Store.prototype.get = (key) => mockStoreData[key];
        Store.prototype.set = (key, value) => { mockStoreData[key] = value; };
        Store.prototype.clear = () => { 
          Object.keys(mockStoreData).forEach(key => delete mockStoreData[key]);
          // Re-initialize with defaults after clear if needed by the app's logic
          mockStoreData.geminiApiKey = 'test-api-key';
          mockStoreData.geminiModelName = 'gemini-test-model';
          mockStoreData.initialModelInstruction = 'TEST_INSTRUCTION: Default test mode.';
        };
      } else {
        console.error('electron-store could not be required in mockScript');
      }
    `;

    const app = await _electron.launch({ 
      args: [mainProcessPath],
    });

    // Add the init script to the default browser context
    await app.context().addInitScript(mockScript);

    await use(app);
    await app.close();
  },
  window: async ({ electronApp }, use) => {
    // Wait for the first window to open.
    const window = await electronApp.firstWindow();
    
    // Ensure the window is fully loaded
    await window.waitForLoadState('load'); // Changed from domcontentloaded to load
    await window.waitForLoadState('networkidle'); // Added wait for network idle

    // It might be useful to ensure the app window, not devtools, is active
    // However, directly focusing can be tricky and might not be the root cause.
    // For now, let's rely on proper load state.

    await use(window);
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
