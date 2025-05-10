// src/renderer-process/components/SettingsPanelComponent.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    const dialogRef = useRef<HTMLDialogElement>(null); // Ref for the dialog element

    useEffect(() => {
        setApiKey(initialApiKey || '');
        setModelName(initialModelName || '');
        setModelInstruction(initialModelInstruction || '');
    }, [initialApiKey, initialModelName, initialModelInstruction, isVisible]); // Added isVisible to re-sync when panel opens

    // Effect to control modal visibility using dialog API
    useEffect(() => {
        const dialogNode = dialogRef.current;
        if (dialogNode) {
            if (isVisible) {
                dialogNode.showModal();
            } else {
                dialogNode.close();
            }
        }
    }, [isVisible]);

    const handleDialogClose = () => {
        // This can be triggered by ESC key or backdrop click (if not prevented)
        // Call the onClose prop to sync state with App.tsx
        onClose();
    };

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
        onClose(); // This will trigger the useEffect to close the dialog
    };

    // We no longer return null; the dialog element is always in the DOM but hidden/shown by its API.
    // The `isVisible` prop now controls it via useEffect.

    return (
        // Changed div to dialog and removed modal-open. Added ref and onCancel/onClose handlers.
        <dialog ref={dialogRef} className="modal" onClose={handleDialogClose} onCancel={handleDialogClose}>
            {/* Added text-base-content to ensure text contrasts with modal background */}
            <div className="modal-box w-11/12 max-w-2xl text-base-content">
                <form method="dialog"> {/* Optional: form with method="dialog" allows buttons to close the dialog */}
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold">Settings</h3>
                        {/* This button can now use method="dialog" to close the modal if inside the form */}
                        <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose} title="Close Settings">
                            <i className="ri-close-line text-xl"></i>
                        </button>
                    </div>
                </form> {/* Closing the optional form early if only for the close button */}

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

                {/* Model Name Dropdown with Fetch Button */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text">Model Name</span>
                    </label>
                    <div className="join w-full"> {/* DaisyUI join for grouping select and button */}
                        <select 
                            className="select select-bordered join-item w-full" // DaisyUI select and join-item
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                            disabled={isLoadingModels || availableModels.length === 0}
                        >
                            {availableModels.length === 0 && !isLoadingModels && <option value="" disabled>No models loaded. Fetch first.</option>}
                            {availableModels.length === 0 && isLoadingModels && <option value="" disabled>Loading models...</option>}
                            {availableModels.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                        <button 
                            className={`btn join-item ${isLoadingModels ? 'btn-disabled' : 'btn-neutral'}`} // DaisyUI button and join-item
                            onClick={handleFetchModels}
                            disabled={isLoadingModels || !apiKey}
                        >
                            {isLoadingModels ? <span className="loading loading-spinner loading-xs"></span> : 'Fetch Models'}
                        </button>
                    </div>
                    {/* Datalist and input with list attribute are no longer needed */}
                    <label className="label">
                        <span className="label-text-alt">Select a model from the list. Use 'Fetch Models' if the list is empty or needs update.</span>
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
                    {/* Button to close the dialog, can also be part of the form with method="dialog" */}
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
                </div>
            </div>
            {/* Optional: Backdrop click to close, if not using a form with method="dialog" for the main content area */}
            {/* <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form> */}
        </dialog>
    );
};

export default SettingsPanelComponent;
