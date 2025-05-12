import React from 'react';

interface InitialInstructionInputProps {
    modelInstruction: string;
    onChange: (value: string) => void;
}

const InitialInstructionInput: React.FC<InitialInstructionInputProps> = ({
    modelInstruction,
    onChange
}) => {
    return (
        <div className="form-control mb-6">
            <label className="label">
                <span className="label-text">Initial Model Instruction (System Prompt)</span>
            </label>
            <textarea 
                className="textarea textarea-bordered h-32 w-full text-sm"
                placeholder="e.g., You are a helpful AI assistant specializing in terminal commands..."
                value={modelInstruction}
                onChange={(e) => onChange(e.target.value)}
            ></textarea>
            <label className="label">
                <span className="label-text-alt">This instruction is sent to the model when a new chat session starts.</span>
            </label>
        </div>
    );
};

export default InitialInstructionInput;
