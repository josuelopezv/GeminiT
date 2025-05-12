import React from 'react';

interface ChatMessageProps {
    sender: string;
    content: string;
    type?: 'command' | 'command-output' | 'error';
    id: number;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ sender, content, type, id }) => {
    return (
        <div
            key={id}
            className={`chat ${sender === 'User' || sender === 'User (Executing)' ? 'chat-end' : 'chat-start'}`}
        >
            <div className="chat-header text-xs opacity-70 pb-0.5">
                {sender}
            </div>
            <div
                className={`chat-bubble text-sm break-words whitespace-pre-wrap 
                    ${sender === 'User' || sender === 'User (Executing)'
                        ? 'chat-bubble-primary'
                        : sender === 'AI'
                            ? 'chat-bubble-secondary'
                            : type === 'error'
                                ? 'chat-bubble-error'
                                : 'chat-bubble-info'}`}
            >
                {content}
            </div>
        </div>
    );
};

export default ChatMessage;
