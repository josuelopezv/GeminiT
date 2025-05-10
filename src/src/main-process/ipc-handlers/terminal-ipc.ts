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
    terminalId: string, // For writeToPty
    command: string, // The user's command
    shellType: 'powershell.exe' | 'bash',
    captureRunId: string, // For logging and context
    startMarker: string, // Passed in from caller
    endMarker: string    // Passed in from caller
): Promise<{ output?: string; error?: string }> {
    let commandToExecuteWithMarkers = '';

    if (shellType === 'powershell.exe') {
        // PowerShell: Use Write-Output for markers. Ensure commands are separated if needed.
        // We can send this as one block, relying on PowerShell to execute sequentially.
        commandToExecuteWithMarkers = `Write-Output "${startMarker}"; ${command}; Write-Output "${endMarker}"`;
    } else { // bash or other sh-like shells
        commandToExecuteWithMarkers = `printf "%s\n" "${startMarker}"; ${command}; printf "%s\n" "${endMarker}"`;
    }

    logger.debug(`[${captureRunId}] Executing with start/end markers:`, commandToExecuteWithMarkers);

    return new Promise((resolve) => {
        let buffer = '';
        let capturing = false;
        let capturedOutput = '';
        let commandOutputFinished = false;
        let dataListenerDisposable: IDisposable | null = null;

        // Regex to find the start marker, potentially with leading/trailing whitespace on its line
        const startMarkerRegex = new RegExp(`^[\s\r\n]*${startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\s\r\n]*`, 'm');
        // Regex to find the end marker, potentially with leading/trailing whitespace on its line
        const endMarkerRegex = new RegExp(`^[\s\r\n]*${endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\s\r\n]*`, 'm');

        const outputListener = (data: string) => {
            if (commandOutputFinished) return;
            logger.debug(`[${captureRunId}] Raw data chunk for capture:`, JSON.stringify(data)); // Log with JSON.stringify for clarity
            buffer += data;

            if (!capturing) {
                const match = buffer.match(startMarkerRegex);
                if (match) {
                    logger.debug(`[${captureRunId}] Actual Start marker output found.`);
                    // Content after the start marker (and its line) is the beginning of real output.
                    buffer = buffer.substring(match.index! + match[0].length);
                    capturing = true;
                    logger.debug(`[${captureRunId}] Buffer after start marker processing:`, JSON.stringify(buffer));
                    // Fall through to immediately process this remaining buffer for the end marker
                }
            }

            if (capturing) {
                const match = buffer.match(endMarkerRegex);
                if (match) {
                    logger.debug(`[${captureRunId}] Actual End marker output found.`);
                    // Append content before the end marker's line.
                    capturedOutput += buffer.substring(0, match.index!);
                    commandOutputFinished = true;
                    if (dataListenerDisposable) dataListenerDisposable.dispose();

                    logger.debug(`[${captureRunId}] Captured block before strip:`, JSON.stringify(capturedOutput));
                    let strippedOutput = stripAnsiCodes(capturedOutput);
                    logger.debug(`[${captureRunId}] Captured block after strip:`, JSON.stringify(strippedOutput));
                    
                    let finalOutput = strippedOutput.trim(); // Simpler trim now

                    logger.debug(`[${captureRunId}] Final captured output:`, JSON.stringify(finalOutput));
                    resolve({ output: finalOutput });
                    return;
                } else {
                    // If end marker not yet found, the whole current buffer (if capturing) 
                    // or part of it (if start marker was just found) is part of the command output.
                    // This branch is subtle: if start was found, buffer is already trimmed.
                    // If not, we are accumulating. The next check for endMarker will handle it.
                    // No action needed here if end marker is not found yet, just let buffer accumulate more data,
                    // unless we just started capturing and buffer has content.
                    // If we just turned capturing on, and buffer has content that doesn't contain the end marker,
                    // that content is part of the output.
                    if (capturing && buffer.length > 0) { // Process if capturing and buffer has new data
                         // This check is to ensure we don't add old buffer content if start marker was found mid-buffer
                         // and the remainder didn't have the end marker.
                         // The current logic: buffer is already the part *after* the start marker.
                         // So, if no end marker, this whole buffer is content.
                        capturedOutput += buffer;
                        buffer = '';
                    }
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
        
        // Send the combined command with start and end markers
        writeToPty(terminalId, commandToExecuteWithMarkers + '\r');

        // Timeout for the whole operation
        setTimeout(() => {
            if (!commandOutputFinished) {
                logger.warn(`[${captureRunId}] Timeout waiting for end marker during capture.`);
                commandOutputFinished = true;
                if (dataListenerDisposable) dataListenerDisposable.dispose();
                // On timeout, what we have in capturedOutput is the best guess.
                let timedOutOutput = stripAnsiCodes(capturedOutput);
                timedOutOutput = timedOutOutput.trim(); 
                logger.debug(`[${captureRunId}] Timeout: Final output attempt:`, JSON.stringify(timedOutOutput));
                resolve({ output: timedOutOutput, error: 'Timeout waiting for end marker' });
            }
        }, 7000); // 7-second timeout
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
