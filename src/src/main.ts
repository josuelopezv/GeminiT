import { app } from 'electron';
// Remove direct electron-store imports if no longer needed here
// import Store, { Schema as ElectronStoreSchema } from 'electron-store';
// import { AppStoreSchemaContents } from './interfaces/store-schema.interface'; 
import appStoreManager from './main-process/app-store-manager'; // Import the new AppStoreManager
import { AIService } from './services/ai-service';
import { GeminiAiProvider } from './ai-providers/gemini-ai-provider';// Added import
import { createMainWindow } from './main-process/window-manager';
import { initializeAppLifecycle } from './main-process/app-lifecycle';
import { initializeTerminalIpc } from './main-process/ipc-handlers/terminal-ipc';
import { initializeAiIpc } from './main-process/ipc-handlers/ai-ipc';
import { initializeSettingsIpc } from './main-process/ipc-handlers/settings-ipc';
import { cleanupPtyProcesses } from './main-process/pty-manager';
import { Logger } from './utils/logger'; // Import Logger
import installExtension, { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';

const mainLogger = new Logger('MainApp'); // Create a logger instance for main.ts

const installDevTools = async () => {
    if (!app.isPackaged) {
        try {
            const name = await installExtension(REACT_DEVELOPER_TOOLS);
            mainLogger.info(`Added Extension: ${name}`);
        } catch (err) {
            mainLogger.error('An error occurred installing React DevTools:', err);
        }
    }
};

// Schema definition is now inside AppStoreManager
// const schema: ElectronStoreSchema<AppStoreSchemaContents> = { ... };

// Store instantiation is now handled by AppStoreManager
// const store: Store<AppStoreSchemaContents> = new Store<AppStoreSchemaContents>(...);

// Initialize AI Provider
const geminiAiProvider = new GeminiAiProvider();

// Initialize AI Service using AppStoreManager
const aiService = new AIService(
    geminiAiProvider,
    appStoreManager.getGeminiApiKey(), // Use typed getter
    appStoreManager.getGeminiModelName(), // Use typed getter
    appStoreManager.getInitialModelInstruction() // Use typed getter
);

// Initialize IPC Handlers
initializeTerminalIpc();
// Pass appStoreManager to IPC handlers that need it
initializeAiIpc(aiService, appStoreManager); // Updated to pass appStoreManager
initializeSettingsIpc(appStoreManager, aiService); // Updated to pass appStoreManager

// Initialize App Lifecycle with DevTools Installation
app.whenReady().then(async () => {
    await installDevTools();
    createMainWindow(cleanupPtyProcesses);
});

// Graceful shutdown
app.on('before-quit', () => {
    mainLogger.info('Application is about to quit. Cleaning up...');
    // Log all settings from AppStoreManager before quitting
    try {
        const allSettings = appStoreManager.getAllSettings();
        mainLogger.info('Final AppStoreManager state before quit:', allSettings);
    } catch (error) {
        mainLogger.error('Error retrieving settings from AppStoreManager before quit:', error);
    }
    cleanupPtyProcesses();
});

// Graceful shutdown for uncaught exceptions or signals (optional but good practice)
process.on('uncaughtException', (error) => {
    mainLogger.error('Uncaught exception:', error);
    cleanupPtyProcesses();
    app.quit(); // Force quit on unhandled exception
});

process.on('SIGINT', () => {
    cleanupPtyProcesses();
    app.quit();
});

process.on('SIGTERM', () => {
    cleanupPtyProcesses();
    app.quit();
});

app.on('quit', () => {
    process.exit(0);
});