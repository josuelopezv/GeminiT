import { ipcRenderer } from 'electron';
import * as DOM from './dom-elements';
import { appendMessage } from './ui-utils';
import { terminalId, terminalHistory } from './terminal-setup';
import { getHasValidApiKey, getCurrentModelName } from './settings-ui';
import { IAIResponse } from '../interfaces/ai-service.interface';
import { parseCommandsFromText, ParsedCommand } from './command-parser'; // New import

function displayParsedCommand(parsedCmd: ParsedCommand) {
    if (!DOM.aiOutput) return;

    const commandDiv = document.createElement('div');
    commandDiv.className = 'suggested-command'; 
    
    let langDisplay = parsedCmd.lang ? ` (${parsedCmd.lang})` : '';
    // Ensure command text is HTML-escaped for display to prevent XSS if it somehow contains HTML
    const escapedCommand = parsedCmd.command.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    commandDiv.innerHTML = `
        <div>Suggested command${langDisplay}:</div>
        <div class="command-text">${escapedCommand}</div>
        <button class="execute-parsed-btn">Execute</button>
    `;
    DOM.aiOutput.appendChild(commandDiv);

    const executeBtn = commandDiv.querySelector('.execute-parsed-btn');
    executeBtn?.addEventListener('click', () => {
        // The command itself should be clean (already trimmed by parser)
        const commandToExecute = parsedCmd.command; 

        appendMessage('User (Execute)', commandToExecute); 
        ipcRenderer.send('terminal:input', {
            id: terminalId,
            data: commandToExecute + '\r' // Changed from '\n' to '\r' for Windows/node-pty
        });
        commandDiv.innerHTML = `<p>Sent to terminal: <code class="command-text">${escapedCommand}</code></p>`;
    });
}

function handleToolCall(toolCallId: string, functionName: string, command: string) {
    appendMessage('AI', `Suggested command: \`${command}\``);

    const approvalDiv = document.createElement('div');
    approvalDiv.className = 'command-approval';
    approvalDiv.innerHTML = `
        <div>Do you want to execute this command?</div>
        <div class="command-text">${command}</div>
        <button class="approve-btn">Approve</button>
        <button class="deny-btn">Deny</button>
    `;
    DOM.aiOutput?.appendChild(approvalDiv);
    DOM.aiOutput?.scrollTo(0, DOM.aiOutput.scrollHeight);

    const approveBtn = approvalDiv.querySelector('.approve-btn');
    const denyBtn = approvalDiv.querySelector('.deny-btn');

    approveBtn?.addEventListener('click', () => {
        approvalDiv.innerHTML = `<p>Executing: \`${command}\`...</p>`;
        ipcRenderer.send('terminal:execute-tool-command', {
            command,
            toolCallId,
            terminalId,
            originalFunctionName: functionName
        });
    });

    denyBtn?.addEventListener('click', () => {
        approvalDiv.innerHTML = `<p>Command execution denied by user.</p>`;
        // Optionally, send a denial response back to the AI
        ipcRenderer.invoke('ai:process-tool-result', {
            toolCallId,
            functionName,
            commandOutput: "User denied execution."
        }).then((aiFollowUpResponse: IAIResponse) => { // Use IAIResponse
            if (aiFollowUpResponse.text) {
                appendMessage('AI', aiFollowUpResponse.text);
            }
        }).catch(err => {
            appendMessage('Error', `AI error processing command denial: ${err.message}`);
        });
    });
}

async function processAiQuery() {
    if (!DOM.aiQueryInput?.value.trim()) return;

    if (!getHasValidApiKey()) {
        appendMessage('System', 'Please set your Gemini API key in settings first');
        DOM.settingsPanel?.classList.add('visible');
        return;
    }
    const modelName = getCurrentModelName();
    if (!modelName) {
        appendMessage('System', 'Please select/set a Gemini Model Name in settings first.');
        DOM.settingsPanel?.classList.add('visible');
        // Optionally, trigger model fetching here if settings-ui doesn't do it automatically
        return;
    }

    const query = DOM.aiQueryInput.value;
    DOM.aiQueryInput.value = '';
    appendMessage('User', query);

    try {
        const response: IAIResponse = await ipcRenderer.invoke('ai:process-query', { // Use IAIResponse
            query,
            terminalHistory
        });

        if (response.toolCall) {
            const { functionName, args, id: toolCallId } = response.toolCall;
            if (functionName === 'execute_terminal_command' && args.command) {
                handleToolCall(toolCallId, functionName, args.command);
            } else {
                appendMessage('AI', 'Received a tool call I don\'t understand.');
            }
        } else if (response.text) {
            appendMessage('AI', response.text); // Display the AI's full text response
            
            // Parse and display any commands found in the text response
            const parsedCommands = parseCommandsFromText(response.text);
            if (parsedCommands.length > 0) {
                appendMessage('System', 'Found command(s) in the AI response:');
                parsedCommands.forEach(displayParsedCommand);
            }
        }
    } catch (error) {
        const err = error as Error;
        appendMessage('Error', err.message);
    }
}

export function initializeAiInterface() {
    DOM.aiSendButton?.addEventListener('click', processAiQuery);
    DOM.aiQueryInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            processAiQuery();
        }
    });

    ipcRenderer.on('ai:tool-output-captured', (event, { toolCallId, output, error: captureError, originalFunctionName }: { toolCallId: string; output?: string; error?: string; originalFunctionName?: string }) => {
        if (captureError) {
            appendMessage('System', `Error capturing output for command (Tool ID: ${toolCallId}): ${captureError}`);
            ipcRenderer.invoke('ai:process-tool-result', {
                toolCallId,
                functionName: originalFunctionName || 'execute_terminal_command',
                commandOutput: `Error capturing output: ${captureError}`
            }).then((aiFollowUpResponse: IAIResponse) => { // Use IAIResponse
                if (aiFollowUpResponse.text) {
                    appendMessage('AI', aiFollowUpResponse.text);
                }
            }).catch(err => {
                appendMessage('Error', `AI error processing command capture error: ${err.message}`);
            });
            return;
        }
        appendMessage('System', `Output captured for command (Tool ID: ${toolCallId}). Sending to AI...`);
        ipcRenderer.invoke('ai:process-tool-result', {
            toolCallId,
            functionName: originalFunctionName || 'execute_terminal_command',
            commandOutput: output
        }).then((aiFollowUpResponse: IAIResponse) => { // Use IAIResponse
            if (aiFollowUpResponse.text) {
                appendMessage('AI', aiFollowUpResponse.text);
            } else if (aiFollowUpResponse.toolCall) {
                appendMessage('AI', `AI wants to run another command: ${aiFollowUpResponse.toolCall.args.command} (Further tool chaining not yet implemented)`);
            }
        }).catch(err => {
            appendMessage('Error', `AI error processing command output: ${err.message}`);
        });
    });
}
