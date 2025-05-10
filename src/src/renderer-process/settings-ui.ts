import { ipcRenderer } from 'electron';
import * as DOM from './dom-elements';
// Removed appendMessage import as it might not be directly needed here anymore, or keep if errors are shown via it.
import { fetchAndPopulateModels, populateModelDropdown } from './model-select';

// State variables managed by this module
let hasValidApiKey = false;
const currentModelNameRef = { value: '' }; // Use a ref object for mutable state shared with model-select

export async function loadSettings() {
    const savedKey = await ipcRenderer.invoke('settings:get-api-key');
    if (savedKey && DOM.apiKeyInput) {
        DOM.apiKeyInput.value = savedKey;
        hasValidApiKey = true;
    }
    const savedModelName = await ipcRenderer.invoke('settings:get-model-name');
    if (savedModelName) {
        currentModelNameRef.value = savedModelName;
        // Initial value for the dropdown, populateModelDropdown will select it if valid
        if (DOM.modelNameInput) DOM.modelNameInput.value = savedModelName; 
    }
    if (hasValidApiKey) {
        await fetchAndPopulateModels(hasValidApiKey, currentModelNameRef);
    } else {
        // Ensure dropdown is in a sensible state if no API key yet
        populateModelDropdown([], undefined, currentModelNameRef);
    }
}

export function initializeSettingsPanel() {
    DOM.settingsBtn?.addEventListener('click', () => {
        DOM.settingsPanel?.classList.add('visible');
        // Fetch models when panel opens, using current state
        fetchAndPopulateModels(hasValidApiKey, currentModelNameRef);
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
            fetchAndPopulateModels(hasValidApiKey, currentModelNameRef); // Fetch models after API key is set
        } else {
            hasValidApiKey = false;
            populateModelDropdown([], undefined, currentModelNameRef); // Corrected typo here
            if (DOM.refreshModelsBtn) DOM.refreshModelsBtn.style.display = 'inline';
        }
    });

    DOM.modelNameInput?.addEventListener('change', async () => {
        if (!DOM.modelNameInput) return;
        const newModelName = DOM.modelNameInput.value;
        if (newModelName) {
            await ipcRenderer.invoke('settings:set-model-name', newModelName);
            currentModelNameRef.value = newModelName; // Update the ref
        }
    });

    DOM.refreshModelsBtn?.addEventListener('click', () => {
        fetchAndPopulateModels(hasValidApiKey, currentModelNameRef);
    });

    loadSettings(); // Initial load of settings
}

// Getters for state needed by other modules (e.g., ai-interface.ts)
export function getCurrentModelName(): string {
    // Prefer the live value from the dropdown if available, otherwise the ref
    return DOM.modelNameInput?.value || currentModelNameRef.value;
}

export function getHasValidApiKey(): boolean {
    return hasValidApiKey;
}
