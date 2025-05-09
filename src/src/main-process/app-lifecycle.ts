import { app, BrowserWindow } from 'electron';
import { createMainWindow, getMainWindow } from './window-manager';
import { cleanupPtyProcesses } from './pty-manager';

export function initializeAppLifecycle(createWindowCallback: () => BrowserWindow) {
    app.whenReady().then(() => {
        createWindowCallback();
    });

    app.on('window-all-closed', () => {
        cleanupPtyProcesses();
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindowCallback();
        }
    });

    // Ensure cleanup on quit (e.g., Ctrl+C in terminal)
    app.on('will-quit', () => {
        cleanupPtyProcesses();
    });
}
