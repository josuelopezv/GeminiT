import { ipcMain } from 'electron';
import * as os from 'os';
import { spawnPtyProcess, writeToPty, resizePty, shells } from '../pty-manager'; // Removed IPtyProcess as it's used internally by pty-manager
import { getMainWindow } from '../window-manager';
import { captureCommandOutput } from '../command-output-capturer';
import { Logger } from '../../utils/logger'; // Import Logger

const logger = new Logger('TerminalIPC'); // Create a logger instance for this module

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
        if (!writeToPty(id, data)) {
            logger.error(`Failed to write to PTY process with ID: ${id}`);
        }
    });

    ipcMain.on('terminal:resize', (event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
        if (!resizePty(id, cols, rows)) {
            logger.error(`Failed to resize PTY process with ID: ${id}`);
        }
    });

    ipcMain.on('terminal:execute-tool-command', async (event, 
        { command, toolCallId, terminalId, originalFunctionName }: 
        { command: string; toolCallId: string; terminalId: string; originalFunctionName: string }
    ) => {
        const mainWindow = getMainWindow();
        if (!mainWindow) {
            logger.error(`[${toolCallId}] Main window not found for command execution.`);
            return;
        }
        const ptyProcess = shells.get(terminalId);
        if (!ptyProcess) {
            logger.error(`[${toolCallId}] PTY process not found for terminal ID: ${terminalId}`);
            event.sender.send('ai:tool-output-captured', { toolCallId, error: 'PTY process not found', originalFunctionName });
            return;
        }

        const currentShellType = terminalShellTypes.get(terminalId);
        const effectiveShell = currentShellType || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
        const endMarker = `__TOOL_CMD_OUTPUT_END_${Date.now()}_${toolCallId}__`;
        const commandLinesSent = command.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        let markerCommandSent = '';

        if (effectiveShell === 'powershell.exe') {
            markerCommandSent = `Write-Output "${endMarker}"`;
        } else { 
            markerCommandSent = `printf "%s\n" "${endMarker}"`;
        }
        
        logger.debug(`[${toolCallId}] User command:`, command);
        logger.debug(`[${toolCallId}] Marker command for ${effectiveShell}:`, markerCommandSent);

        const capturePromise = captureCommandOutput( ptyProcess, toolCallId, commandLinesSent, markerCommandSent, endMarker );

        logger.debug(`[${toolCallId}] Writing user command to PTY:`, command + '\n');
        writeToPty(terminalId, command + '\n'); 
        
        setTimeout(() => {
            logger.debug(`[${toolCallId}] Writing marker command to PTY:`, markerCommandSent + '\n');
            writeToPty(terminalId, markerCommandSent + '\n');
        }, 100); 

        const result = await capturePromise;

        if (result.error) {
            logger.warn(`[${toolCallId}] Error during command output capture: ${result.error}. Output (if any):`, result.output);
        }
        logger.debug(`[Tool Command Output for ${toolCallId} (${originalFunctionName})]:`, result.output);
        event.sender.send('ai:tool-output-captured', { 
            toolCallId, 
            output: result.output,
            error: result.error, 
            originalFunctionName
        });
    });
}
