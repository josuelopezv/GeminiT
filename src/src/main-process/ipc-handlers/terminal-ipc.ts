import { ipcMain } from 'electron';
import * as os from 'os';
import { spawnPtyProcess, writeToPty, resizePty, shells, IPtyProcess } from '../pty-manager';
import { getMainWindow } from '../window-manager';
// Removed IDisposable import as it's handled within command-output-capturer
import { captureCommandOutput } from '../command-output-capturer'; // Import the new module

export function initializeTerminalIpc() {
    const terminalShellTypes = new Map<string, 'powershell.exe' | 'bash'>();

    ipcMain.on('terminal:create', (event, id: string) => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return;

        const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
        terminalShellTypes.set(id, shell); 
        
        const ptyProcess = spawnPtyProcess(
            id,
            shell,
            80, 
            30, 
            (data: string) => {
                mainWindow.webContents.send('terminal:data', { id, data });
            },
            () => {
                console.log(`PTY process with ID ${id} exited.`);
                mainWindow.webContents.send('terminal:exit', { id });
                terminalShellTypes.delete(id);
            }
        );

        if (!ptyProcess) {
            mainWindow.webContents.send('terminal:error', { id, error: `Failed to spawn PTY process for shell: ${shell}` });
        }
    });

    ipcMain.on('terminal:input', (event, { id, data }: { id: string; data: string }) => {
        if (!writeToPty(id, data)) {
            console.error(`Failed to write to PTY process with ID: ${id}`);
        }
    });

    ipcMain.on('terminal:resize', (event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
        if (!resizePty(id, cols, rows)) {
            console.error(`Failed to resize PTY process with ID: ${id}`);
        }
    });

    ipcMain.on('terminal:execute-tool-command', async (event, 
        { command, toolCallId, terminalId, originalFunctionName }: 
        { command: string; toolCallId: string; terminalId: string; originalFunctionName: string }
    ) => {
        const mainWindow = getMainWindow();
        if (!mainWindow) {
            console.error(`[${toolCallId}] Main window not found for command execution.`);
            return; // Cannot send result back
        }

        const ptyProcess = shells.get(terminalId);
        if (!ptyProcess) {
            console.error(`[${toolCallId}] PTY process not found for terminal ID: ${terminalId}`);
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
        
        console.log(`[DEBUG ${toolCallId}] User command: ${JSON.stringify(command)}`);
        console.log(`[DEBUG ${toolCallId}] Marker command for ${effectiveShell}: ${JSON.stringify(markerCommandSent)}`);

        // Start capturing output (this function now sets up its own listener)
        const capturePromise = captureCommandOutput(
            ptyProcess,
            toolCallId,
            commandLinesSent,
            markerCommandSent,
            endMarker
            // Default timeout of 7000ms is used from command-output-capturer.ts
        );

        // Write the user command to PTY
        console.log(`[DEBUG ${toolCallId}] Writing user command to PTY: ${JSON.stringify(command + '\n')}`);
        writeToPty(terminalId, command + '\n'); 
        
        // Short delay before sending marker command
        setTimeout(() => {
            console.log(`[DEBUG ${toolCallId}] Writing marker command to PTY: ${JSON.stringify(markerCommandSent + '\n')}`);
            writeToPty(terminalId, markerCommandSent + '\n');
        }, 100); 

        // Wait for the capture to complete (or timeout)
        const result = await capturePromise;

        if (result.error) {
            console.warn(`[${toolCallId}] Error during command output capture: ${result.error}. Output (if any): '${result.output}'`);
        }
        console.log(`[Tool Command Output for ${toolCallId} (${originalFunctionName})]:\n'${result.output}'`);
        event.sender.send('ai:tool-output-captured', { 
            toolCallId, 
            output: result.output,
            error: result.error, // Pass along any error from capture (e.g., timeout)
            originalFunctionName
        });
    });
}
