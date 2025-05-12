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

        // Regex to find the start marker and consume the entire line it is on.
        // This ensures that when we strip the start marker, we strip its entire line.
        const escapedStartMarker = startMarker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
        const startMarkerRegex = new RegExp(`^(?:.*)${escapedStartMarker}(?:.*)\\r?\\n?`, 'm');

        // Regex to find the end marker. We only care about its presence.
        const escapedEndMarker = endMarker.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
        const endMarkerRegex = new RegExp(escapedEndMarker); // Simpler regex, just find the marker

        const outputListener = (data: string) => {
            if (commandOutputFinished) return;
            logger.debug(`[${captureRunId}] Raw data chunk for capture:`, JSON.stringify(data));
            buffer += data; // Accumulate raw data

            let searchableBuffer = stripAnsiCodes(buffer); // Strip ANSI codes for reliable marker searching
            logger.debug(`[${captureRunId}] Searchable (stripped) buffer:`, JSON.stringify(searchableBuffer));

            if (!capturing) {
                const match = searchableBuffer.match(startMarkerRegex);
                if (match) {
                    logger.debug(`[${captureRunId}] Start marker regex match found in stripped buffer:`, JSON.stringify(match[0]));
                    
                    // Advance the original buffer past the matched start marker line.
                    // Find the occurrence of the clean startMarker string in the *original* buffer
                    // to correctly identify the position of the line to remove.
                    const rawStartMarkerIndex = buffer.indexOf(startMarker);
                    if (rawStartMarkerIndex !== -1) {
                        let endOfLineInRawBuffer = rawStartMarkerIndex;
                        // Find the next newline character after the raw start marker
                        while (endOfLineInRawBuffer < buffer.length && buffer[endOfLineInRawBuffer] !== '\\n' && buffer[endOfLineInRawBuffer] !== '\\r') {
                            endOfLineInRawBuffer++;
                        }
                        // Include the newline character(s)
                        if (endOfLineInRawBuffer < buffer.length && buffer[endOfLineInRawBuffer] === '\\r') {
                            endOfLineInRawBuffer++;
                        }
                        if (endOfLineInRawBuffer < buffer.length && buffer[endOfLineInRawBuffer] === '\\n') {
                            endOfLineInRawBuffer++;
                        }
                        
                        buffer = buffer.substring(endOfLineInRawBuffer);
                        logger.debug(`[${captureRunId}] Advanced raw buffer after start marker line removal:`, JSON.stringify(buffer));
                        searchableBuffer = stripAnsiCodes(buffer); // Re-strip the advanced buffer
                        logger.debug(`[${captureRunId}] Searchable buffer post start marker processing:`, JSON.stringify(searchableBuffer));
                    } else {
                        // This case should ideally not happen if markers are unique and not ANSI-fied.
                        logger.warn(`[${captureRunId}] Raw start marker string "${startMarker}" not found in buffer, though regex matched on stripped. This might lead to incorrect capture start.`);
                        // Fallback: attempt to remove based on the stripped match length if raw marker not found.
                        // This is less reliable.
                        buffer = buffer.substring(match[0].length); // This was the old logic, might be problematic.
                        searchableBuffer = stripAnsiCodes(buffer);
                    }
                    
                    capturing = true;
                    capturedOutput = ''; // Reset captured output once capturing starts
                }
            }

            if (capturing) {
                const match = searchableBuffer.match(endMarkerRegex);
                if (match) {
                    logger.debug(`[${captureRunId}] End marker regex match found in stripped buffer at index ${match.index}.`);
                    
                    // The content before the end marker in the *current* searchableBuffer is what we want.
                    // `searchableBuffer` at this point contains data accumulated since the start marker (or last check)
                    // and has been stripped of ANSI codes.
                    capturedOutput += searchableBuffer.substring(0, match.index!);
                    
                    commandOutputFinished = true;
                    if (dataListenerDisposable) dataListenerDisposable.dispose();

                    let finalOutput = capturedOutput.trim(); // Trim the accumulated, stripped output.

                    logger.debug(`[${captureRunId}] Final captured output (stripped and trimmed):`, JSON.stringify(finalOutput));
                    resolve({ output: finalOutput });
                    return;
                } else {
                    // No end marker yet in the current searchableBuffer.
                    // The entire current searchableBuffer is part of the ongoing command output.
                    capturedOutput += searchableBuffer;
                    // We need to clear the main buffer so these parts are not processed again,
                    // and searchableBuffer will be re-calculated from new data in the next call.
                    buffer = ''; 
                    logger.debug(`[${captureRunId}] End marker not found. Accumulated stripped output so far:`, JSON.stringify(capturedOutput));
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
        // Reverted: Removed suppressEcho flag from writeToPty call
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
