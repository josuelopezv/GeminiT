import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ipcRenderer } from 'electron';
import TerminalComponent from './TerminalComponent';
import AiPanelComponent from './AiPanelComponent';
import SettingsPanelComponent from './SettingsPanelComponent';

const MIN_AI_PANEL_WIDTH_PERCENT = 15; // e.g., 15% of total width
const MAX_AI_PANEL_WIDTH_PERCENT = 70; // e.g., 70% of total width

const App: React.FC = () => {
    const [terminalId] = useState(() => Math.random().toString(36).substring(2, 15));
    const [terminalHistory, setTerminalHistory] = useState<string>('');
    const [isSettingsPanelVisible, setIsSettingsPanelVisible] = useState(false);
    const [apiKey, setApiKey] = useState<string>('');
    const [modelName, setModelName] = useState<string>('');

    const appContainerRef = useRef<HTMLDivElement>(null);
    const [aiPanelWidth, setAiPanelWidth] = useState<number>(0); // Initialized to 0, set by useEffect
    const [initialWidthSet, setInitialWidthSet] = useState(false);
    const [isResizing, setIsResizing] = useState<boolean>(false);

    // Effect to set initial AI panel width to 50%
    useEffect(() => {
        if (appContainerRef.current && !initialWidthSet) {
            const totalWidth = appContainerRef.current.offsetWidth;
            setAiPanelWidth(totalWidth / 2);
            setInitialWidthSet(true);
        }
    }, [initialWidthSet]); // Runs when initialWidthSet changes, or on mount

    // Effect to load initial settings from electron-store
    useEffect(() => {
        ipcRenderer.invoke('settings:get-api-key').then(savedKey => {
            if (savedKey) setApiKey(savedKey);
        });
        ipcRenderer.invoke('settings:get-model-name').then(savedModel => {
            if (savedModel) setModelName(savedModel);
        });
    }, []); // Runs once on mount

    const handleTerminalHistoryChange = useCallback((newHistory: string) => {
        setTerminalHistory(newHistory);
    }, []);

    const handleApiKeyChange = useCallback((newApiKey: string) => {
        setApiKey(newApiKey);
    }, []);

    const handleModelNameChange = useCallback((newModelName: string) => {
        setModelName(newModelName);
    }, []);

    const handleMouseDownOnSplitter = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing || !appContainerRef.current) return;
        const containerRect = appContainerRef.current.getBoundingClientRect();
        let newWidth = containerRect.right - e.clientX;
        const totalWidth = containerRect.width;

        const minPixelWidth = (MIN_AI_PANEL_WIDTH_PERCENT / 100) * totalWidth;
        const maxPixelWidth = (MAX_AI_PANEL_WIDTH_PERCENT / 100) * totalWidth;

        if (newWidth < minPixelWidth) newWidth = minPixelWidth;
        if (newWidth > maxPixelWidth) newWidth = maxPixelWidth;
        
        setAiPanelWidth(newWidth);
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

    // Render null or a loading state until initial width is set
    if (!initialWidthSet) {
        return <div ref={appContainerRef} className="flex h-screen">Loading layout...</div>; 
    }

    return (
        // DaisyUI themes apply to the html tag, so child elements will inherit themed styles.
        // We can remove explicit dark:bg-gray-900 if the DaisyUI theme handles the body background.
        // The `font-sans` and `overflow-hidden` are still good.
        <div ref={appContainerRef} className="flex h-screen font-sans overflow-hidden">
            {/* Terminal Panel Wrapper */}
            {/* DaisyUI themes might provide a base color, adjust if needed or use DaisyUI component like Card */}
            <div className="flex-1 p-1 bg-base-200 min-w-0 overflow-auto"> 
                <TerminalComponent 
                    terminalId={terminalId} 
                    onHistoryChange={handleTerminalHistoryChange} 
                />
            </div>

            {/* Splitter Handle */}
            {/* Using DaisyUI neutral color for the splitter */}
            <div 
                className="w-2 bg-neutral hover:bg-neutral-focus cursor-col-resize flex-shrink-0"
                onMouseDown={handleMouseDownOnSplitter}
                title="Resize AI Panel"
            ></div>

            {/* AI Panel Wrapper */}
            {/* Using DaisyUI base-100 or base-200 for panel background */}
            <div 
                className="flex-shrink-0 p-0 bg-base-100 overflow-auto" 
                style={{ width: `${aiPanelWidth}px` }} 
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
