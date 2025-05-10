// tests/e2e/initial-model-instruction.spec.ts
import { test as base, expect, _electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import { setupTestStore } from '../test-utils/store-helper.e2e';

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

    await use(window);
  },
});

test('Settings panel shows initial model instruction', async ({ window }) => {
  // Open settings panel
  await window.click('button[title="Settings"]');

  // Check if instruction textarea is visible and has correct content
  const instructionTextarea = window.locator('textarea[placeholder*="Initial Model Instruction"]');
  await expect(instructionTextarea).toBeVisible();
  await expect(instructionTextarea).toHaveValue('TEST_INSTRUCTION: You are in test mode.');
});

test('Can update initial model instruction', async ({ window }) => {
  // Open settings panel if not already open
  await window.click('button[title="Settings"]');

  // Update the instruction
  const instructionTextarea = window.locator('textarea[placeholder*="Initial Model Instruction"]');
  await instructionTextarea.fill('NEW_TEST_INSTRUCTION: Updated test mode.');
  
  // Save settings
  await window.click('button:has-text("Save Settings")');
    // Verify the change was applied and settings closed
  await expect(instructionTextarea).toHaveValue('NEW_TEST_INSTRUCTION: Updated test mode.');
  
  // Wait for settings to be saved
  await window.waitForTimeout(1000);
});
