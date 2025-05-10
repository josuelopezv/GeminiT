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

        try {
            const response: IAIResponse = await ipcRenderer.invoke('ai:process-query', {
                query: currentQuery,
                terminalHistory // This comes from App.tsx props
            });

            // With the new approach, AIService always returns a text response.
            // Any command suggestions (even if originally a tool call) will be embedded in this text.
            if (response.text) {
                addMessage('AI', response.text);
                const commandsFromText = parseCommandsFromText(response.text);
                if (commandsFromText.length > 0) {
                    // We can optionally add a system message here if we want to differentiate
                    // commands that were originally tool calls vs. just text suggestions.
                    // For now, treat all parsed commands the same.
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

    const handleExecuteParsedCommand = (command: ParsedCommand) => {
        addMessage('User (Execute)', command.command);
        ipcRenderer.send('terminal:input', {
            id: terminalId,
            data: command.command + '\r'
        });
        setParsedCommands(prev => prev.filter(p => p.command !== command.command));
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
                    ⚙️
                </button>
            </div>
            <div ref={aiOutputRef} className="flex-1 overflow-y-auto bg-gray-800 p-2 rounded mb-2 text-sm space-y-2">
                {messages.map(msg => (
                    <div key={msg.id}>
                        <strong>{msg.sender}:</strong> {msg.content}
                    </div>
                ))}
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
