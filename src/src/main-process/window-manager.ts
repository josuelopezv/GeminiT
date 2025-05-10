import { BrowserWindow } from 'electron';
import * as path from 'path';
import { Logger } from '../utils/logger'; // Corrected import path

const logger = new Logger('WindowManager'); // Create a logger instance

export let mainWindow: BrowserWindow | null = null;

export function createMainWindow(onClosed: () => void): BrowserWindow {
    try {
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            }
        });

        const htmlPath = path.join(__dirname, '../../index.html'); 
        logger.info('Loading HTML from:', htmlPath);
        mainWindow.loadURL(`file://${htmlPath}`);
        mainWindow.webContents.openDevTools();

        mainWindow.on('closed', () => {
            logger.info('Main window closed.');
            mainWindow = null;
            onClosed();
        });
        logger.info('Main window created successfully.');
        return mainWindow;
    } catch (err) {
        const error = err as Error;
        logger.error('Error creating window:', error);
        process.exit(1);
    }
}

export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}
