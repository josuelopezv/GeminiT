import React, { useState, useCallback, useEffect } from 'react';
import { ipcRenderer } from 'electron'; 
import TerminalComponent from './TerminalComponent';
import AiPanelComponent from './AiPanelComponent';
import SettingsPanelComponent from './SettingsPanelComponent'; 

const App: React.FC = () => {
    const [terminalId] = useState(() => Math.random().toString(36).substring(2, 15));
    const [terminalHistory, setTerminalHistory] = useState<string>('');
    const [isSettingsPanelVisible, setIsSettingsPanelVisible] = useState(false);

    // Lifted state for API settings
    const [apiKey, setApiKey] = useState<string>('');
    const [modelName, setModelName] = useState<string>('');

    // Load initial API key and model name from electron-store via main process
    useEffect(() => {
        ipcRenderer.invoke('settings:get-api-key').then(savedKey => {
            if (savedKey) setApiKey(savedKey);
        });
        ipcRenderer.invoke('settings:get-model-name').then(savedModel => {
            if (savedModel) setModelName(savedModel);
            // If no model is saved, but we have a default from electron-store, it will be used.
            // The SettingsPanelComponent will also try to select a default if list is populated.
        });
    }, []);

    const handleTerminalHistoryChange = useCallback((newHistory: string) => {
        setTerminalHistory(newHistory);
    }, []);

    const handleApiKeyChange = useCallback((newApiKey: string) => {
        setApiKey(newApiKey);
        // Potentially trigger re-initialization or validation in AiPanelComponent if needed
    }, []);

    const handleModelNameChange = useCallback((newModelName: string) => {
        setModelName(newModelName);
    }, []);

    return (
        <div className="flex h-screen font-sans bg-gray-800 overflow-hidden"> 
            {/* Terminal Panel Wrapper */}
            <div className="flex-1 p-1 bg-gray-900 min-w-0"> 
                <TerminalComponent 
                    terminalId={terminalId} 
                    onHistoryChange={handleTerminalHistoryChange} 
                />
            </div>

            {/* AI Panel Wrapper - This will be the resizable part */}
            {/* For now, fixed initial width, but structured for resizing */}
            <div className="flex-shrink-0 basis-96 p-0 bg-gray-700"> {/* Use flex-basis for initial size, p-0 as AiPanelComponent has padding */}
                <AiPanelComponent 
                    terminalId={terminalId} 
                    terminalHistory={terminalHistory}
                    isSettingsPanelVisible={isSettingsPanelVisible} 
                    setIsSettingsPanelVisible={setIsSettingsPanelVisible} 
                    apiKeyStatus={{ isValid: !!apiKey, key: apiKey }} 
                    currentModelNameFromApp={modelName}
                />
            </div>

            {isSettingsPanelVisible && (
                <SettingsPanelComponent 
                    isVisible={isSettingsPanelVisible} 
                    onClose={() => setIsSettingsPanelVisible(false)}
                    initialApiKey={apiKey}        
                    initialModelName={modelName}  
                    onApiKeyChange={handleApiKeyChange}
                    onModelNameChange={handleModelNameChange}
                />
            )}
        </div>
    );
};

export default App;
