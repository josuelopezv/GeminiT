import { IPtyProcess } from './pty-manager'; // Assuming IPtyProcess is exported from pty-manager
import { IDisposable } from 'node-pty';

// Utility to strip ANSI escape codes and process backspace characters.
function stripAnsiCodes(str: string): string {
    console.log(`[stripAnsiCodes INPUT]: ${JSON.stringify(str)}`);
    const ansiRegex = /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
    let cleanedStr = str.replace(ansiRegex, '');
    console.log(`[stripAnsiCodes AFTER ANSI REGEX]: ${JSON.stringify(cleanedStr)}`);

    let result = '';
    for (let i = 0; i < cleanedStr.length; i++) {
        const char = cleanedStr[i];
        const charCode = char.charCodeAt(0);
        console.log(`[stripAnsiCodes DEBUG] Char: ${JSON.stringify(char)}, Code: ${charCode}, Index: ${i}`);
        if (charCode === 8) { // BS (Backspace, char code 8)
            console.log(`[stripAnsiCodes DEBUG] Backspace (charCode 8) found. Result before slice: ${JSON.stringify(result)}`);
            if (result.length > 0) {
                result = result.slice(0, -1);
            }
        } else if (charCode < 32 && charCode !== 10 && charCode !== 13 && charCode !== 9) { // Other control characters
            console.log(`[stripAnsiCodes DEBUG] Discarding other control char: ${JSON.stringify(char)}, Code: ${charCode}`);
        } else {
            result += char;
        }
    }
    console.log(`[stripAnsiCodes FINAL RESULT]: ${JSON.stringify(result)}`);
    return result;
}

export interface CaptureCommandOutputResult {
    output?: string;
    error?: string;
}

export function captureCommandOutput(
    ptyProcess: IPtyProcess,
    toolCallId: string, // For logging
    commandLinesSent: string[], // User command split into lines, trimmed
    markerCommandSent: string, // The exact marker command string (e.g., Write-Output "END_MARKER" or printf...)
    endMarker: string,
    timeoutDuration: number = 7000
): Promise<CaptureCommandOutputResult> {
    return new Promise((resolve) => {
        let capturedOutput = '';
        let commandOutputFinished = false;
        let dataListenerDisposable: IDisposable | null = null;

        console.log(`[captureCommandOutput DEBUG ${toolCallId}] Starting capture. End marker: ${endMarker}`);

        const toolOutputListener = (data: string) => {
            if (commandOutputFinished) return;
            console.log(`[captureCommandOutput DEBUG ${toolCallId}] Raw data chunk: ${JSON.stringify(data)}`);
            capturedOutput += data;
            console.log(`[captureCommandOutput DEBUG ${toolCallId}] Accumulated: ${JSON.stringify(capturedOutput)}`);

            const markerIndex = capturedOutput.indexOf(endMarker);
            if (markerIndex !== -1) {
                console.log(`[captureCommandOutput DEBUG ${toolCallId}] End marker found.`);
                commandOutputFinished = true;
                if (dataListenerDisposable) {
                    dataListenerDisposable.dispose();
                }

                let outputBeforeMarker = capturedOutput.substring(0, markerIndex);
                console.log(`[captureCommandOutput DEBUG ${toolCallId}] Before ANSI strip: ${JSON.stringify(outputBeforeMarker)}`);
                let strippedOutput = stripAnsiCodes(outputBeforeMarker);
                console.log(`[captureCommandOutput DEBUG ${toolCallId}] After ANSI strip: ${JSON.stringify(strippedOutput)}`);

                const lines = strippedOutput.split(/\r?\n/);
                const cleanedLines: string[] = [];
                console.log(`[captureCommandOutput DEBUG ${toolCallId}] Lines for echo cleaning:`, lines);

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    let lineToKeep = true;
                    if (commandLinesSent.includes(trimmedLine)) {
                        console.log(`[captureCommandOutput DEBUG ${toolCallId}] Discarding (user cmd): ${JSON.stringify(line)}`);
                        lineToKeep = false;
                    } else if (trimmedLine === markerCommandSent.trim()) {
                        console.log(`[captureCommandOutput DEBUG ${toolCallId}] Discarding (marker cmd): ${JSON.stringify(line)}`);
                        lineToKeep = false;
                    }
                    if (lineToKeep) {
                        cleanedLines.push(line);
                    }
                }
                let finalOutput = cleanedLines.join('\n').trim();
                console.log(`[captureCommandOutput DEBUG ${toolCallId}] Final cleaned output: ${JSON.stringify(finalOutput)}`);
                resolve({ output: finalOutput });
            }
        };

        try {
            dataListenerDisposable = ptyProcess.onData(toolOutputListener);
        } catch (e) {
            console.error(`[captureCommandOutput ${toolCallId}] Error attaching PTY data listener:`, e);
            resolve({ error: 'Cannot attach listener to PTY for output capture.' });
            return;
        }

        const timeoutId = setTimeout(() => {
            if (!commandOutputFinished) {
                console.warn(`[captureCommandOutput DEBUG ${toolCallId}] Timeout waiting for end marker.`);
                commandOutputFinished = true;
                if (dataListenerDisposable) {
                    dataListenerDisposable.dispose();
                }
                console.log(`[captureCommandOutput DEBUG ${toolCallId}] Timeout: Initial capturedOutput: ${JSON.stringify(capturedOutput)}`);
                let timedOutOutput = stripAnsiCodes(capturedOutput);
                console.log(`[captureCommandOutput DEBUG ${toolCallId}] Timeout: Output after stripAnsiCodes: ${JSON.stringify(timedOutOutput)}`);
                const markerIdx = timedOutOutput.indexOf(endMarker);
                if (markerIdx !== -1) {
                    timedOutOutput = timedOutOutput.substring(0, markerIdx);
                }
                console.log(`[captureCommandOutput DEBUG ${toolCallId}] Timeout: Output after marker substring: ${JSON.stringify(timedOutOutput)}`);
                const lines = timedOutOutput.split(/\r?\n/);
                const cleanedLines: string[] = [];
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!commandLinesSent.includes(trimmedLine) && trimmedLine !== markerCommandSent.trim() && !trimmedLine.includes(endMarker)) {
                        cleanedLines.push(line);
                    }
                }
                timedOutOutput = cleanedLines.join('\n').trim();
                console.log(`[captureCommandOutput DEBUG ${toolCallId}] Timeout: Final cleaned output: ${JSON.stringify(timedOutOutput)}`);
                resolve({ output: timedOutOutput, error: 'Timeout waiting for end marker' });
            }
        }, timeoutDuration);

        // Clear timeout if resolved earlier (though not strictly necessary with commandOutputFinished flag)
        // This promise resolves when output is captured or timeout occurs.
        // The caller (terminal-ipc) is responsible for writing commands to PTY.
    });
}
