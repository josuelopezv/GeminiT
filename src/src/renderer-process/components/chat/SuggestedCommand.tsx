import React from 'react';
import { ParsedCommand } from '../../command-parser';

interface SuggestedCommandProps {
    command: ParsedCommand;
    onExecute: (command: ParsedCommand) => void;
}

const SuggestedCommand: React.FC<SuggestedCommandProps> = ({ command, onExecute }) => {
    return (
        <div className="chat chat-start">
            <div className="chat-header text-xs opacity-70 pb-0.5">
                System (Suggested Command)
            </div>
            <div className="chat-bubble chat-bubble-accent">
                <div className="font-mono text-xs bg-neutral text-neutral-content p-2 my-1 rounded whitespace-pre-wrap break-all">
                    {command.command}
                </div>
                <button 
                    onClick={() => onExecute(command)} 
                    className="btn btn-xs btn-primary mt-1"
                >
                    <i className="ri-play-fill"></i> Execute & Capture
                </button>
            </div>
        </div>
    );
};

export default SuggestedCommand;
