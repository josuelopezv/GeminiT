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
    toolCallId: string // For unique marker and logging tag
): Promise<{ output?: string; error?: string }> {
    const endMarker = `__CMD_OUTPUT_END_${Date.now()}_${toolCallId}__`;
    const commandLinesSent = command.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    let markerCommandSent = '';

    if (shellType === 'powershell.exe') {
        markerCommandSent = `Write-Output "${endMarker}"`;
    } else {
        markerCommandSent = `printf "%s\n" "${endMarker}"`;
    }

    logger.debug(`[${toolCallId}] Capturing output for command:`, command, `with marker command:`, markerCommandSent);

    return new Promise((resolve) => {
        let capturedOutput = '';
        let commandOutputFinished = false;
        let dataListenerDisposable: IDisposable | null = null;

        const outputListener = (data: string) => {
            if (commandOutputFinished) return;
            logger.debug(`[${toolCallId}] Raw data chunk for capture:`, data);
            capturedOutput += data;
            const markerIndex = capturedOutput.indexOf(endMarker);

            if (markerIndex !== -1) {
                logger.debug(`[${toolCallId}] End marker found for capture.`);
                commandOutputFinished = true;
                if (dataListenerDisposable) dataListenerDisposable.dispose();

                let outputBeforeMarker = capturedOutput.substring(0, markerIndex);
                logger.debug(`[${toolCallId}] Output before strip (capture):`, outputBeforeMarker);
                let strippedOutput = stripAnsiCodes(outputBeforeMarker); // Uses global stripAnsiCodes
                logger.debug(`[${toolCallId}] Output after strip (capture):`, strippedOutput);

                const lines = strippedOutput.split(/\r?\n/);
                const cleanedLines: string[] = [];
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    let lineToKeep = true;
                    if (commandLinesSent.includes(trimmedLine)) lineToKeep = false;
                    else if (trimmedLine === markerCommandSent.trim()) lineToKeep = false;
                    if (lineToKeep) cleanedLines.push(line);
                }
                let finalOutput = cleanedLines.join('\n').trim();
                logger.debug(`[${toolCallId}] Final captured output:`, finalOutput);
                resolve({ output: finalOutput });
            }
        };

        try {
            dataListenerDisposable = ptyProcess.onData(outputListener);
        } catch (e) {
            logger.error(`[${toolCallId}] Error attaching PTY data listener for capture:`, e);
            resolve({ error: 'Cannot attach listener to PTY for output capture.' });
            return;
        }

        // Send user command, then marker command separately
        writeToPty(terminalId, command + '\n');
        setTimeout(() => {
            if (commandOutputFinished) return;
            writeToPty(terminalId, markerCommandSent + '\n');
        }, 100); // Small delay

        setTimeout(() => {
            if (!commandOutputFinished) {
                logger.warn(`[${toolCallId}] Timeout waiting for end marker during capture.`);
                commandOutputFinished = true;
                if (dataListenerDisposable) dataListenerDisposable.dispose();
                let timedOutOutput = stripAnsiCodes(capturedOutput.substring(0, capturedOutput.indexOf(endMarker) !== -1 ? capturedOutput.indexOf(endMarker) : capturedOutput.length));
                // Basic cleaning for timeout
                timedOutOutput = timedOutOutput.split(/\r?\n/).filter(line => {
                    const trimmedLine = line.trim();
                    return !commandLinesSent.includes(trimmedLine) && trimmedLine !== markerCommandSent.trim() && !trimmedLine.includes(endMarker);
                }).join('\n').trim();
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

        // Use a unique ID for this capture operation (e.g., based on timestamp or a simple counter)
        const captureId = `capture_${Date.now()}`;
        const result = await captureOutputForCommand(ptyProcess, terminalId, command, shellType, captureId);
        return result; // Contains { output?: string, error?: string }
    });
}
