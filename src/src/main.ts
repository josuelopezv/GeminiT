import { app } from 'electron';
import Store, { Schema as ElectronStoreSchema } from 'electron-store';
import { AIService } from './ai-service';
import { IAiService } from './interfaces/ai-service.interface';
import { createMainWindow } from './main-process/window-manager';
import { initializeAppLifecycle } from './main-process/app-lifecycle';
import { initializeTerminalIpc } from './main-process/ipc-handlers/terminal-ipc';
import { initializeAiIpc } from './main-process/ipc-handlers/ai-ipc';
import { initializeSettingsIpc } from './main-process/ipc-handlers/settings-ipc';
import { cleanupPtyProcesses } from './main-process/pty-manager';
import { Logger } from './utils/logger'; 

const logger = new Logger('Main'); 

logger.info('Application starting...');

// Define the schema structure for electron-store
interface AppStoreSchemaContents {
    geminiApiKey: string;
    geminiModelName: string;
}

const schema: ElectronStoreSchema<AppStoreSchemaContents> = {
    geminiApiKey: {
        type: 'string',
        default: ''
    },
    geminiModelName: {
        type: 'string',
        default: 'gemini-1.5-flash-latest'
    }
};

// Simplify import and explicitly type the store instance
const store: Store<AppStoreSchemaContents> = new Store<AppStoreSchemaContents>({
    schema,
    encryptionKey: 'your-app-secret-key' // Consider a more secure way to handle this
});

// Initialize AI Service with the interface type
const aiService: IAiService = new AIService( // Use IAiService type
    (store as any).get('geminiApiKey'),
    (store as any).get('geminiModelName')
);

// Initialize IPC Handlers
initializeTerminalIpc();
// Explicitly cast store to the specific type when passing
initializeAiIpc(aiService, store as Store<AppStoreSchemaContents>);
initializeSettingsIpc(store as Store<AppStoreSchemaContents>, aiService);

// Initialize App Lifecycle
initializeAppLifecycle(() => createMainWindow(cleanupPtyProcesses));

// Graceful shutdown
app.on('before-quit', () => {
    logger.info('Application before-quit. Final cleanup (already handled by will-quit in app-lifecycle).');
});

// Graceful shutdown for uncaught exceptions or signals (optional but good practice)
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    cleanupPtyProcesses();
    app.quit(); // Force quit on unhandled exception
});

process.on('SIGINT', () => {
    logger.info('Received SIGINT. Cleaning up and quitting...');
    cleanupPtyProcesses();
    app.quit();
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM. Cleaning up and quitting...');
    cleanupPtyProcesses();
    app.quit();
});