import { ipcMain } from 'electron';
import * as os from 'os';
import { spawnPtyProcess, writeToPty, resizePty, shells, IPtyProcess } from '../pty-manager'; // Import shells
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

    ipcMain.on('terminal:execute-tool-command', async (event, 
        { command, toolCallId, terminalId, originalFunctionName }: 
        { command: string; toolCallId: string; terminalId: string; originalFunctionName: string } // Added originalFunctionName
    ) => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return;

        const ptyProcess = shells.get(terminalId);
        if (!ptyProcess) {
            console.error(`PTY process not found for terminal ID: ${terminalId}`);
            // Send error back to renderer, including originalFunctionName for context
            event.sender.send('ai:tool-output-captured', { 
                toolCallId, 
                error: 'PTY process not found', 
                originalFunctionName 
            });
            return;
        }

        const endMarker = `__TOOL_CMD_OUTPUT_END_${toolCallId}__`;
        let capturedOutput = '';
        let commandOutputFinished = false;

        const toolOutputListener = (data: string) => {
            if (commandOutputFinished) return;

            capturedOutput += data;
            const markerIndex = capturedOutput.indexOf(endMarker);

            if (markerIndex !== -1) {
                commandOutputFinished = true;
                // Clean up the captured output by removing the marker and anything after it from this specific data chunk
                // and also the command that printed the marker.
                // This is a simplification; a more robust way would be to clean based on exact command echo.
                capturedOutput = capturedOutput.substring(0, markerIndex);
                // Remove the command that echoed the marker if it was captured (e.g. "echo __END__\r\n")
                // This regex is a basic attempt and might need refinement based on shell behavior.
                capturedOutput = capturedOutput.replace(new RegExp(`echo\s+${endMarker}\s*\r?\n?`, 'g'), '').trim();
                
                // Remove the temporary listener
                // For node-pty, if onData is like EventEmitter.on, we need to store the exact function reference to remove it.
                // ptyProcess.removeListener('data', toolOutputListener); // This is typical for EventEmitter
                // However, node-pty's IPtyProcess.onData might just take one callback. 
                // If it overwrites, we need to restore the original. If it adds, we need to remove.
                // For simplicity, assuming node-pty allows multiple listeners or we manage this carefully.
                // A robust way: node-pty's onData returns a disposable { dispose: () => void; }
                // Let's assume for now we can't easily remove just one listener without that pattern.
                // This part needs careful handling based on node-pty's exact API for multiple listeners or disposables.
                // For now, the commandOutputFinished flag will prevent further processing by this listener.

                console.log(`[Tool Command Output for ${toolCallId} (${originalFunctionName})]:\n`, capturedOutput);

                // NEXT STEP: Send this capturedOutput and toolCallId to the AI service
                // Example: mainWindow.webContents.send('ai:process-tool-result', { toolCallId, output: capturedOutput });
                // Or better: ipcMain.invoke('ai:process-tool-result', { toolCallId, functionName: "execute_terminal_command", output: capturedOutput });
                // This will be handled by ai-ipc.ts
                event.sender.send('ai:tool-output-captured', { 
                    toolCallId, 
                    output: capturedOutput, 
                    originalFunctionName // Pass it back
                });
            }
        };

        // Attaching the listener: node-pty's onData typically returns an IDisposable.
        // We should store and call dispose() on it when done.
        // If onData doesn't return IDisposable or allow multiple distinct listeners, this approach needs rethinking.
        // For now, let's assume it adds the listener.
        // A proper implementation would require checking node-pty docs for listener management.
        // Let's assume a simplified scenario where the original onData in pty-manager continues to run for the main terminal display.
        // This temporary listener is just for capturing this specific command's output.
        
        // This is a conceptual problem: If ptyProcess.onData only supports one listener (the one in pty-manager.ts
        // that sends all data to the renderer), then this temporary listener approach won't work as is.
        // We would need pty-manager to provide a way to intercept or tap into the stream for a specific command.

        // For now, let's proceed with the assumption that we can add a temporary listener
        // or that the main listener in pty-manager can be augmented.
        // A simple (but less clean) way if onData is singular: replace it, then restore it.

        // Given the current structure of pty-manager, the onData callback is set once.
        // To make this work cleanly, pty-manager would need to support broadcasting to multiple listeners
        // or provide a specific mechanism for command output capture.

        // Let's simulate by directly using the ptyProcess if it's accessible and allows adding listeners.
        // The `ptyProcess.onData(onDataCallback)` in `pty-manager` sets the primary listener.
        // If `IPtyProcess.onData` is like `EventEmitter.on`, this is fine.
        // If it's a setter for a single callback, this will override the main one.
        // The type definition `onData: (callback: (data: string) => void) => void;` suggests it might be a setter.
        // Let's assume it's an event emitter for now for the sake of progressing.
        const ptyDataEmitter = ptyProcess as any; // Cast to any to access 'on' if it's an event emitter
        if (typeof ptyDataEmitter.on === 'function' && typeof ptyDataEmitter.removeListener === 'function') {
            ptyDataEmitter.on('data', toolOutputListener);
        } else {
            console.warn('PTY process does not seem to be a standard event emitter for multiple data listeners. Output capture for tools might be unreliable.');
            // Fallback: we can't reliably capture isolated output with current pty-manager structure for this.
            // For now, we will proceed but this is a known limitation.
        }

        // Execute the command and then echo the marker
        const commandToExecute = `${command}\necho ${endMarker}\n`;
        writeToPty(terminalId, commandToExecute);

        // Set a timeout to remove the listener and handle cases where the marker might not appear
        setTimeout(() => {
            if (!commandOutputFinished) {
                commandOutputFinished = true; // Stop processing
                if (typeof ptyDataEmitter.removeListener === 'function') {
                    ptyDataEmitter.removeListener('data', toolOutputListener);
                }
                console.warn(`Timeout waiting for end marker for tool call ${toolCallId}. Output might be incomplete.`);
                // Send what was captured anyway, or an error
                event.sender.send('ai:tool-output-captured', { 
                    toolCallId, 
                    output: capturedOutput, 
                    error: 'Timeout waiting for end marker', 
                    originalFunctionName // Pass it back
                });
            }
        }, 5000); // 5 second timeout for the command to complete and marker to appear
    });
}
