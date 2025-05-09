// Import modules
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ipcRenderer } from 'electron';

// Import xterm styles
import '@xterm/xterm/css/xterm.css';

// Settings panel setup
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.querySelector('.settings-close');
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const modelNameInput = document.getElementById('model-name') as HTMLInputElement; // Added this line

let hasValidApiKey = false;
let currentModelName = ''; // Added this line

// Load saved API key and model name
async function loadSettings() {
    const savedKey = await ipcRenderer.invoke('settings:get-api-key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        hasValidApiKey = true;
    }
    const savedModelName = await ipcRenderer.invoke('settings:get-model-name'); // Added this block
    if (savedModelName) {
        modelNameInput.value = savedModelName;
        currentModelName = savedModelName;
    } else {
        // If no model name is saved, fetch the default from main (if any was set)
        const defaultModelName = await ipcRenderer.invoke('settings:get-model-name');
        if (defaultModelName) {
            modelNameInput.value = defaultModelName;
            currentModelName = defaultModelName;
        }
    }
}

// Handle settings panel visibility
settingsBtn?.addEventListener('click', () => {
    settingsPanel?.classList.add('visible');
});

settingsClose?.addEventListener('click', () => {
    settingsPanel?.classList.remove('visible');
});

// Handle API key changes
apiKeyInput?.addEventListener('change', async () => {
    const newKey = apiKeyInput.value.trim();
    if (newKey) {
        await ipcRenderer.invoke('settings:set-api-key', newKey);
        hasValidApiKey = true;
        // Do not close panel automatically, user might want to change model name too
    } else {
        hasValidApiKey = false;
    }
});

// Handle Model Name changes // Added this block
modelNameInput?.addEventListener('change', async () => {
    const newModelName = modelNameInput.value.trim();
    if (newModelName) {
        await ipcRenderer.invoke('settings:set-model-name', newModelName);
        currentModelName = newModelName;
    }
});

// Load API key and model name when app starts
loadSettings();

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
    
    if (!hasValidApiKey) {
        appendMessage('System', 'Please set your Gemini API key in settings first');
        settingsPanel?.classList.add('visible');
        return;
    }
    if (!currentModelName) { // Added this check
        appendMessage('System', 'Please set your Gemini Model Name in settings first');
        settingsPanel?.classList.add('visible');
        return;
    }

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
        const err = error as Error; // Explicitly type the error
        appendMessage('Error', err.message);
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