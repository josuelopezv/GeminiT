// Import modules
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ipcRenderer } from 'electron';

// Import xterm styles
import '@xterm/xterm/css/xterm.css';

// Function to strip ANSI escape codes
function stripAnsiCodes(str: string): string {
    // Regex to remove common ANSI escape sequences
    // This covers color codes, cursor movement, screen clearing, etc.
    return str.replace(/[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

// Settings panel setup
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsClose = document.querySelector('.settings-close');
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const modelNameInput = document.getElementById('model-name') as HTMLSelectElement; // Changed to HTMLSelectElement
const refreshModelsBtn = document.getElementById('refresh-models-btn') as HTMLButtonElement;

let hasValidApiKey = false;
let currentModelName = '';

// Function to populate the model dropdown
function populateModelDropdown(models: string[], selectedModel?: string) {
    modelNameInput.innerHTML = ''; // Clear existing options

    if (models.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No compatible models found or API key invalid.';
        modelNameInput.appendChild(option);
        refreshModelsBtn.style.display = 'inline'; // Show refresh button
        return;
    }

    refreshModelsBtn.style.display = 'none'; // Hide refresh button if models are loaded

    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        if (model === selectedModel) {
            option.selected = true;
        }
        modelNameInput.appendChild(option);
    });

    // If a selected model was passed and is in the list, ensure it's set
    // Otherwise, if currentModelName is in the list, set it
    // Otherwise, if there are models, select the first one by default
    if (selectedModel && models.includes(selectedModel)) {
        modelNameInput.value = selectedModel;
    } else if (currentModelName && models.includes(currentModelName)) {
        modelNameInput.value = currentModelName;
    } else if (models.length > 0) {
        modelNameInput.value = models[0];
        // Trigger change to save this default if no prior selection was valid
        modelNameInput.dispatchEvent(new Event('change')); 
    }
}

// Function to fetch and populate models
async function fetchAndPopulateModels(currentSelectedModel?: string) {
    if (!hasValidApiKey) {
        populateModelDropdown([], currentSelectedModel);
        refreshModelsBtn.style.display = 'inline';
        return;
    }
    try {
        modelNameInput.innerHTML = '<option value="">Loading models...</option>'; // Show loading state
        const models: string[] = await ipcRenderer.invoke('ai:list-models');
        populateModelDropdown(models, currentSelectedModel || currentModelName);
    } catch (error) {
        const err = error as Error;
        console.error('Error fetching models:', err);
        appendMessage('Error', `Failed to load models: ${err.message}`);
        populateModelDropdown([], currentSelectedModel || currentModelName); // Show error state in dropdown
        refreshModelsBtn.style.display = 'inline';
    }
}

// Load saved API key and model name
async function loadSettings() {
    const savedKey = await ipcRenderer.invoke('settings:get-api-key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        hasValidApiKey = true;
    }
    const savedModelName = await ipcRenderer.invoke('settings:get-model-name');
    if (savedModelName) {
        currentModelName = savedModelName;
        // Don't populate dropdown here directly, let settings panel opening or API key change trigger it
        // Just set the value if it exists, populateModelDropdown will handle selection logic
        modelNameInput.value = savedModelName; 
    }
    // Attempt to fetch models if API key is already set on load
    if (hasValidApiKey) {
        fetchAndPopulateModels(currentModelName);
    }
}

// Handle settings panel visibility
settingsBtn?.addEventListener('click', () => {
    settingsPanel?.classList.add('visible');
    if (hasValidApiKey) {
        fetchAndPopulateModels(currentModelName); // Fetch models when panel opens if API key is set
    } else {
        populateModelDropdown([], currentModelName);
        refreshModelsBtn.style.display = 'inline';
    }
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
        fetchAndPopulateModels(currentModelName); // Fetch models after API key is set
    } else {
        hasValidApiKey = false;
        populateModelDropdown([], currentModelName);
        refreshModelsBtn.style.display = 'inline';
    }
});

// Handle Model Name select changes
modelNameInput?.addEventListener('change', async () => {
    const newModelName = modelNameInput.value;
    if (newModelName) {
        await ipcRenderer.invoke('settings:set-model-name', newModelName);
        currentModelName = newModelName;
    }
});

refreshModelsBtn?.addEventListener('click', () => {
    fetchAndPopulateModels(currentModelName);
});

// Load API key and model name when app starts
loadSettings();

// Terminal setup and history tracking
let terminalHistory = '';
const maxHistoryLength = 2000; // Keep last 2000 characters of *cleaned* history

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
        terminal.write(data); // Write raw data (with ANSI codes) to the xterm.js terminal
        // Update terminal history with *cleaned* data
        const cleanedData = stripAnsiCodes(data);
        terminalHistory += cleanedData;
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
    // Ensure currentModelName is up-to-date from the dropdown selection
    currentModelName = modelNameInput.value; 
    if (!currentModelName) {
        appendMessage('System', 'Please select a Gemini Model Name in settings first.');
        settingsPanel?.classList.add('visible');
        fetchAndPopulateModels(); // Attempt to load models if not already
        return;
    }

    const query = aiInput.value;
    aiInput.value = '';

    // Add user message to output
    appendMessage('User', query);

    try {
        // Send the cleaned terminal history
        const response = await ipcRenderer.invoke('ai:process-query', {
            query,
            terminalHistory // This is now cleaned history
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