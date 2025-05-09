// Import modules
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ipcRenderer } from 'electron';

// Import xterm styles
import '@xterm/xterm/css/xterm.css';

// Terminal setup and history tracking
let terminalHistory = '';
const maxHistoryLength = 1000; // Keep last 1000 characters

// Terminal setup
const terminal = new Terminal({
    theme: {
        background: '#1e1e1e',
        foreground: '#ffffff'
    },
    cursorBlink: true,
    fontSize: 14,
    scrollback: 5000
});

const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.loadAddon(new WebLinksAddon());

const terminalContainer = document.getElementById('terminal-container');
if (!terminalContainer) {
    console.error('Terminal container not found');
} else {
    terminal.open(terminalContainer);
    
    // Initial fit
    setTimeout(() => {
        fitAddon.fit();
        const { cols, rows } = terminal;
        ipcRenderer.send('terminal:resize', { id: terminalId, cols, rows });
    }, 100);
}

// Generate unique ID for this terminal instance
const terminalId = Math.random().toString(36).substring(2, 15);

// Terminal event handling
terminal.onData((data: string) => {
    ipcRenderer.send('terminal:input', { id: terminalId, data });
});

ipcRenderer.on('terminal:data', (event: Electron.IpcRendererEvent, { id, data }: { id: string; data: string }) => {
    if (id === terminalId) {
        terminal.write(data);
        // Update terminal history
        terminalHistory += data;
        if (terminalHistory.length > maxHistoryLength) {
            terminalHistory = terminalHistory.slice(-maxHistoryLength);
        }
    }
});

ipcRenderer.on('terminal:error', (event: Electron.IpcRendererEvent, { id, error }: { id: string; error: string }) => {
    if (id === terminalId) {
        terminal.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
    }
});

// Create terminal process
ipcRenderer.send('terminal:create', terminalId);

// Handle window resize with debouncing
let resizeTimeout: NodeJS.Timeout;
window.addEventListener('resize', () => {
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(() => {
        fitAddon.fit();
        const { cols, rows } = terminal;
        ipcRenderer.send('terminal:resize', { id: terminalId, cols, rows });
    }, 100);
});

// AI Interface setup
const aiInput = document.querySelector('#ai-input input') as HTMLInputElement;
const aiButton = document.querySelector('#ai-input button') as HTMLButtonElement;
const aiOutput = document.querySelector('#ai-output') as HTMLDivElement;

aiButton?.addEventListener('click', async () => {
    if (!aiInput?.value.trim()) return;

    const query = aiInput.value;
    aiInput.value = '';

    // Add user message to output
    appendMessage('User', query);

    try {
        const response = await ipcRenderer.invoke('ai:process-query', {
            query,
            terminalHistory
        });

        appendMessage('AI', response.text);

        if (response.suggestedCommand) {
            const commandDiv = document.createElement('div');
            commandDiv.className = 'suggested-command';
            commandDiv.innerHTML = `
                <div class="command-text">${response.suggestedCommand}</div>
                <button class="execute-btn">Execute</button>
            `;
            aiOutput?.appendChild(commandDiv);

            const executeBtn = commandDiv.querySelector('.execute-btn');
            executeBtn?.addEventListener('click', () => {
                ipcRenderer.send('terminal:input', {
                    id: terminalId,
                    data: response.suggestedCommand + '\n'
                });
            });
        }
    } catch (error) {
        appendMessage('Error', error.message);
    }
});

aiInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        aiButton?.click();
    }
});

function appendMessage(sender: string, content: string) {
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '10px';
    messageDiv.innerHTML = `<strong>${sender}:</strong> ${content}`;
    aiOutput?.appendChild(messageDiv);
    aiOutput?.scrollTo(0, aiOutput.scrollHeight);
}