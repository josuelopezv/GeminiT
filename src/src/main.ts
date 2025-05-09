import { app } from 'electron';
import Store from 'electron-store';
import { AIService } from './ai-service';
import { createMainWindow } from './main-process/window-manager';
import { initializeAppLifecycle } from './main-process/app-lifecycle';
import { initializeTerminalIpc } from './main-process/ipc-handlers/terminal-ipc';
import { initializeAiIpc } from './main-process/ipc-handlers/ai-ipc';
import { initializeSettingsIpc } from './main-process/ipc-handlers/settings-ipc';
import { cleanupPtyProcesses } from './main-process/pty-manager';

// Initialize electron-store
const store = new Store({
    encryptionKey: 'your-app-secret-key', // Consider a more secure way to handle this in production
    defaults: {
        geminiApiKey: '',
        geminiModelName: 'gemini-1.5-flash-latest'
    }
});

// Initialize AI Service
const aiService = new AIService(
    store.get('geminiApiKey') as string || '',
    store.get('geminiModelName') as string
);

// Initialize IPC Handlers
initializeTerminalIpc();
initializeAiIpc(aiService, store);
initializeSettingsIpc(store, aiService);

// Initialize App Lifecycle
// The onClosed callback for the window manager will handle PTY cleanup.
initializeAppLifecycle(() => createMainWindow(cleanupPtyProcesses));

// Graceful shutdown for other cases (e.g., app.quit() explicitly called)
app.on('before-quit', () => {
    console.log('Application is about to quit. Cleaning up...');
    cleanupPtyProcesses();
});