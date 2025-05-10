// src/renderer-process/components/SettingsPanelComponent.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ipcRenderer } from 'electron';
import { Logger } from '../../utils/logger';

const logger = new Logger('SettingsPanel');

interface SettingsPanelProps {
    isVisible: boolean;
    onClose: () => void;
    initialApiKey: string;
    initialModelName: string;
    initialModelInstruction: string; // New prop
    onApiKeyChange: (key: string) => void;
    onModelNameChange: (name: string) => void;
    onInitialModelInstructionChange: (instruction: string) => void; // New prop
}

const SettingsPanelComponent: React.FC<SettingsPanelProps> = ({
    isVisible,
    onClose,
    initialApiKey,
    initialModelName,
    initialModelInstruction,
    onApiKeyChange,
    onModelNameChange,
    onInitialModelInstructionChange
}) => {
    const [apiKey, setApiKey] = useState(initialApiKey || '');
    const [modelName, setModelName] = useState(initialModelName || '');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [modelInstruction, setModelInstruction] = useState(initialModelInstruction || '');
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setApiKey(initialApiKey || '');
        setModelName(initialModelName || '');
        setModelInstruction(initialModelInstruction || '');
    }, [initialApiKey, initialModelName, initialModelInstruction, isVisible]); // Added isVisible to re-sync when panel opens

    const handleFetchModels = useCallback(async () => {
        if (!apiKey) {
            setError('API key is required to fetch models.');
            setAvailableModels([]);
            return;
        }
        setIsLoadingModels(true);
        setError(null);
        try {
            const models = await ipcRenderer.invoke('settings:fetch-models', apiKey);
            setAvailableModels(models || []);
            if (!models || models.length === 0) {
                setError('No models found for this API key or an error occurred.');
            }
        } catch (err: any) {
            logger.error('Error fetching models:', err);
            setError(err.message || 'Failed to fetch models.');
            setAvailableModels([]);
        }
        setIsLoadingModels(false);
    }, [apiKey]);

    const handleSave = () => {
        ipcRenderer.send('settings:set-api-key', apiKey);
        onApiKeyChange(apiKey);
        ipcRenderer.send('settings:set-model-name', modelName);
        onModelNameChange(modelName);
        ipcRenderer.send('settings:set-initial-model-instruction', modelInstruction);
        onInitialModelInstructionChange(modelInstruction);
        onClose();
    };

    if (!isVisible) return null;

    return (
        <div className="modal modal-open"> {/* DaisyUI modal class for overlay and centering */}
            <div className="modal-box w-11/12 max-w-2xl"> {/* DaisyUI modal-box for the panel itself */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Settings</h3>
                    <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose} title="Close Settings">
                        <i className="ri-close-line text-xl"></i>
                    </button>
                </div>

                {/* API Key Input */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text">Gemini API Key</span>
                    </label>
                    <input 
                        type="password" 
                        placeholder="Enter your API Key"
                        className="input input-bordered w-full"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                    />
                </div>

                {/* Model Name Input with Fetch Button */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text">Model Name</span>
                    </label>
                    <div className="join w-full"> {/* DaisyUI join for grouping input and button */}
                        <input 
                            type="text" 
                            placeholder="e.g., gemini-1.5-flash-latest"
                            className="input input-bordered join-item w-full" // DaisyUI input and join-item
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                            list="available-models-list"
                        />
                        <button 
                            className={`btn join-item ${isLoadingModels ? 'btn-disabled' : 'btn-neutral'}`} // DaisyUI button and join-item
                            onClick={handleFetchModels}
                            disabled={isLoadingModels || !apiKey}
                        >
                            {isLoadingModels ? <span className="loading loading-spinner loading-xs"></span> : 'Fetch Models'}
                        </button>
                    </div>
                    {availableModels.length > 0 && (
                        <datalist id="available-models-list">
                            {availableModels.map(model => <option key={model} value={model} />)}
                        </datalist>
                    )}
                    <label className="label">
                        <span className="label-text-alt">Enter model name or fetch from API.</span>
                    </label>
                </div>

                {/* Initial Model Instruction Textarea */}
                <div className="form-control mb-6">
                    <label className="label">
                        <span className="label-text">Initial Model Instruction (System Prompt)</span>
                    </label>
                    <textarea 
                        className="textarea textarea-bordered h-32 w-full text-sm" // DaisyUI textarea
                        placeholder="e.g., You are a helpful AI assistant specializing in terminal commands..."
                        value={modelInstruction}
                        onChange={(e) => setModelInstruction(e.target.value)}
                    ></textarea>
                    <label className="label">
                        <span className="label-text-alt">This instruction is sent to the model when a new chat session starts.</span>
                    </label>
                </div>

                {error && <p className="text-error text-sm mb-4">{error}</p>}

                {/* Modal Actions */}
                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanelComponent;
