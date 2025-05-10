import { ipcMain } from 'electron';
import * as os from 'os';
import { spawnPtyProcess, writeToPty, resizePty, shells, IPtyProcess } from '../pty-manager';
import { getMainWindow } from '../window-manager';
import { IDisposable } from 'node-pty'; // Import IDisposable

// Utility to strip ANSI escape codes and other common control characters like backspace.
function stripAnsiCodes(str: string): string {
    const ansiRegex = /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
    let cleanedStr = str.replace(ansiRegex, '');
    cleanedStr = cleanedStr.replace(/\b/g, ''); // Remove backspace characters
    // Add removal of carriage return if it's causing issues, but be cautious as it might be legitimate line ending
    // cleanedStr = cleanedStr.replace(/\r/g, ''); 
    return cleanedStr;
}

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
        { command: string; toolCallId: string; terminalId: string; originalFunctionName: string }
    ) => {
        const mainWindow = getMainWindow();
        if (!mainWindow) return;

        const ptyProcess = shells.get(terminalId);
        if (!ptyProcess) {
            console.error(`PTY process not found for terminal ID: ${terminalId}`);
            event.sender.send('ai:tool-output-captured', { toolCallId, error: 'PTY process not found', originalFunctionName });
            return;
        }

        const endMarker = `__TOOL_CMD_OUTPUT_END_${Date.now()}_${toolCallId}__`;
        let capturedOutput = '';
        let commandOutputFinished = false;
        let dataListenerDisposable: IDisposable | null = null;

        const commandLinesSent = command.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        const printfCommandSent = `printf "%s\n" "${endMarker}"`.trim();
        const commandToExecuteWithMarker = `${command}\n${printfCommandSent}\n`;
        
        console.log(`[DEBUG ${toolCallId}] User command lines:`, commandLinesSent);
        console.log(`[DEBUG ${toolCallId}] Printf command:`, printfCommandSent);
        console.log(`[DEBUG ${toolCallId}] Executing with marker: ${JSON.stringify(commandToExecuteWithMarker)}`);

        const toolOutputListener = (data: string) => {
            if (commandOutputFinished) return;
            // console.log(`[DEBUG ${toolCallId}] Raw data chunk received: ${JSON.stringify(data)}`);
            capturedOutput += data;
            // console.log(`[DEBUG ${toolCallId}] Accumulated capturedOutput (before marker check): ${JSON.stringify(capturedOutput)}`);

            const markerIndex = capturedOutput.indexOf(endMarker);

            if (markerIndex !== -1) {
                console.log(`[DEBUG ${toolCallId}] End marker found at index: ${markerIndex}`);
                commandOutputFinished = true;
                if (dataListenerDisposable) {
                    dataListenerDisposable.dispose();
                    dataListenerDisposable = null;
                }

                let outputBeforeMarker = capturedOutput.substring(0, markerIndex);
                console.log(`[DEBUG ${toolCallId}] Output before ANSI stripping (substring to marker): ${JSON.stringify(outputBeforeMarker)}`);
                let strippedOutput = stripAnsiCodes(outputBeforeMarker);
                console.log(`[DEBUG ${toolCallId}] Output after ANSI stripping: ${JSON.stringify(strippedOutput)}`);

                const lines = strippedOutput.split(/\r?\n/);
                const cleanedLines: string[] = [];
                console.log(`[DEBUG ${toolCallId}] Lines before echo/prompt cleaning:`, lines);

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    let lineToKeep = true;

                    // Check if the line exactly matches any of the sent command lines
                    if (commandLinesSent.includes(trimmedLine)) {
                        console.log(`[DEBUG ${toolCallId}] Discarding line (exact match to sent command): ${JSON.stringify(line)}`);
                        lineToKeep = false;
                    }
                    // Check if the line exactly matches the printf command
                    else if (trimmedLine === printfCommandSent) {
                        console.log(`[DEBUG ${toolCallId}] Discarding line (exact match to printf command): ${JSON.stringify(line)}`);
                        lineToKeep = false;
                    }
                    // A very basic prompt removal (e.g., lines ending with > or $ followed by space)
                    // This is highly heuristic and might remove legitimate output.
                    // else if (trimmedLine.match(/^[^a-zA-Z0-9]*[>#\$]\s*$/) && lines.indexOf(line) === 0) {
                    //     console.log(`[DEBUG ${toolCallId}] Discarding line (looks like a prompt at start): ${JSON.stringify(line)}`);
                    //     lineToKeep = false;
                    // }

                    if (lineToKeep) {
                        cleanedLines.push(line); // Keep the original line, not trimmed, to preserve formatting if any
                    }
                }
                let finalOutput = cleanedLines.join('\n').trim(); // Trim overall, but individual lines retain their space if not prompts
                console.log(`[DEBUG ${toolCallId}] Output after echo/prompt cleaning: ${JSON.stringify(finalOutput)}`);

                console.log(`[Tool Command Output for ${toolCallId} (${originalFunctionName})]:\n'${finalOutput}'`);
                event.sender.send('ai:tool-output-captured', { 
                    toolCallId, 
                    output: finalOutput, 
                    originalFunctionName
                });
            }
        };

        // Attach the listener using ptyProcess.onData which returns IDisposable
        try {
            dataListenerDisposable = ptyProcess.onData(toolOutputListener);
        } catch (e) {
            console.error('Error attaching data listener to PTY:', e);
            event.sender.send('ai:tool-output-captured', { 
                toolCallId, 
                error: 'Cannot attach listener to PTY for output capture.', 
                originalFunctionName 
            });
            return;
        }
        
        writeToPty(terminalId, commandToExecuteWithMarker);

        setTimeout(() => {
            if (!commandOutputFinished) {
                commandOutputFinished = true; 
                if (dataListenerDisposable) {
                    dataListenerDisposable.dispose();
                    dataListenerDisposable = null;
                }
                console.log(`[DEBUG ${toolCallId}] Timeout occurred. Initial capturedOutput: ${JSON.stringify(capturedOutput)}`);
                let timedOutOutput = stripAnsiCodes(capturedOutput);
                const markerIdx = timedOutOutput.indexOf(endMarker);
                if (markerIdx !== -1) {
                    timedOutOutput = timedOutOutput.substring(0, markerIdx);
                }
                // Apply a simplified cleaning for timeout
                const lines = timedOutOutput.split(/\r?\n/);
                const cleanedLines: string[] = [];
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!commandLinesSent.includes(trimmedLine) && trimmedLine !== printfCommandSent && !trimmedLine.includes(endMarker)) {
                        cleanedLines.push(line);
                    }
                }
                timedOutOutput = cleanedLines.join('\n').trim();
                console.log(`[DEBUG ${toolCallId}] Timeout: Output after final cleaning: ${JSON.stringify(timedOutOutput)}`);

                console.warn(`Timeout waiting for end marker for tool call ${toolCallId}. Output might be incomplete: '${timedOutOutput}'`);
                event.sender.send('ai:tool-output-captured', { 
                    toolCallId, 
                    output: timedOutOutput,
                    error: 'Timeout waiting for end marker', 
                    originalFunctionName
                });
            }
        }, 7000);
    });
}
