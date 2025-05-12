import React, { useRef, useEffect } from 'react';
import { useChatLogic } from '../hooks/chat/useChatLogic';
import ChatHistory from './chat/ChatHistory';
import ChatInput from './chat/ChatInput';

interface AiPanelProps {
    terminalId: string;
    terminalHistory: string;
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
    const chatHistoryRef = useRef<HTMLDivElement>(null);
    const {
        messages,
        suggestedCommands,
        userInput,
        isProcessing,
        setUserInput,
        handleSendQuery,
        handleExecuteSuggestedCommand,
    } = useChatLogic({
        terminalId,
        terminalHistory,
        apiKeyStatus,
        currentModelNameFromApp,
        setIsSettingsPanelVisible
    });

    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [messages, suggestedCommands]);

    const getErrorMessage = () => {
        if (!apiKeyStatus.isValid) return "API Key not set. ";
        if (!currentModelNameFromApp) return "Model not selected. ";
        return "";
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

            {/* Chat History */}
            <ChatHistory
                messages={messages}
                suggestedCommands={suggestedCommands}
                onExecuteCommand={handleExecuteSuggestedCommand}
            />

            {/* Input Area */}
            <ChatInput
                value={userInput}
                onChange={setUserInput}
                onSend={handleSendQuery}
                isDisabled={!apiKeyStatus.isValid || !currentModelNameFromApp}
                isProcessing={isProcessing}
                errorMessage={getErrorMessage()}
            />
        </div>
    );
};

export default AiPanelComponent;
