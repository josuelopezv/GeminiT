import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { Logger } from '../utils/logger';

const logger = new Logger('WindowManager');

export let mainWindow: BrowserWindow | null = null;

export function createMainWindow(onClosed: () => void): BrowserWindow {
    try {
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true, // Required for direct access to Node.js APIs
                contextIsolation: false, // Required for IPC communication pattern
                webSecurity: true,
                allowRunningInsecureContent: false,
                sandbox: false, // Can't use sandbox with nodeIntegration
                additionalArguments: ['--disable-site-isolation-trials'], // Required for terminal functionality
                devTools: !app.isPackaged, // Only enable DevTools in development
                enableWebSQL: false,
                spellcheck: false,
                v8CacheOptions: 'code'
            },
            // Additional security settings
            autoHideMenuBar: true, // Hide menu bar by default
            show: false, // Don't show until ready-to-show
            backgroundColor: '#1a1a1a', // Prevent white flash during load
        });

        const htmlPath = path.join(__dirname, '../index.html');
        logger.info('Loading HTML from:', htmlPath);
        mainWindow.loadFile(htmlPath);

        // Only open DevTools in development mode
        if (!app.isPackaged) {
            mainWindow.webContents.openDevTools();
        }

        // Show window when ready
        mainWindow.once('ready-to-show', () => {
            mainWindow?.show();
        });

        // Security handlers
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            // Prevent opening any external URLs
            if (url.startsWith('file:') || url.startsWith('data:')) {
                return { action: 'allow' };
            }
            return { action: 'deny' };
        });

        // Session security
        mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
            const allowedPermissions = new Set(['clipboard-read', 'clipboard-write']);
            callback(allowedPermissions.has(permission));
        });

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
