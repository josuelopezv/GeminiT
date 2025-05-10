import { IPtyProcess } from './pty-manager'; 
import { IDisposable } from 'node-pty';
import { stripAnsiCodes } from '../utils/string-utils';
import { Logger } from '../utils/logger'; // Import Logger

const logger = new Logger('CmdOutputCapturer'); // Create a logger instance for this module

export interface CaptureCommandOutputResult {
    output?: string;
    error?: string;
}

export function captureCommandOutput(
    ptyProcess: IPtyProcess,
    toolCallId: string, 
    commandLinesSent: string[], 
    markerCommandSent: string, 
    endMarker: string,
    timeoutDuration: number = 7000
): Promise<CaptureCommandOutputResult> {
    return new Promise((resolve) => {
        let capturedOutput = '';
        let commandOutputFinished = false;
        let dataListenerDisposable: IDisposable | null = null;

        logger.debug(`[${toolCallId}] Starting capture. End marker: ${endMarker}`);

        const toolOutputListener = (data: string) => {
            if (commandOutputFinished) return;
            logger.debug(`[${toolCallId}] Raw data chunk:`, data); // Use logger, pass data as arg for better formatting
            capturedOutput += data;
            logger.debug(`[${toolCallId}] Accumulated:`, capturedOutput);

            const markerIndex = capturedOutput.indexOf(endMarker);
            if (markerIndex !== -1) {
                logger.debug(`[${toolCallId}] End marker found.`);
                commandOutputFinished = true;
                if (dataListenerDisposable) {
                    dataListenerDisposable.dispose();
                }

                let outputBeforeMarker = capturedOutput.substring(0, markerIndex);
                logger.debug(`[${toolCallId}] Before ANSI strip:`, outputBeforeMarker);
                let strippedOutput = stripAnsiCodes(outputBeforeMarker); // stripAnsiCodes still uses its own console.logs
                logger.debug(`[${toolCallId}] After ANSI strip:`, strippedOutput);

                const lines = strippedOutput.split(/\r?\n/);
                const cleanedLines: string[] = [];
                logger.debug(`[${toolCallId}] Lines for echo cleaning:`, lines);

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    let lineToKeep = true;
                    if (commandLinesSent.includes(trimmedLine)) {
                        logger.debug(`[${toolCallId}] Discarding (user cmd):`, line);
                        lineToKeep = false;
                    } else if (trimmedLine === markerCommandSent.trim()) {
                        logger.debug(`[${toolCallId}] Discarding (marker cmd):`, line);
                        lineToKeep = false;
                    }
                    if (lineToKeep) {
                        cleanedLines.push(line);
                    }
                }
                let finalOutput = cleanedLines.join('\n').trim();
                logger.debug(`[${toolCallId}] Final cleaned output:`, finalOutput);
                resolve({ output: finalOutput });
            }
        };

        try {
            dataListenerDisposable = ptyProcess.onData(toolOutputListener);
        } catch (e) {
            logger.error(`[${toolCallId}] Error attaching PTY data listener:`, e);
            resolve({ error: 'Cannot attach listener to PTY for output capture.' });
            return;
        }

        const timeoutId = setTimeout(() => {
            if (!commandOutputFinished) {
                logger.warn(`[${toolCallId}] Timeout waiting for end marker.`);
                commandOutputFinished = true;
                if (dataListenerDisposable) {
                    dataListenerDisposable.dispose();
                }
                logger.debug(`[${toolCallId}] Timeout: Initial capturedOutput:`, capturedOutput);
                let timedOutOutput = stripAnsiCodes(capturedOutput);
                logger.debug(`[${toolCallId}] Timeout: Output after stripAnsiCodes:`, timedOutOutput);
                const markerIdx = timedOutOutput.indexOf(endMarker);
                if (markerIdx !== -1) {
                    timedOutOutput = timedOutOutput.substring(0, markerIdx);
                }
                logger.debug(`[${toolCallId}] Timeout: Output after marker substring:`, timedOutOutput);
                const lines = timedOutOutput.split(/\r?\n/);
                const cleanedLines: string[] = [];
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!commandLinesSent.includes(trimmedLine) && trimmedLine !== markerCommandSent.trim() && !trimmedLine.includes(endMarker)) {
                        cleanedLines.push(line);
                    }
                }
                timedOutOutput = cleanedLines.join('\n').trim();
                logger.debug(`[${toolCallId}] Timeout: Final cleaned output:`, timedOutOutput);
                resolve({ output: timedOutOutput, error: 'Timeout waiting for end marker' });
            }
        }, timeoutDuration);
    });
}
