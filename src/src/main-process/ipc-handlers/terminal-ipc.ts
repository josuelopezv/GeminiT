import { ipcMain } from 'electron';
import * as os from 'os';
import { spawnPtyProcess, writeToPty, resizePty, IPtyProcess } from '../pty-manager';
import { getMainWindow } from '../window-manager';

export function initializeTerminalIpc() {
    ipcMain.on('terminal:create', (event, id: string) => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return;

        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        
        const ptyProcess = spawnPtyProcess(
            id,
            shell,
            80, // Default cols, will be resized by renderer
            30, // Default rows, will be resized by renderer
            (data: string) => {
                mainWindow.webContents.send('terminal:data', { id, data });
            },
            () => {
                // Handle PTY process exit if needed, e.g., send a message to renderer
                console.log(`PTY process with ID ${id} exited.`);
                mainWindow.webContents.send('terminal:exit', { id });
            }
        );

        if (!ptyProcess) {
            mainWindow.webContents.send('terminal:error', { id, error: `Failed to spawn PTY process for shell: ${shell}` });
        }
    });

    ipcMain.on('terminal:input', (event, { id, data }: { id: string; data: string }) => {
        if (!writeToPty(id, data)) {
            console.error(`Failed to write to PTY process with ID: ${id}`);
            // Optionally send an error back to renderer
        }
    });

    ipcMain.on('terminal:resize', (event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
        if (!resizePty(id, cols, rows)) {
            console.error(`Failed to resize PTY process with ID: ${id}`);
            // Optionally send an error back to renderer
        }
    });
}
