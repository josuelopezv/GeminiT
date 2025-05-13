import { ipcMain, Menu, clipboard, BrowserWindow } from 'electron';
import { Logger } from '../../utils/logger';

const logger = new Logger('ContextMenuIPC');

export function initializeContextMenuIpc() {
    logger.info('Initializing context menu IPC handlers');

    // Handle showing context menu
    ipcMain.on('show-context-menu', (event, data: { hasSelection: boolean; selectedText: string; terminalId: string }) => {
        logger.debug('Received show-context-menu request', { 
            hasSelection: data.hasSelection, 
            terminalId: data.terminalId,
            selectedTextLength: data.selectedText.length
        });

        try {
            // Get the window that sent the request
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) {
                logger.error('Could not find window for context menu');
                return;
            }

            logger.debug('Found window for context menu');

            const menuTemplate = [
                {
                    label: 'Copy',
                    enabled: data.hasSelection,
                    click: () => {
                        logger.debug('Copy menu item clicked');
                        event.sender.send('context-menu:copy');
                    }
                },
                {
                    label: 'Paste',
                    click: () => {
                        logger.debug('Paste menu item clicked');
                        event.sender.send('context-menu:paste');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Clear Terminal',
                    click: () => {
                        logger.debug('Clear Terminal menu item clicked');
                        event.sender.send('context-menu:clear');
                    }
                }
            ];

            logger.debug('Creating menu from template');
            const menu = Menu.buildFromTemplate(menuTemplate);
            
            // Get the current mouse position
            const { x, y } = win.getCursorScreenPoint();
            logger.debug('Showing menu at position:', { x, y });
            
            menu.popup({ 
                window: win,
                x: x,
                y: y
            });
            
            logger.debug('Menu popped up successfully');
        } catch (error) {
            logger.error('Error showing context menu:', error);
        }
    });

    // Handle clipboard write
    ipcMain.on('clipboard:write', (event, text: string) => {
        logger.debug('Received clipboard:write request', { textLength: text.length });
        try {
            clipboard.writeText(String(text));
            logger.debug('Text written to clipboard successfully');
        } catch (error) {
            logger.error('Error writing to clipboard:', error);
        }
    });

    // Handle clipboard read
    ipcMain.handle('clipboard:read', async () => {
        logger.debug('Received clipboard:read request');
        try {
            const text = clipboard.readText();
            logger.debug('Text read from clipboard successfully', { textLength: text.length });
            return String(text);
        } catch (error) {
            logger.error('Error reading from clipboard:', error);
            return '';
        }
    });

    logger.info('Context menu IPC handlers initialized');
} 