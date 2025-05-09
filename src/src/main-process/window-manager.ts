import { BrowserWindow } from 'electron';
import * as path from 'path';

export let mainWindow: BrowserWindow | null = null;

export function createMainWindow(onClosed: () => void): BrowserWindow {
    try {
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                // preload: path.join(__dirname, 'preload.js') // If you decide to use a preload script
            }
        });

        const htmlPath = path.join(__dirname, '../../index.html'); // Adjusted path relative to dist/main-process/
        console.log('Loading HTML from:', htmlPath);
        mainWindow.loadURL(`file://${htmlPath}`);
        mainWindow.webContents.openDevTools();

        mainWindow.on('closed', () => {
            mainWindow = null;
            onClosed(); // Call the provided cleanup callback
        });
        return mainWindow;
    } catch (err) {
        const error = err as Error;
        console.error('Error creating window:', error);
        process.exit(1);
    }
}

export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}
