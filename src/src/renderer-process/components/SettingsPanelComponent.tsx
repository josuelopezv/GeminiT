import React, { useState, useEffect, useCallback } from 'react';
import { ipcRenderer } from 'electron';

interface SettingsPanelProps {
    isVisible: boolean;
    onClose: () => void;
    // Callbacks to notify App.tsx of changes, or manage state via Context
    onApiKeyChange: (apiKey: string) => void; 
    onModelNameChange: (modelName: string) => void;
    // Initial values (could also be fetched within the component if preferred)
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
            // If current modelName is not in the new list, or no modelName is set, select the first available one
            if (models.length > 0 && (!modelName || !models.includes(modelName))) {
                const newModel = models[0];
                setModelName(newModel);
                onModelNameChange(newModel); // Notify parent
                ipcRenderer.invoke('settings:set-model-name', newModel);
            }
        } catch (error) {
            console.error('Error fetching models in SettingsPanel:', error);
            setAvailableModels([]); // Clear models on error
            // Optionally, display an error message to the user in the settings panel
        }
        setIsLoadingModels(false);
    }, [modelName, onModelNameChange]); // Added modelName and onModelNameChange dependencies

    // Fetch models when API key changes and is valid
    useEffect(() => {
        if (isVisible && apiKey) {
            fetchAndSetAvailableModels(apiKey);
        }
    }, [apiKey, isVisible, fetchAndSetAvailableModels]);

    // Load initial settings from main process store when component becomes visible
    useEffect(() => {
        if (isVisible) {
            ipcRenderer.invoke('settings:get-api-key').then(savedKey => {
                if (savedKey) setApiKey(savedKey);
            });
            ipcRenderer.invoke('settings:get-model-name').then(savedModel => {
                if (savedModel) setModelName(savedModel);
                // Fetch models if API key is already loaded
                if (apiKey) fetchAndSetAvailableModels(apiKey);
            });
        }
    }, [isVisible, apiKey, fetchAndSetAvailableModels]); // Added apiKey and fetchAndSetAvailableModels

    const handleApiKeySave = async () => {
        const trimmedKey = apiKey.trim();
        setApiKey(trimmedKey); // Update local state immediately for UI responsiveness
        await ipcRenderer.invoke('settings:set-api-key', trimmedKey);
        onApiKeyChange(trimmedKey); // Notify parent
        if (trimmedKey) {
            fetchAndSetAvailableModels(trimmedKey);
        }
        // Optionally close panel on save, or provide a separate save button
        // onClose(); 
    };

    const handleModelNameSelect = async (selectedModel: string) => {
        setModelName(selectedModel);
        await ipcRenderer.invoke('settings:set-model-name', selectedModel);
        onModelNameChange(selectedModel); // Notify parent
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div 
            className="absolute top-0 left-0 right-0 bottom-0 bg-gray-800 bg-opacity-90 p-4 sm:p-6 z-50 flex justify-center items-center"
            onClick={onClose} // Click outside to close
        >
            <div 
                className="bg-gray-700 p-4 sm:p-6 rounded-lg shadow-xl w-full max-w-md text-white"
                onClick={(e) => e.stopPropagation()} // Prevent click inside from closing
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Settings</h3>
                    <button onClick={onClose} className="text-2xl hover:text-gray-400">&times;</button>
                </div>
                
                <div className="space-y-4">
                    <div className="settings-group">
                        <label htmlFor="api-key-input" className="block mb-1 text-sm font-medium text-gray-300">Gemini API Key:</label>
                        <input 
                            type="password" 
                            id="api-key-input" 
                            placeholder="Enter your API key"
                            className="w-full p-2 bg-gray-600 rounded border border-gray-500 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            onBlur={handleApiKeySave} // Save when input loses focus
                        />
                    </div>

                    <div className="settings-group">
                        <label htmlFor="model-name-select" className="block mb-1 text-sm font-medium text-gray-300">Gemini Model Name:</label>
                        <select 
                            id="model-name-select" 
                            className="w-full p-2 bg-gray-600 rounded border border-gray-500 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-50"
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
                                className="text-xs text-blue-400 hover:underline mt-1"
                             >
                                Refresh Models
                             </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanelComponent;
