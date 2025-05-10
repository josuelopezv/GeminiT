import { app } from 'electron';
import Store, { Schema as ElectronStoreSchema } from 'electron-store';
import { AppStoreSchemaContents } from './interfaces/store-schema.interface'; // Import shared interface
import { AIService } from './ai-service';
import { createMainWindow } from './main-process/window-manager';
import { initializeAppLifecycle } from './main-process/app-lifecycle';
import { initializeTerminalIpc } from './main-process/ipc-handlers/terminal-ipc';
import { initializeAiIpc } from './main-process/ipc-handlers/ai-ipc';
import { initializeSettingsIpc } from './main-process/ipc-handlers/settings-ipc';
import { cleanupPtyProcesses } from './main-process/pty-manager';

const schema: ElectronStoreSchema<AppStoreSchemaContents> = {
    geminiApiKey: {
        type: 'string',
        default: ''
    },
    geminiModelName: {
        type: 'string',
        default: 'gemini-1.5-flash-latest'
    },
    initialModelInstruction: {
        type: 'string',
        default: 'You are a helpful AI assistant integrated into a terminal application. When a user asks for a command, or if a command is the most helpful response, provide the command in a markdown code block, specifying the language (e.g., powershell, bash, cmd). If you are providing a command, use the execute_terminal_command tool. Do not use it for other purposes. If the user asks a question about a previous command\'s output, I will provide that output as context.'
    }  
};

// Simplify import and explicitly type the store instance
const store: Store<AppStoreSchemaContents> = new Store<AppStoreSchemaContents>({
    schema,
    encryptionKey: 'your-app-secret-key' // Consider a more secure way to handle this
});

// Initialize AI Service
const aiService = new AIService(
    (store as any).get('geminiApiKey'),
    (store as any).get('geminiModelName'),
    (store as any).get('initialModelInstruction') // Rely on electron-store to use the schema default
);

// Initialize IPC Handlers
initializeTerminalIpc();
// Explicitly cast store to the specific type when passing
initializeAiIpc(aiService, store);
initializeSettingsIpc(store, aiService);

// Initialize App Lifecycle
initializeAppLifecycle(() => createMainWindow(cleanupPtyProcesses));

// Graceful shutdown
app.on('before-quit', () => {
    console.log('Application is about to quit. Cleaning up...');
    cleanupPtyProcesses();
});

// Graceful shutdown for uncaught exceptions or signals (optional but good practice)
process.on('uncaughtException', (error) => {
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