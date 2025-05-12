import React from 'react';
import ChatMessage from './ChatMessage';
import SuggestedCommand from './SuggestedCommand';
import { ParsedCommand } from '../../command-parser';

interface Message {
    sender: string;
    content: string;
    id: number;
    type?: 'command' | 'command-output' | 'error';
}

interface ChatHistoryProps {
    messages: Message[];
    suggestedCommands: ParsedCommand[];
    onExecuteCommand: (command: ParsedCommand) => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
    messages,
    suggestedCommands,
    onExecuteCommand
}) => {
    return (
        <div className="flex-grow overflow-y-auto mb-2 space-y-2 p-1 scrollable-content">
            {messages.map((msg) => (
                <ChatMessage
                    key={msg.id}
                    sender={msg.sender}
                    content={msg.content}
                    type={msg.type}
                    id={msg.id}
                />
            ))}
            {suggestedCommands.map((cmd, index) => (
                <SuggestedCommand
                    key={`cmd-${index}`}
                    command={cmd}
                    onExecute={onExecuteCommand}
                />
            ))}
        </div>
    );
};

export default ChatHistory;
