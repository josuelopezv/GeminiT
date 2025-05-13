import { initializeTerminalIpc } from './terminal-ipc';
import { initializeContextMenuIpc } from './context-menu-ipc';
import { Logger } from '../../utils/logger';

const logger = new Logger('IPCInitializer');

export function initializeIpcHandlers() {
    logger.info('Initializing IPC handlers...');
    
    // Initialize terminal IPC handlers
    initializeTerminalIpc();
    
    // Initialize context menu IPC handlers
    initializeContextMenuIpc();
    
    logger.info('IPC handlers initialized successfully.');
} 