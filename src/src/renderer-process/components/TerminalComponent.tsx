import React, { useEffect, useRef } from 'react';
import { ipcRenderer } from 'electron';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { stripAnsiCodes } from '../../utils/string-utils';
import { Logger } from '../../utils/logger'; 

// Global set to track terminal IDs for which PTY creation has been requested
const ptyCreationRequested = new Set<string>();

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
    // isInitializedRef is for the component instance, not global PTY creation
    const isComponentInitializedRef = useRef(false); 
    const logger = useRef(new Logger(`TerminalComponent[${terminalId}]`)).current;

    useEffect(() => {
        if (!terminalRef.current || isComponentInitializedRef.current) {
            return;
        }
        isComponentInitializedRef.current = true;

        logger.info('Initializing component instance...');

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
        
        const initialFit = () => {
            if (fitAddonRef.current && xtermInstanceRef.current) {
                try {
                    fitAddonRef.current.fit();
                    ipcRenderer.send('terminal:resize', { 
                        id: terminalId, 
                        cols: xtermInstanceRef.current.cols, 
                        rows: xtermInstanceRef.current.rows 
                    });
                } catch (e) {
                    logger.error("Error during fitAddon.fit():", e);
                }
            }
        };

        const initialFitTimeout = setTimeout(() => {
            initialFit();
            xterm.focus();
        }, 50);

        // Only send terminal:create if it hasn't been sent for this terminalId yet
        if (!ptyCreationRequested.has(terminalId)) {
            ipcRenderer.send('terminal:create', terminalId);
            ptyCreationRequested.add(terminalId);
            logger.info('terminal:create IPC sent.');
        } else {
            logger.info('terminal:create IPC already sent for this ID, skipping.');
        }

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
                logger.warn(`Received terminal error:`, error);
                xtermInstanceRef.current.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
            }
        };

        ipcRenderer.on('terminal:data', handleTerminalData);
        ipcRenderer.on('terminal:error', handleTerminalError);

        // Debounced resize handler for both window and element resize
        let resizeTimeout: NodeJS.Timeout;
        const debouncedResizeHandler = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(initialFit, 100); // Reuse initialFit which calls fit() and sends IPC
        };

        // Listen to window resize
        window.addEventListener('resize', debouncedResizeHandler);

        // Use ResizeObserver to detect changes to the terminal container's size
        let resizeObserver: ResizeObserver | null = null;
        if (terminalRef.current) {
            resizeObserver = new ResizeObserver(debouncedResizeHandler);
            resizeObserver.observe(terminalRef.current);
        }
        
        // Initial resize call
        const initialResizeTimeout = setTimeout(initialFit, 100);

        xterm.onData((data: string) => {
            logger.debug(`xterm.onData - Sending data to main:`, data); // New log
            ipcRenderer.send('terminal:input', { id: terminalId, data });
        });

        return () => {
            logger.info('Cleaning up component instance...');
            clearTimeout(initialFitTimeout);
            clearTimeout(initialResizeTimeout);
            clearTimeout(resizeTimeout);
            ipcRenderer.removeAllListeners('terminal:data');
            ipcRenderer.removeAllListeners('terminal:error');
            window.removeEventListener('resize', debouncedResizeHandler);
            if (resizeObserver && terminalRef.current) {
                resizeObserver.unobserve(terminalRef.current);
            }
            if (xtermInstanceRef.current) {
                xtermInstanceRef.current.dispose();
                xtermInstanceRef.current = null;
            }
            fitAddonRef.current = null;
            isComponentInitializedRef.current = false; 
        };
    }, [terminalId, onHistoryChange, logger]);

    return (
        // Use DaisyUI base color for the terminal container background
        <div 
            id={`terminal-container-${terminalId}`} 
            ref={terminalRef} 
            className="w-full h-full p-1 bg-base-300 rounded-md overflow-hidden"
        ></div>
    );
};

export default TerminalComponent;
