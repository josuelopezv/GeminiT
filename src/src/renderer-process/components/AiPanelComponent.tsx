// src/renderer-process/components/AiPanelComponent.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ipcRenderer } from 'electron';
import { IAIResponse } from '../../interfaces/ai-service.interface';
import { parseCommandsFromText, ParsedCommand } from '../command-parser';
import { Logger } from '../../utils/logger'; // Assuming logger is available for renderer too, or use console

// If using a shared logger, initialize it. Otherwise, console.log/warn/error for renderer.
const logger = new Logger('AiPanelComponent');

interface AiPanelProps {
    terminalId: string;
    terminalHistory: string; // General terminal history
    isSettingsPanelVisible: boolean; 
    setIsSettingsPanelVisible: (visible: boolean) => void;
    apiKeyStatus: { isValid: boolean; key: string };
    currentModelNameFromApp: string;
}

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
    const [lastExecutedCommandOutput, setLastExecutedCommandOutput] = useState<string | null>(null);

    useEffect(() => {
        if (aiOutputRef.current) {
            aiOutputRef.current.scrollTop = aiOutputRef.current.scrollHeight;
        }
    }, [messages, parsedCommands]);

    const addMessage = useCallback((sender: string, content: string) => {
        setMessages(prev => [...prev, { sender, content, id: Date.now() + Math.random() }]);
    }, []);

    const processAiQueryHandler = async () => {
        if (!aiQuery.trim()) return;
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

        let contextForAi: string;
        let contextTypeForAi: string;

        if (lastExecutedCommandOutput !== null) {
            contextForAi = lastExecutedCommandOutput;
            contextTypeForAi = "output of the last executed command";
            setLastExecutedCommandOutput(null); // Consume it
        } else {
            contextForAi = terminalHistory; // General history from props
            contextTypeForAi = "general terminal activity";
        }

        logger.debug(`Sending to AI with context type: ${contextTypeForAi}`);

        try {
            const response: IAIResponse = await ipcRenderer.invoke('ai:process-query', {
                query: currentQuery,
                contextContent: contextForAi, // Changed from terminalHistory
                contextType: contextTypeForAi  // New field
            });

            if (response.text) {
                addMessage('AI', response.text);
                const commandsFromText = parseCommandsFromText(response.text);
                if (commandsFromText.length > 0) {
                    addMessage('System', 'Found command(s) in the AI response:');
                    setParsedCommands(commandsFromText);
                }
            } else {
                addMessage('AI', '[AI did not provide a text response]');
            }
        } catch (error) {
            const err = error as Error;
            addMessage('Error', err.message);
        }
    };

    const handleExecuteParsedCommand = async (command: ParsedCommand) => {
        addMessage('User (Executing)', command.command);
        setParsedCommands(prev => prev.filter(p => p.command !== command.command)); // Remove executed command from suggestions
        
        try {
            const result = await ipcRenderer.invoke('terminal:execute-and-capture-output', {
                command: command.command,
                terminalId
            });

            if (result.error) {
                addMessage('System', `Error executing command "${command.command}": ${result.error}`);
                setLastExecutedCommandOutput(`Error executing command "${command.command}": ${result.error}`);
            } else {
                addMessage('System', `Output of "${command.command}":\n${result.output || '(No output)'}`);
                setLastExecutedCommandOutput(result.output || '(No output)');
            }
            // Now, the user can type a follow-up query, and `lastExecutedCommandOutput` will be used as context.
            // Or, we could automatically send a follow-up query like "What does this output mean?"
            // For now, let user type next query.

        } catch (ipcError) {
            const err = ipcError as Error;
            addMessage('System', `Failed to execute command "${command.command}": ${err.message}`);
            setLastExecutedCommandOutput(`Failed to execute command "${command.command}": ${err.message}`);
        }
    };

    return (
        <div className="w-full h-full flex flex-col p-2 bg-gray-700 text-white">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                <button 
                    onClick={() => setIsSettingsPanelVisible(true)} 
                    className="p-1 hover:bg-gray-600 rounded text-xl"
                    title="Settings"
                >
                    <i className="ri-settings-3-line"></i>
                </button>
            </div>
            <div ref={aiOutputRef} className="flex-1 overflow-y-auto bg-gray-800 p-2 rounded mb-2 text-sm space-y-2">
                {messages.map(msg => (
                    <div key={msg.id}>
                        <strong>{msg.sender}:</strong> <span style={{whiteSpace: "pre-wrap"}}>{msg.content}</span>
                    </div>
                ))}
                {parsedCommands.map((pCmd, index) => (
                    <div key={index} className="suggested-command bg-gray-750 p-3 rounded my-2 border border-gray-600">
                        <div>Suggested command{pCmd.lang ? ` (${pCmd.lang})` : ''}:</div>
                        <div className="command-text bg-gray-900 p-2 my-1 rounded font-mono">{pCmd.command}</div>
                        <button onClick={() => handleExecuteParsedCommand(pCmd)} className="execute-parsed-btn bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded mt-2">Execute & Capture Output</button>
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
                    className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-sm flex items-center justify-center" // Added flex for icon centering
                    title="Send"
                >
                    <i className="ri-send-plane-2-fill"></i> {/* Changed to Remix Icon */}
                </button>
            </div>
        </div>
    );
};

export default AiPanelComponent;
