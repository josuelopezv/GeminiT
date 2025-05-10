// tests/e2e/initial-model-instruction.spec.ts
import { test as base, expect, _electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
const { setupTestStore } = require('../test-utils/store-helper');

// Extend the base test with our fixture
const test = base.extend<{
  electronApp: ElectronApplication;
  window: Page;
}>({  electronApp: async ({}, use) => {
    // Initialize with known test values for initial model instruction
    await setupTestStore({
      geminiApiKey: 'test-api-key',
      geminiModelName: 'gemini-test-model',
      initialModelInstruction: 'TEST_INSTRUCTION: You are in test mode.'
    });

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
