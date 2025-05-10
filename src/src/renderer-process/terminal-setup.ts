import { ipcRenderer } from 'electron';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import * as DOM from './dom-elements';
import { stripAnsiCodes } from './ui-utils';

export let terminal: Terminal;
export let fitAddon: FitAddon;
export const terminalId = Math.random().toString(36).substring(2, 15);
export let terminalHistory = '';
const MAX_HISTORY_LENGTH = 2000;

export function initializeTerminal() {
    terminal = new Terminal({
        theme: {
            background: '#1e1e1e',
            foreground: '#ffffff'
        },
        cursorBlink: true,
        fontSize: 14,
        scrollback: 5000
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    if (!DOM.terminalContainer) {
        console.error('Terminal container not found in DOM!');
        return;
    }

    terminal.open(DOM.terminalContainer);

    // Initial fit and resize event to main process
    setTimeout(() => {
        fitAddon.fit();
        ipcRenderer.send('terminal:resize', { id: terminalId, cols: terminal.cols, rows: terminal.rows });
    }, 100); // Delay to ensure container is fully rendered

    // Terminal event handling
    terminal.onData((data: string) => {
        ipcRenderer.send('terminal:input', { id: terminalId, data });
    });

    ipcRenderer.on('terminal:data', (event: Electron.IpcRendererEvent, { id, data }: { id: string; data: string }) => {
        if (id === terminalId) {
            terminal.write(data);
            const cleanedData = stripAnsiCodes(data);
            terminalHistory += cleanedData;
            if (terminalHistory.length > MAX_HISTORY_LENGTH) {
                terminalHistory = terminalHistory.slice(-MAX_HISTORY_LENGTH);
            }
        }
    });

    ipcRenderer.on('terminal:error', (event: Electron.IpcRendererEvent, { id, error }: { id: string; error: string }) => {
        if (id === terminalId) {
            terminal.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
        }
    });

    // Create terminal process in main
    ipcRenderer.send('terminal:create', terminalId);

    // Handle window resize
    let resizeTimeout: NodeJS.Timeout;
    window.addEventListener('resize', () => {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
            fitAddon.fit();
            ipcRenderer.send('terminal:resize', { id: terminalId, cols: terminal.cols, rows: terminal.rows });
        }, 100);
    });
}
