import React, { useState, useEffect, useCallback } from 'react';
import { ipcRenderer } from 'electron';

interface SettingsPanelProps {
    isVisible: boolean;
    onClose: () => void;
    onApiKeyChange: (apiKey: string) => void; 
    onModelNameChange: (modelName: string) => void;
    initialApiKey: string;
    initialModelName: string;
}

const SettingsPanelComponent: React.FC<SettingsPanelProps> = ({
    isVisible,
    onClose,
    onApiKeyChange,
    onModelNameChange,
    initialApiKey,
    initialModelName
}) => {
    const [apiKey, setApiKey] = useState(initialApiKey || '');
    const [modelName, setModelName] = useState(initialModelName || '');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    const fetchAndSetAvailableModels = useCallback(async (currentKey: string) => {
        if (!currentKey) {
            setAvailableModels([]);
            return;
        }
        setIsLoadingModels(true);
        try {
            const models: string[] = await ipcRenderer.invoke('ai:list-models');
            setAvailableModels(models);
            if (models.length > 0 && (!modelName || !models.includes(modelName))) {
                const newModel = models[0];
                setModelName(newModel);
                onModelNameChange(newModel);
                ipcRenderer.invoke('settings:set-model-name', newModel);
            }
        } catch (error) {
            console.error('Error fetching models in SettingsPanel:', error);
            setAvailableModels([]);
        }
        setIsLoadingModels(false);
    }, [modelName, onModelNameChange]);

    useEffect(() => {
        if (isVisible && apiKey) {
            fetchAndSetAvailableModels(apiKey);
        }
    }, [apiKey, isVisible, fetchAndSetAvailableModels]);

    useEffect(() => {
        if (isVisible) {
            ipcRenderer.invoke('settings:get-api-key').then(savedKey => {
                if (savedKey) setApiKey(savedKey);
            });
            ipcRenderer.invoke('settings:get-model-name').then(savedModel => {
                if (savedModel) setModelName(savedModel);
                if (apiKey) fetchAndSetAvailableModels(apiKey);
            });
        }
    }, [isVisible, apiKey, fetchAndSetAvailableModels]);

    const handleApiKeySave = async () => {
        const trimmedKey = apiKey.trim();
        setApiKey(trimmedKey);
        await ipcRenderer.invoke('settings:set-api-key', trimmedKey);
        onApiKeyChange(trimmedKey);
        if (trimmedKey) {
            fetchAndSetAvailableModels(trimmedKey);
        }
    };

    const handleModelNameSelect = async (selectedModel: string) => {
        setModelName(selectedModel);
        await ipcRenderer.invoke('settings:set-model-name', selectedModel);
        onModelNameChange(selectedModel);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-md bg-base-100 shadow-xl">
                <div className="card-body">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="card-title">Settings</h2>
                        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
                            <i className="ri-close-line text-xl"></i>
                        </button>
                    </div>

                    <div className="form-control w-full mb-4">
                        <label className="label">
                            <span className="label-text">Gemini API Key</span>
                        </label>
                        <input 
                            type="password" 
                            placeholder="Enter your API Key"
                            className="input input-bordered w-full"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            onBlur={handleApiKeySave}
                        />
                    </div>

                    <div className="form-control w-full mb-4">
                        <label className="label">
                            <span className="label-text">Gemini Model Name</span>
                        </label>
                        <select 
                            className="select select-bordered w-full"
                            value={modelName}
                            onChange={(e) => handleModelNameSelect(e.target.value)}
                            disabled={!apiKey || isLoadingModels}
                        >
                            {isLoadingModels && <option value="">Loading models...</option>}
                            {!isLoadingModels && availableModels.length === 0 && apiKey && <option value="">No models found. Check API key.</option>}
                            {!isLoadingModels && !apiKey && <option value="">Enter API key to load models</option>}
                            {availableModels.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        {apiKey && !isLoadingModels && (
                            <button 
                                onClick={() => fetchAndSetAvailableModels(apiKey)} 
                                className="btn btn-sm btn-outline mt-2"
                            >
                                {isLoadingModels ? <span className="loading loading-spinner loading-xs"></span> : <i className="ri-refresh-line"></i>}
                                Refresh Models
                            </button>
                        )}
                    </div>

                    <div className="card-actions justify-end mt-6">
                        <button onClick={handleApiKeySave} className="btn btn-primary">
                            Save Settings
                        </button>
                        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanelComponent;
