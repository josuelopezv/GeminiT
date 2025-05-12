import React from 'react';

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    isDisabled: boolean;
    isProcessing: boolean;
    errorMessage?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
    value,
    onChange,
    onSend,
    isDisabled,
    isProcessing,
    errorMessage
}) => {
    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !isProcessing && !isDisabled) {
            onSend();
        }
    };

    return (
        <div className="mt-auto pt-2 border-t border-base-300">
            <div className="join w-full">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask the AI..."
                    className="input input-bordered join-item w-full focus:outline-none focus:ring-1 focus:ring-primary"
                    disabled={isDisabled || isProcessing}
                />
                <button
                    onClick={onSend}
                    className={`btn btn-primary join-item ${isProcessing ? 'cursor-not-allowed' : ''}`}
                    disabled={isDisabled || isProcessing}
                    title="Send"
                >
                    {isProcessing ? (
                        <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                        <i className="ri-send-plane-2-fill text-lg"></i>
                    )}
                </button>
            </div>
            {errorMessage && (
                <div className="text-xs text-error mt-1">
                    {errorMessage}
                </div>
            )}
        </div>
    );
};

export default ChatInput;
