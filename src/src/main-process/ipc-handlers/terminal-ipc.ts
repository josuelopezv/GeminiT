import { ipcMain } from 'electron';
import * as os from 'os';
import { spawnPtyProcess, writeToPty, resizePty } from '../pty-manager';
import { getMainWindow } from '../window-manager';
import { Logger } from '../../utils/logger';

const logger = new Logger('TerminalIPC');

export function initializeTerminalIpc() {
    const terminalShellTypes = new Map<string, 'powershell.exe' | 'bash'>();

    ipcMain.on('terminal:create', (event, id: string) => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return;
        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        terminalShellTypes.set(id, shell); 
        logger.info(`PTY process created with ID: ${id}, Shell: ${shell}`);
        
        const ptyProcess = spawnPtyProcess(id, shell, 80, 30, 
            (data: string) => { mainWindow.webContents.send('terminal:data', { id, data }); },
            () => {
                logger.info(`PTY process with ID ${id} exited.`);
                mainWindow.webContents.send('terminal:exit', { id });
                terminalShellTypes.delete(id);
            }
        );
        if (!ptyProcess) {
            logger.error(`Failed to spawn PTY process for shell: ${shell}`);
            mainWindow.webContents.send('terminal:error', { id, error: `Failed to spawn PTY process for shell: ${shell}` });
        }
    });

    ipcMain.on('terminal:input', (event, { id, data }: { id: string; data: string }) => {
        logger.debug(`Received terminal:input for ID ${id}, Data:`, data);
        if (!writeToPty(id, data)) {
            logger.error(`Failed to write to PTY process with ID: ${id}`);
        }
    });

    ipcMain.on('terminal:resize', (event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
        if (!resizePty(id, cols, rows)) {
            logger.error(`Failed to resize PTY process with ID: ${id}`);
        }
    });
}
