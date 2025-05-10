// src/renderer-process/components/AiPanelComponent.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useRef
import { ipcRenderer } from 'electron';
// REMOVED: import * as DOMPlaceholder from '../dom-elements';
// REMOVED: import { appendMessage as legacyAppendMessage } from '../ui-utils';
// REMOVED: import { getHasValidApiKey, getCurrentModelName } from '../settings-ui'; 
import { IAIResponse } from '../../interfaces/ai-service.interface';
import { parseCommandsFromText, ParsedCommand } from '../command-parser';

interface AiPanelProps {
    terminalId: string;
    terminalHistory: string;
    isSettingsPanelVisible: boolean; 
    setIsSettingsPanelVisible: (visible: boolean) => void;
    apiKeyStatus: { isValid: boolean; key: string }; // New prop
    currentModelNameFromApp: string; // New prop
}

// Removed temporary appendMessageToOutput as we use React state for messages

const AiPanelComponent: React.FC<AiPanelProps> = ({ 
    terminalId, 
    terminalHistory, 
    isSettingsPanelVisible, 
    setIsSettingsPanelVisible, 
    apiKeyStatus, 
    currentModelNameFromApp 
}) => {
    const [aiQuery, setAiQuery] = useState('');
    const aiOutputRef = useRef<HTMLDivElement>(null);
    const [messages, setMessages] = useState<{sender: string, content: string, id: number}[]>([]);
    const [parsedCommands, setParsedCommands] = useState<ParsedCommand[]>([]);
    const [activeToolCall, setActiveToolCall] = useState<IAIResponse['toolCall'] & { originalCommand?: string } | null>(null);

    useEffect(() => {
        if (aiOutputRef.current) {
            aiOutputRef.current.scrollTop = aiOutputRef.current.scrollHeight;
        }
    }, [messages, parsedCommands, activeToolCall]);

    const addMessage = useCallback((sender: string, content: string) => {
        setMessages(prev => [...prev, { sender, content, id: Date.now() + Math.random() }]);
    }, []);

    const handleToolCallDisplay = (toolCallId: string, functionName: string, command: string) => {
        addMessage('AI', `Suggested command: \`${command}\``);
        setActiveToolCall({ id: toolCallId, functionName, args: { command }, originalCommand: command });
        setParsedCommands([]); 
    };

    const processAiQueryHandler = async () => {
        if (!aiQuery.trim()) return;

        // Use props for API key and model name status
        if (!apiKeyStatus.isValid) {
            addMessage('System', 'Please set your Gemini API key in settings first');
            setIsSettingsPanelVisible(true);
            return;
        }
        if (!currentModelNameFromApp) {
            addMessage('System', 'Please select/set a Gemini Model Name in settings first.');
            setIsSettingsPanelVisible(true);
            return;
        }

        const currentQuery = aiQuery;
        addMessage('User', currentQuery);
        setAiQuery('');
        setParsedCommands([]);
        setActiveToolCall(null);

        try {
            const response: IAIResponse = await ipcRenderer.invoke('ai:process-query', {
                query: currentQuery,
                terminalHistory // This comes from App.tsx props
            });

            if (response.toolCall) {
                const { functionName, args, id: toolCallId } = response.toolCall;
                if (functionName === 'execute_terminal_command' && args.command) {
                    handleToolCallDisplay(toolCallId, functionName, args.command as string);
                } else {
                    addMessage('AI', 'Received a tool call I don\'t understand.');
                }
            } else if (response.text) {
                addMessage('AI', response.text);
                const commandsFromText = parseCommandsFromText(response.text);
                if (commandsFromText.length > 0) {
                    addMessage('System', 'Found command(s) in the AI response:');
                    setParsedCommands(commandsFromText);
                }
            }
        } catch (error) {
            const err = error as Error;
            addMessage('Error', err.message);
        }
    };

    const handleApproveToolCall = () => {
        if (!activeToolCall || !activeToolCall.args.command) return;
        addMessage('User (Approved)', `Executing: ${activeToolCall.args.command}`);
        ipcRenderer.send('terminal:execute-tool-command', {
            command: activeToolCall.args.command,
            toolCallId: activeToolCall.id,
            terminalId,
            originalFunctionName: activeToolCall.functionName
        });
        setActiveToolCall(null); 
    };

    const handleDenyToolCall = () => {
        if (!activeToolCall) return;
        addMessage('User (Denied)', `Execution of "${activeToolCall.originalCommand}" denied.`);
        ipcRenderer.invoke('ai:process-tool-result', {
            toolCallId: activeToolCall.id,
            functionName: activeToolCall.functionName,
            commandOutput: "User denied execution."
        }).then((aiFollowUpResponse: IAIResponse) => {
            if (aiFollowUpResponse.text) addMessage('AI', aiFollowUpResponse.text);
        }).catch(err => addMessage('Error', `AI error processing command denial: ${err.message}`));
        setActiveToolCall(null);
    };

    const handleExecuteParsedCommand = (command: ParsedCommand) => {
        addMessage('User (Execute)', command.command);
        ipcRenderer.send('terminal:input', {
            id: terminalId,
            data: command.command + '\r'
        });
        setParsedCommands(prev => prev.filter(p => p.command !== command.command));
    };

    useEffect(() => {
        const listener = (event: Electron.IpcRendererEvent, { toolCallId, output, error: captureError, originalFunctionName }: { toolCallId: string; output?: string; error?: string; originalFunctionName?: string }) => {
            if (captureError) {
                addMessage('System', `Error capturing output for command (Tool ID: ${toolCallId}): ${captureError}`);
                ipcRenderer.invoke('ai:process-tool-result', {
                    toolCallId,
                    functionName: originalFunctionName || 'execute_terminal_command',
                    commandOutput: `Error capturing output: ${captureError}`
                }).then((aiFollowUpResponse: IAIResponse) => {
                    if (aiFollowUpResponse.text) addMessage('AI', aiFollowUpResponse.text);
                }).catch(err => addMessage('Error', `AI error processing command capture error: ${err.message}`));
                return;
            }
            addMessage('System', `Output captured for command (Tool ID: ${toolCallId}). Sending to AI...`);
            ipcRenderer.invoke('ai:process-tool-result', {
                toolCallId,
                functionName: originalFunctionName || 'execute_terminal_command',
                commandOutput: output
            }).then((aiFollowUpResponse: IAIResponse) => {
                if (aiFollowUpResponse.text) {
                    addMessage('AI', aiFollowUpResponse.text);
                } else if (aiFollowUpResponse.toolCall) {
                    addMessage('AI', `AI wants to run another command: ${aiFollowUpResponse.toolCall.args.command} (Further tool chaining not yet implemented)`);
                }
            }).catch(err => addMessage('Error', `AI error processing command output: ${err.message}`));
        };
        ipcRenderer.on('ai:tool-output-captured', listener);
        return () => {
            ipcRenderer.removeListener('ai:tool-output-captured', listener);
        };
    }, [addMessage]);

    return (
        <div className="w-full h-full flex flex-col p-2 bg-gray-700 text-white">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                <button 
                    onClick={() => setIsSettingsPanelVisible(true)} 
                    className="p-1 hover:bg-gray-600 rounded text-xl"
                    title="Settings"
                >
                    ⚙️
                </button>
            </div>
            <div ref={aiOutputRef} className="flex-1 overflow-y-auto bg-gray-800 p-2 rounded mb-2 text-sm space-y-2">
                {messages.map(msg => (
                    <div key={msg.id}>
                        <strong>{msg.sender}:</strong> {msg.content}
                    </div>
                ))}
                {activeToolCall && (
                    <div className="command-approval bg-gray-750 p-3 rounded my-2 border border-gray-600">
                        <div>AI proposes to execute:</div>
                        <div className="command-text bg-gray-900 p-2 my-1 rounded font-mono">{activeToolCall.args.command}</div>
                        <div className="mt-2">
                            <button onClick={handleApproveToolCall} className="approve-btn bg-green-600 hover:bg-green-700 px-3 py-1 rounded mr-2">Approve</button>
                            <button onClick={handleDenyToolCall} className="deny-btn bg-red-600 hover:bg-red-700 px-3 py-1 rounded">Deny</button>
                        </div>
                    </div>
                )}
                {parsedCommands.map((pCmd, index) => (
                    <div key={index} className="suggested-command bg-gray-750 p-3 rounded my-2 border border-gray-600">
                        <div>Suggested command{pCmd.lang ? ` (${pCmd.lang})` : ''}:</div>
                        <div className="command-text bg-gray-900 p-2 my-1 rounded font-mono">{pCmd.command}</div>
                        <button onClick={() => handleExecuteParsedCommand(pCmd)} className="execute-parsed-btn bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded mt-2">Execute</button>
                    </div>
                ))}
            </div>
            <div className="flex gap-1 mt-auto">
                <input 
                    type="text" 
                    placeholder="Ask AI..." 
                    className="flex-1 p-2 bg-gray-600 rounded border border-gray-500 text-sm focus:ring-blue-500 focus:border-blue-500"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && processAiQueryHandler()}
                />
                <button 
                    onClick={processAiQueryHandler} 
                    className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default AiPanelComponent;
