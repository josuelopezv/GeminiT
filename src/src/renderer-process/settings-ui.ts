import { ipcRenderer } from 'electron';
import * as DOM from './dom-elements';
import { appendMessage } from './ui-utils';
import { AIResponse } from '../ai-service'; // For AIResponse type if needed for error display

export let hasValidApiKey = false;
export let currentModelName = '';

function populateModelDropdown(models: string[], selectedModel?: string) {
    if (!DOM.modelNameInput) return;
    DOM.modelNameInput.innerHTML = ''; // Clear existing options

    if (models.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No compatible models found or API key invalid.';
        DOM.modelNameInput.appendChild(option);
        if (DOM.refreshModelsBtn) DOM.refreshModelsBtn.style.display = 'inline';
        return;
    }

    if (DOM.refreshModelsBtn) DOM.refreshModelsBtn.style.display = 'none';

    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        if (model === selectedModel) {
            option.selected = true;
        }
        DOM.modelNameInput.appendChild(option);
    });

    if (selectedModel && models.includes(selectedModel)) {
        DOM.modelNameInput.value = selectedModel;
    } else if (currentModelName && models.includes(currentModelName)) {
        DOM.modelNameInput.value = currentModelName;
    } else if (models.length > 0) {
        DOM.modelNameInput.value = models[0];
        currentModelName = models[0]; // Update currentModelName if we default
        ipcRenderer.invoke('settings:set-model-name', currentModelName);
    }
}

async function fetchAndPopulateModels(currentSelectedModel?: string) {
    if (!hasValidApiKey) {
        populateModelDropdown([], currentSelectedModel);
        if (DOM.refreshModelsBtn) DOM.refreshModelsBtn.style.display = 'inline';
        return;
    }
    try {
        if (DOM.modelNameInput) DOM.modelNameInput.innerHTML = '<option value="">Loading models...</option>';
        const models: string[] = await ipcRenderer.invoke('ai:list-models');
        populateModelDropdown(models, currentSelectedModel || currentModelName);
    } catch (error) {
        const err = error as Error;
        console.error('Error fetching models:', err);
        appendMessage('Error', `Failed to load models: ${err.message}`);
        populateModelDropdown([], currentSelectedModel || currentModelName);
        if (DOM.refreshModelsBtn) DOM.refreshModelsBtn.style.display = 'inline';
    }
}

export async function loadSettings() {
    const savedKey = await ipcRenderer.invoke('settings:get-api-key');
    if (savedKey && DOM.apiKeyInput) {
        DOM.apiKeyInput.value = savedKey;
        hasValidApiKey = true;
    }
    const savedModelName = await ipcRenderer.invoke('settings:get-model-name');
    if (savedModelName) {
        currentModelName = savedModelName;
        if (DOM.modelNameInput) DOM.modelNameInput.value = savedModelName;
    }
    if (hasValidApiKey) {
        await fetchAndPopulateModels(currentModelName);
    }
}

export function initializeSettingsPanel() {
    DOM.settingsBtn?.addEventListener('click', () => {
        DOM.settingsPanel?.classList.add('visible');
        if (hasValidApiKey) {
            fetchAndPopulateModels(currentModelName);
        } else {
            populateModelDropdown([], currentModelName);
            if (DOM.refreshModelsBtn) DOM.refreshModelsBtn.style.display = 'inline';
        }
    });

    DOM.settingsCloseBtn?.addEventListener('click', () => {
        DOM.settingsPanel?.classList.remove('visible');
    });

    DOM.apiKeyInput?.addEventListener('change', async () => {
        if (!DOM.apiKeyInput) return;
        const newKey = DOM.apiKeyInput.value.trim();
        if (newKey) {
            await ipcRenderer.invoke('settings:set-api-key', newKey);
            hasValidApiKey = true;
            fetchAndPopulateModels(currentModelName);
        } else {
            hasValidApiKey = false;
            populateModelDropdown([], currentModelName);
            if (DOM.refreshModelsBtn) DOM.refreshModelsBtn.style.display = 'inline';
        }
    });

    DOM.modelNameInput?.addEventListener('change', async () => {
        if (!DOM.modelNameInput) return;
        const newModelName = DOM.modelNameInput.value;
        if (newModelName) {
            await ipcRenderer.invoke('settings:set-model-name', newModelName);
            currentModelName = newModelName;
        }
    });

    DOM.refreshModelsBtn?.addEventListener('click', () => {
        fetchAndPopulateModels(currentModelName);
    });

    loadSettings(); // Initial load of settings
}

// Getter for currentModelName to be used by ai-interface.ts
export function getCurrentModelName(): string {
    return DOM.modelNameInput?.value || currentModelName;
}

// Getter for hasValidApiKey
export function getHasValidApiKey(): boolean {
    return hasValidApiKey;
}
