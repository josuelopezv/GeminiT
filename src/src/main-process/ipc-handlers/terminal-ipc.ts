import { ipcMain } from 'electron';
import * as os from 'os';
import { spawnPtyProcess, writeToPty, resizePty, shells, IPtyProcess } from '../pty-manager';
import { getMainWindow } from '../window-manager';
import { Logger } from '../../utils/logger';
import { stripAnsiCodes } from '../../utils/string-utils'; // For cleaning output
import { IDisposable } from 'node-pty';

const logger = new Logger('TerminalIPC');

// Helper function for capturing output - adapted from command-output-capturer.ts
async function captureOutputForCommand(
    ptyProcess: IPtyProcess,
    terminalId: string,
    command: string,
    shellType: 'powershell.exe' | 'bash',
    captureRunId: string,
    startMarker: string,
    endMarker: string
): Promise<{ output?: string; error?: string }> {
    // Create a universal marker command that works across shells
    // Using echo with a special character sequence that's unlikely to appear in normal output
    const universalMarker = (marker: string) => {
        // Use a special character sequence that's safe across shells
        // \x1B is ESC, \x07 is BEL - these are control characters that won't be displayed
        // but will be present in the output stream
        return `echo -e "\x1B\x07${marker}\x07\x1B"`;
    };

    // Construct the command with universal markers
    const commandToExecuteWithMarkers = `${universalMarker(startMarker)}; ${command}; ${universalMarker(endMarker)}`;

    logger.debug(`[${captureRunId}] Executing with universal markers:`, commandToExecuteWithMarkers);

    return new Promise((resolve) => {
        let buffer = '';
        let capturing = false;
        let capturedOutput = '';
        let commandOutputFinished = false;
        let dataListenerDisposable: IDisposable | null = null;

        // Updated regex to match the universal marker format
        const markerRegex = (marker: string) => {
            const escapedMarker = marker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
            return new RegExp(`\x1B\x07${escapedMarker}\x07\x1B`, 'g');
        };

        const startMarkerRegex = markerRegex(startMarker);
        const endMarkerRegex = markerRegex(endMarker);

        const outputListener = (data: string) => {
            if (commandOutputFinished) return;
            logger.debug(`[${captureRunId}] Raw data chunk for capture:`, JSON.stringify(data));
            buffer += data;

            if (!capturing) {
                const match = buffer.match(startMarkerRegex);
                if (match) {
                    logger.debug(`[${captureRunId}] Start marker found in buffer`);
                    // Remove everything up to and including the start marker
                    buffer = buffer.replace(startMarkerRegex, '');
                    capturing = true;
                    capturedOutput = '';
                }
            }

            if (capturing) {
                const match = buffer.match(endMarkerRegex);
                if (match) {
                    logger.debug(`[${captureRunId}] End marker found in buffer`);
                    // Get everything before the end marker
                    const endIndex = buffer.indexOf(match[0]);
                    capturedOutput += buffer.substring(0, endIndex);
                    
                    commandOutputFinished = true;
                    if (dataListenerDisposable) dataListenerDisposable.dispose();

                    let finalOutput = stripAnsiCodes(capturedOutput).trim();
                    logger.debug(`[${captureRunId}] Final captured output:`, JSON.stringify(finalOutput));
                    resolve({ output: finalOutput });
                    return;
                } else {
                    // No end marker yet, accumulate the output
                    capturedOutput += buffer;
                    buffer = '';
                }
            }
        };

        try {
            logger.debug(`[${captureRunId}] Attaching data listener.`);
            dataListenerDisposable = ptyProcess.onData(outputListener);
        } catch (e) {
            logger.error(`[${captureRunId}] Error attaching PTY data listener for capture:`, e);
            resolve({ error: 'Cannot attach listener to PTY for output capture.' });
            return;
        }
        
        writeToPty(terminalId, commandToExecuteWithMarkers + '\r');

        // Timeout for the whole operation
        setTimeout(() => {
            if (!commandOutputFinished) {
                logger.warn(`[${captureRunId}] Timeout waiting for end marker during capture.`);
                commandOutputFinished = true;
                if (dataListenerDisposable) dataListenerDisposable.dispose();
                let timedOutOutput = stripAnsiCodes(capturedOutput).trim();
                logger.debug(`[${captureRunId}] Timeout: Final output attempt:`, JSON.stringify(timedOutOutput));
                resolve({ output: timedOutOutput, error: 'Timeout waiting for end marker' });
            }
        }, 7000);
    });
}

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
        // Corrected the logging string here
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

    // New handler for executing parsed commands and capturing their output
    ipcMain.handle('terminal:execute-and-capture-output', async (event, 
        { command, terminalId }: { command: string; terminalId: string }
    ) => {
        logger.info(`Received execute-and-capture for command: "${command}" on terminal ${terminalId}`);
        const ptyProcess = shells.get(terminalId);
        const shellType = terminalShellTypes.get(terminalId) || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');

        if (!ptyProcess) {
            logger.error(`Cannot execute command: PTY process not found for terminal ID: ${terminalId}`);
            return { error: 'PTY process not found' };
        }

        const now = Date.now();
        const captureOpId = `${terminalId}_op_${now}`; // Unique ID for this entire capture operation context

        // Define markers here and pass them down
        const startMarker = `__CMD_OUTPUT_START_${captureOpId}__`;
        const endMarker = `__CMD_OUTPUT_END_${captureOpId}__`;
        
        // Pass captureOpId for logging/context AND the generated markers
        const result = await captureOutputForCommand(ptyProcess, terminalId, command, shellType, captureOpId, startMarker, endMarker);
        return result; // Contains { output?: string, error?: string }
    });
}
