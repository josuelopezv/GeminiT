import React, { useEffect, useRef, useCallback } from 'react'; // Added useCallback
import { ipcRenderer } from 'electron';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { stripAnsiCodes } from '../../utils/string-utils';
import { Logger } from '../../utils/logger'; 

// Global set to track terminal IDs for which PTY creation has been requested
const ptyCreationRequested = new Set<string>();

// Define Xterm.js themes corresponding to DaisyUI themes
const xtermThemes: Record<string, Partial<import('@xterm/xterm').ITheme>> = {
  light: {
    background: '#FFFFFF',
    foreground: '#374151', // text-gray-700
    cursor: '#374151',
    selectionBackground: '#A5B4FC', // indigo-300
    selectionForeground: '#000000'
  },
  dark: {
    background: '#1F2937', // gray-800
    foreground: '#D1D5DB', // gray-300
    cursor: '#F9FAFB', // gray-50
    selectionBackground: '#4F46E5', // indigo-600
    selectionForeground: '#FFFFFF'
  },
  night: { // A common DaisyUI dark theme
    background: '#0F172A', // slate-900 (example, adjust to actual 'night' theme background)
    foreground: '#E2E8F0', // slate-200
    cursor: '#FFFFFF',
    selectionBackground: '#38BDF8', // sky-400
    selectionForeground: '#0F172A'
  },
  dracula: {
    background: '#282A36',
    foreground: '#F8F8F2',
    cursor: '#F8F8F2',
    selectionBackground: '#44475A',
    selectionForeground: '#F8F8F2'
  },
  // Add more themes as needed
};

