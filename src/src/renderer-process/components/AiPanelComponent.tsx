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
  const [userInput, setUserInput] = useState(''); // Renamed from aiQuery for clarity
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const [chatMessages, setChatMessages] = useState<{sender: string, content: string, id: number, type?: 'command' | 'command-output' | 'error'}[]>([]);
  const [suggestedCommands, setSuggestedCommands] = useState<ParsedCommand[]>([]);
  const [lastCommandOutput, setLastCommandOutput] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (chatHistoryRef.current) {
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatMessages, suggestedCommands]);

  const addChatMessage = useCallback((sender: string, content: string, type?: 'command' | 'command-output' | 'error') => {
    setChatMessages(prev => [...prev, { sender, content, id: Date.now() + Math.random(), type }]);
  }, []);

  const handleSendQuery = async () => {
    if (!userInput.trim()) return;
    if (!apiKeyStatus.isValid) {
      addChatMessage('System', 'Please set your Gemini API key in settings first', 'error');
      setIsSettingsPanelVisible(true);
      return;
    }
    if (!currentModelNameFromApp) {
      addChatMessage('System', 'Please select/set a Gemini Model Name in settings first.', 'error');
      setIsSettingsPanelVisible(true);
      return;
    }

    const currentQuery = userInput;
    addChatMessage('User', currentQuery);
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

    logger.debug(`Sending to AI with context type: ${contextTypeForAi}`);

    try {
      const response: IAIResponse = await ipcRenderer.invoke('ai:process-query', {
        query: currentQuery,
        contextContent: contextForAi,
        contextType: contextTypeForAi
      });

      if (response.text) {
        addChatMessage('AI', response.text);
        const commandsFromText = parseCommandsFromText(response.text);
        if (commandsFromText.length > 0) {
          addChatMessage('System', 'Found command(s) in the AI response:', 'command');
          setSuggestedCommands(commandsFromText);
        }
      } else {
        addChatMessage('AI', '[AI did not provide a text response]', 'error');
      }
    } catch (error) {
      const err = error as Error;
      addChatMessage('Error', err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteSuggestedCommand = async (command: ParsedCommand) => {
    addChatMessage('User (Executing)', command.command, 'command');
    setSuggestedCommands(prev => prev.filter(p => p.command !== command.command));
    setIsProcessing(true);
    
    try {
      const result = await ipcRenderer.invoke('terminal:execute-and-capture-output', {
        command: command.command,
        terminalId
      });

      if (result.error) {
        addChatMessage('System', `Error executing command "${command.command}": ${result.error}`, 'error');
        setLastCommandOutput(`Error executing command "${command.command}": ${result.error}`);
      } else {
        addChatMessage('System', `Output of "${command.command}":\n${result.output || '(No output)'}`, 'command-output');
        setLastCommandOutput(result.output || '(No output)');
      }
    } catch (ipcError) {
      const err = ipcError as Error;
      addChatMessage('System', `Failed to execute command "${command.command}": ${err.message}`, 'error');
      setLastCommandOutput(`Failed to execute command "${command.command}": ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isProcessing) {
      handleSendQuery();
    }
  };

  return (
    <div className="h-full flex flex-col p-2 bg-base-100 text-base-content">
      {/* Header */}
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-base-300">
        <h2 className="text-lg font-semibold">AI Assistant</h2>
        <button 
          onClick={() => setIsSettingsPanelVisible(true)} 
          className="btn btn-sm btn-ghost btn-circle"
          title="Settings"
        >
          <i className="ri-settings-3-line text-xl"></i>
        </button>
      </div>

      {/* Chat History - Using DaisyUI chat component structure */}
      <div ref={chatHistoryRef} className="flex-grow overflow-y-auto mb-2 space-y-2 p-1 scrollable-content">
        {chatMessages.map((msg) => (
          <div 
            key={msg.id} 
            className={`chat ${msg.sender === 'User' || msg.sender === 'User (Executing)' ? 'chat-end' : 'chat-start'}`}
          >
            <div className="chat-header text-xs opacity-70 pb-0.5">
              {msg.sender}
            </div>
            <div 
              className={`chat-bubble text-sm break-words whitespace-pre-wrap 
                          ${msg.sender === 'User' || msg.sender === 'User (Executing)' 
                              ? 'chat-bubble-primary' 
                              : msg.sender === 'AI' 
                                  ? 'chat-bubble-secondary' 
                                  : msg.type === 'error'
                                      ? 'chat-bubble-error'
                                      : 'chat-bubble-info'}
                          `}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {suggestedCommands.map((pCmd, index) => (
          <div key={`cmd-${index}`} className="chat chat-start">
            <div className="chat-header text-xs opacity-70 pb-0.5">
              System (Suggested Command)
            </div>
            <div className="chat-bubble chat-bubble-accent">
              <div className="font-mono text-xs bg-neutral text-neutral-content p-2 my-1 rounded whitespace-pre-wrap break-all">{pCmd.command}</div>
              <button onClick={() => handleExecuteSuggestedCommand(pCmd)} className="btn btn-xs btn-primary mt-1">
                <i className="ri-play-fill"></i> Execute & Capture
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="mt-auto pt-2 border-t border-base-300">
        <div className="join w-full">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask the AI..."
            className="input input-bordered join-item w-full focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isProcessing || !apiKeyStatus.isValid || !currentModelNameFromApp}
          />
          <button
            onClick={handleSendQuery}
            // Add loading state to the button
            className={`btn btn-primary join-item ${isProcessing ? 'cursor-not-allowed' : ''}`}
            disabled={isProcessing || !apiKeyStatus.isValid || !currentModelNameFromApp}
            title="Send"
          >
            {isProcessing ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <i className="ri-send-plane-2-fill text-lg"></i>
            )}
          </button>
        </div>
        {(!apiKeyStatus.isValid || !currentModelNameFromApp) && (
          <div className="text-xs text-error mt-1">
            {!apiKeyStatus.isValid ? "API Key not set. " : ""}
            {!currentModelNameFromApp ? "Model not selected. " : ""}
            Please configure in Settings.
          </div>
        )}
      </div>
    </div>
  );
};

export default AiPanelComponent;
