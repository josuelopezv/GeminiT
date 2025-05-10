// src/renderer-process/components/TerminalComponent.tsx
import React, { useEffect, useRef } from 'react';
import { ipcRenderer } from 'electron';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { stripAnsiCodes } from '../ui-utils';

interface TerminalComponentProps {
    terminalId: string;
    onHistoryChange: (newHistory: string) => void;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({ terminalId, onHistoryChange }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermInstanceRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const localTerminalHistoryRef = useRef<string>('');
    const MAX_HISTORY_LENGTH = 2000;

    useEffect(() => {
        if (!terminalRef.current || xtermInstanceRef.current) { // Prevent re-initialization if already initialized
            return;
        }

        console.log(`TerminalComponent: Initializing for terminalId: ${terminalId}`);

        const xterm = new Terminal({
            theme: {
                background: '#1e1e1e',
                foreground: '#ffffff',
                cursor: '#ffffff',
            },
            cursorBlink: true,
            fontSize: 14,
            scrollback: 5000,
            convertEol: true,
        });
        xtermInstanceRef.current = xterm;

        const fitAddonInstance = new FitAddon();
        fitAddonRef.current = fitAddonInstance;
        xterm.loadAddon(fitAddonInstance);
        xterm.loadAddon(new WebLinksAddon());

        xterm.open(terminalRef.current);
        
        // Delay initial fit to allow DOM to settle
        const initialFitTimeout = setTimeout(() => {
            if (fitAddonRef.current) {
                try {
                    fitAddonRef.current.fit();
                    if (xtermInstanceRef.current) {
                         ipcRenderer.send('terminal:resize', { 
                            id: terminalId, 
                            cols: xtermInstanceRef.current.cols, 
                            rows: xtermInstanceRef.current.rows 
                        });
                    }
                } catch (e) {
                    console.error("Error during initial fitAddon.fit():", e);
                }
            }
            xterm.focus(); // Focus after initial fit
        }, 50); // Small delay

        ipcRenderer.send('terminal:create', terminalId);

        xterm.onData((data: string) => {
            ipcRenderer.send('terminal:input', { id: terminalId, data });
        });

        const handleTerminalData = (event: Electron.IpcRendererEvent, { id, data }: { id: string; data: string }) => {
            if (id === terminalId && xtermInstanceRef.current) {
                xtermInstanceRef.current.write(data);
                const cleanedData = stripAnsiCodes(data);
                localTerminalHistoryRef.current += cleanedData;
                if (localTerminalHistoryRef.current.length > MAX_HISTORY_LENGTH) {
                    localTerminalHistoryRef.current = localTerminalHistoryRef.current.slice(-MAX_HISTORY_LENGTH);
                }
                onHistoryChange(localTerminalHistoryRef.current);
            }
        };

        const handleTerminalError = (event: Electron.IpcRendererEvent, { id, error }: { id: string; error: string }) => {
            if (id === terminalId && xtermInstanceRef.current) {
                xtermInstanceRef.current.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
            }
        };

        ipcRenderer.on('terminal:data', handleTerminalData);
        ipcRenderer.on('terminal:error', handleTerminalError);

        const handleResize = () => {
            if (fitAddonRef.current && xtermInstanceRef.current && terminalRef.current) {
                try {
                    fitAddonRef.current.fit();
                    ipcRenderer.send('terminal:resize', { 
                        id: terminalId, 
                        cols: xtermInstanceRef.current.cols, 
                        rows: xtermInstanceRef.current.rows 
                    });
                } catch (e) {
                    console.error("Error during handleResize fitAddon.fit():", e);
                }
            }
        };

        let resizeTimeout: NodeJS.Timeout;
        const debouncedResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(handleResize, 100);
        };
        window.addEventListener('resize', debouncedResize);
        // Initial resize call also delayed slightly
        const initialResizeTimeout = setTimeout(handleResize, 100);

        // Cleanup on component unmount
        return () => {
            console.log(`TerminalComponent: Cleaning up for terminalId: ${terminalId}`);
            clearTimeout(initialFitTimeout);
            clearTimeout(initialResizeTimeout);
            clearTimeout(resizeTimeout); // Clear any pending debounced resize
            ipcRenderer.removeAllListeners('terminal:data');
            ipcRenderer.removeAllListeners('terminal:error');
            window.removeEventListener('resize', debouncedResize);
            if (xtermInstanceRef.current) {
                xtermInstanceRef.current.dispose();
                xtermInstanceRef.current = null;
            }
            fitAddonRef.current = null; // Clear addon ref
            // TODO: Send a message to main process to destroy the PTY instance associated with terminalId
            // ipcRenderer.send('terminal:destroy', terminalId);
        };
    }, [terminalId, onHistoryChange]);

    return <div ref={terminalRef} id="terminal-component-container" className="w-full h-full bg-gray-900"></div>;
};

export default TerminalComponent;
