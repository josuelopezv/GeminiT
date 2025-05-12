import React from 'react';

interface ApiKeyInputProps {
    apiKey: string;
    onChange: (value: string) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ apiKey, onChange }) => {
    return (
        <div className="form-control mb-4">
            <label className="label">
                <span className="label-text">Gemini API Key</span>
            </label>
            <input 
                type="password" 
                placeholder="Enter your API Key"
                className="input input-bordered w-full"
                value={apiKey}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
};

export default ApiKeyInput;
