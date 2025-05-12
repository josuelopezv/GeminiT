import { useState, useCallback } from 'react';
import { ipcRenderer } from 'electron';
import { IAIResponse } from '../../../interfaces/ai-service.interface';
import { parseCommandsFromText, ParsedCommand } from '../../command-parser';
import { Logger } from '../../../utils/logger';

const logger = new Logger('useChatLogic');

interface Message {
    sender: string;
    content: string;
    id: number;
    type?: 'command' | 'command-output' | 'error';
}

interface UseChatLogicProps {
    terminalId: string;
    terminalHistory: string;
    apiKeyStatus: { isValid: boolean; key: string };
    currentModelNameFromApp: string;
    setIsSettingsPanelVisible: (visible: boolean) => void;
}

export const useChatLogic = ({
    terminalId,
    terminalHistory,
    apiKeyStatus,
    currentModelNameFromApp,
    setIsSettingsPanelVisible
}: UseChatLogicProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [suggestedCommands, setSuggestedCommands] = useState<ParsedCommand[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastCommandOutput, setLastCommandOutput] = useState<string | null>(null);

    const addMessage = useCallback((sender: string, content: string, type?: 'command' | 'command-output' | 'error') => {
        setMessages(prev => [...prev, { sender, content, id: Date.now() + Math.random(), type }]);
    }, []);

    const handleSendQuery = useCallback(async () => {
        if (!userInput.trim()) return;
        
        if (!apiKeyStatus.isValid) {
            addMessage('System', 'Please set your Gemini API key in settings first', 'error');
            setIsSettingsPanelVisible(true);
            return;
        }
        
        if (!currentModelNameFromApp) {
            addMessage('System', 'Please select/set a Gemini Model Name in settings first.', 'error');
            setIsSettingsPanelVisible(true);
            return;
        }

        const currentQuery = userInput;
        addMessage('User', currentQuery);
        setUserInput('');
        setSuggestedCommands([]);
        setIsProcessing(true);

        let contextForAi: string;
        let contextTypeForAi: string;

        if (lastCommandOutput !== null) {
            contextForAi = lastCommandOutput;
            contextTypeForAi = "output of the last executed command";
            setLastCommandOutput(null);
        } else {
            contextForAi = terminalHistory;
            contextTypeForAi = "general terminal activity";
        }

        try {
            const response: IAIResponse = await ipcRenderer.invoke('ai:process-query', {
                query: currentQuery,
                contextContent: contextForAi,
                contextType: contextTypeForAi
            });

            if (response.text) {
                addMessage('AI', response.text);
                const commandsFromText = parseCommandsFromText(response.text);
                if (commandsFromText.length > 0) {
                    addMessage('System', 'Found command(s) in the AI response:', 'command');
                    setSuggestedCommands(commandsFromText);
                }
            } else {
                addMessage('AI', '[AI did not provide a text response]', 'error');
            }
        } catch (error) {
            const err = error as Error;
            addMessage('Error', err.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    }, [userInput, apiKeyStatus.isValid, currentModelNameFromApp, terminalHistory, lastCommandOutput, addMessage, setIsSettingsPanelVisible]);

    const handleExecuteSuggestedCommand = useCallback(async (command: ParsedCommand) => {
        addMessage('User (Executing)', command.command, 'command');
        setSuggestedCommands(prev => prev.filter(p => p.command !== command.command));
        setIsProcessing(true);

        try {
            const result = await ipcRenderer.invoke('terminal:execute-and-capture-output', {
                command: command.command,
                terminalId
            });

            if (result.error) {
                addMessage('System', `Error executing command "${command.command}": ${result.error}`, 'error');
                setLastCommandOutput(`Error executing command "${command.command}": ${result.error}`);
            } else {
                addMessage('System', `Output of "${command.command}":\n${result.output || '(No output)'}`, 'command-output');
                setLastCommandOutput(result.output || '(No output)');
            }
        } catch (ipcError) {
            const err = ipcError as Error;
            addMessage('System', `Failed to execute command "${command.command}": ${err.message}`, 'error');
            setLastCommandOutput(`Failed to execute command "${command.command}": ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    }, [terminalId, addMessage]);

    return {
        messages,
        suggestedCommands,
        userInput,
        isProcessing,
        setUserInput,
        handleSendQuery,
        handleExecuteSuggestedCommand,
    };
};

export type UseChatLogicReturn = ReturnType<typeof useChatLogic>;