const DEFAULT_XTERM_THEME = xtermThemes.night; // Fallback theme

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

    const applyXtermTheme = useCallback((themeName?: string | null) => {
      if (xtermInstanceRef.current) {
        const selectedTheme = themeName && xtermThemes[themeName] 
          ? xtermThemes[themeName]
          : DEFAULT_XTERM_THEME;
        xtermInstanceRef.current.options.theme = selectedTheme;
        logger.info(`Applied xterm theme: ${themeName || 'default (night)'}`);
      }
    }, [logger]);

    useEffect(() => {
        if (!terminalRef.current) {
            logger.warn('Terminal ref is null at the start of useEffect.');
            return;
        }
        if (isComponentInitializedRef.current) {
            logger.info('Component already initialized, skipping useEffect run.');
            return;
        }

        let animationFrameId: number;
        let initialFitTimeoutId: NodeJS.Timeout | undefined;
        let resizeTimeoutId: NodeJS.Timeout | undefined;
        let themeObserver: MutationObserver | undefined;
        let terminalResizeObserver: ResizeObserver | null = null;
        let terminalElement: HTMLDivElement | null = null;

        // Define performFit and debouncedResizeHandler here so they are accessible for cleanup
        const performFit = () => {
            if (fitAddonRef.current && xtermInstanceRef.current && terminalRef.current && terminalRef.current.offsetParent !== null) {
                try {
                    fitAddonRef.current.fit();
                    ipcRenderer.send('terminal:resize', { 
                        id: terminalId, 
                        cols: xtermInstanceRef.current.cols, 
                        rows: xtermInstanceRef.current.rows 
                    });
                    logger.info(`Terminal resized to: ${xtermInstanceRef.current.cols}x${xtermInstanceRef.current.rows}`);
                } catch (e) {
                    logger.error("Error during fitAddon.fit():", e);
                }
            } else {
                logger.warn('Skipping fit, terminal not ready or not visible.');
            }
        };

        const debouncedResizeHandler = () => {
            if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
            resizeTimeoutId = setTimeout(performFit, 100);
        };

        animationFrameId = requestAnimationFrame(() => {
            if (!terminalRef.current) { 
                logger.warn('Terminal ref became null before animation frame execution.');
                return;
            }

            if (isComponentInitializedRef.current && xtermInstanceRef.current) {
                logger.info('Initialization logic inside animationFrame found component already initialized.');
                performFit();
                xtermInstanceRef.current.focus();
                return;
            }

            isComponentInitializedRef.current = true;
            logger.info('Initializing component instance (after animation frame)...');

            const xterm = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                scrollback: 5000,
                convertEol: true,
                allowTransparency: true
            });
            xtermInstanceRef.current = xterm;

            const fitAddonInstance = new FitAddon();
            fitAddonRef.current = fitAddonInstance;
            xterm.loadAddon(fitAddonInstance);
            xterm.loadAddon(new WebLinksAddon());

            xterm.open(terminalRef.current);

            // Handle Ctrl+V paste
            xterm.attachCustomKeyEventHandler((e) => {
                if (e.ctrlKey && e.key === 'v') {
                    navigator.clipboard.readText()
                        .then(text => {
                            if (text) {
                                ipcRenderer.send('terminal:input', { id: terminalId, data: text });
                            }
                        })
                        .catch(err => logger.error('Failed to paste text:', err));
                    return false;
                }
                return true;
            });

            const currentDaisyTheme = document.documentElement.getAttribute('data-theme');
            applyXtermTheme(currentDaisyTheme);
            
            themeObserver = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                        const newThemeName = document.documentElement.getAttribute('data-theme');
                        applyXtermTheme(newThemeName);
                    }
                }
            });
            themeObserver.observe(document.documentElement, { attributes: true });
            
            initialFitTimeoutId = setTimeout(() => {
                performFit();
                if (xtermInstanceRef.current) {
                    xtermInstanceRef.current.focus();
                }
            }, 100);

            if (!ptyCreationRequested.has(terminalId)) {
                ipcRenderer.send('terminal:create', terminalId);
                ptyCreationRequested.add(terminalId);
                logger.info('terminal:create IPC sent.');
            } else {
                logger.info('terminal:create IPC already sent for this ID, skipping.');
            }

            const handleTerminalData = (event: Electron.IpcRendererEvent, { id, data }: { id: string; data: string }) => {
                if (id === terminalId && xtermInstanceRef.current) {
                    const isStartMarker = data.includes('__CMD_OUTPUT_START_');
                    const isEndMarker = data.includes('__CMD_OUTPUT_END_');
                    
                    if (!isStartMarker && !isEndMarker) {
                        xtermInstanceRef.current.write(data);
                    }

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
    
            window.addEventListener('resize', debouncedResizeHandler);
    
            if (terminalRef.current) {
                terminalResizeObserver = new ResizeObserver(debouncedResizeHandler);
                terminalResizeObserver.observe(terminalRef.current);
            }
            
            xterm.onData((data: string) => {
                logger.debug(`xterm.onData - Sending data to main:`, data);
                ipcRenderer.send('terminal:input', { id: terminalId, data });
            });
        });

        return () => {
            logger.info('Cleaning up TerminalComponent instance...');
            cancelAnimationFrame(animationFrameId);
            if (initialFitTimeoutId) clearTimeout(initialFitTimeoutId);
            if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
            
            ipcRenderer.removeAllListeners('terminal:data');
            ipcRenderer.removeAllListeners('terminal:error');
            
            window.removeEventListener('resize', debouncedResizeHandler);
            if (themeObserver) themeObserver.disconnect();
            if (terminalResizeObserver && terminalRef.current) {
                terminalResizeObserver.unobserve(terminalRef.current);
            }
            if (xtermInstanceRef.current) {
                xtermInstanceRef.current.dispose();
                xtermInstanceRef.current = null;
            }
        };
    }, [terminalId, applyXtermTheme, logger, onHistoryChange]);

    return (
        <div 
            id={`terminal-container-${terminalId}`} 
            ref={terminalRef} 
            className="w-full h-full p-1 bg-base-300 rounded-md overflow-hidden"
        ></div>
    );
};

export default TerminalComponent;
