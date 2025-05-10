import { app, BrowserWindow } from 'electron';
import { cleanupPtyProcesses } from './pty-manager';
import { Logger } from '../utils/logger';

const logger = new Logger('AppLifecycle');

export function initializeAppLifecycle(createWindowCallback: () => BrowserWindow) {
    app.whenReady().then(() => {
        logger.info('App is ready, creating window...');
        createWindowCallback();
    });

    app.on('window-all-closed', () => {
        logger.info('All windows closed.');
        cleanupPtyProcesses();
        if (process.platform !== 'darwin') {
            logger.info('Quitting app (not macOS).');
            app.quit();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            logger.info('App activated and no windows open, creating new window...');
            createWindowCallback();
        }
    });

    app.on('will-quit', () => {
        logger.info('Application will quit. Cleaning up PTY processes...');
        cleanupPtyProcesses();
    });
}
