import React, { useState, useCallback, useEffect, useRef } from 'react'; // Added useRef
import { ipcRenderer } from 'electron';
import TerminalComponent from './TerminalComponent';
import AiPanelComponent from './AiPanelComponent';
import SettingsPanelComponent from './SettingsPanelComponent';

const MIN_AI_PANEL_WIDTH = 200; // Minimum width for AI panel in pixels
const DEFAULT_AI_PANEL_WIDTH = 384; // Corresponds to basis-96 (24rem)

const App: React.FC = () => {
    const [terminalId] = useState(() => Math.random().toString(36).substring(2, 15));
    const [terminalHistory, setTerminalHistory] = useState<string>('');
    const [isSettingsPanelVisible, setIsSettingsPanelVisible] = useState(false);
    const [apiKey, setApiKey] = useState<string>('');
    const [modelName, setModelName] = useState<string>('');

    // State for AI panel width and dragging
    const [aiPanelWidth, setAiPanelWidth] = useState<number>(DEFAULT_AI_PANEL_WIDTH);
    const [isResizing, setIsResizing] = useState<boolean>(false);
    const appContainerRef = useRef<HTMLDivElement>(null); // Ref for the main container to get total width

    useEffect(() => {
        // ... existing useEffect for loading settings ...
        ipcRenderer.invoke('settings:get-api-key').then(savedKey => {
            if (savedKey) setApiKey(savedKey);
        });
        ipcRenderer.invoke('settings:get-model-name').then(savedModel => {
            if (savedModel) setModelName(savedModel);
        });
    }, []);

    const handleTerminalHistoryChange = useCallback((newHistory: string) => {
        setTerminalHistory(newHistory);
    }, []);

    const handleApiKeyChange = useCallback((newApiKey: string) => {
        setApiKey(newApiKey);
    }, []);

    const handleModelNameChange = useCallback((newModelName: string) => {
        setModelName(newModelName);
    }, []);

    // Mouse event handlers for resizing
    const handleMouseDownOnSplitter = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing || !appContainerRef.current) return;
        // Calculate new width based on mouse position from the right edge of the app container
        const newWidth = appContainerRef.current.getBoundingClientRect().right - e.clientX;
        if (newWidth >= MIN_AI_PANEL_WIDTH) {
            setAiPanelWidth(newWidth);
        } else {
            setAiPanelWidth(MIN_AI_PANEL_WIDTH);
        }
    }, [isResizing]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    return (
        <div ref={appContainerRef} className="flex h-screen font-sans bg-gray-800 overflow-hidden">
            {/* Terminal Panel Wrapper */}
            <div className="flex-1 p-1 bg-gray-900 min-w-0"> 
                <TerminalComponent 
                    terminalId={terminalId} 
                    onHistoryChange={handleTerminalHistoryChange} 
                />
            </div>

            {/* Splitter Handle */}
            <div 
                className="w-2 bg-gray-600 hover:bg-blue-500 cursor-col-resize flex-shrink-0"
                onMouseDown={handleMouseDownOnSplitter}
                title="Resize AI Panel"
            ></div>

            {/* AI Panel Wrapper */}
            <div 
                className="flex-shrink-0 p-0 bg-gray-700"
                style={{ width: `${aiPanelWidth}px` }} // Dynamic width
            >
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
