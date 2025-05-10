// This file is now deprecated. Its functionality has been moved to SettingsPanelComponent.tsx.
// Please delete this file.

import { ipcRenderer } from 'electron';
import * as DOM from './dom-elements';
import { appendMessage } from './ui-utils';

/**
 * Populates the model dropdown with a list of models.
 * @param models Array of model names.
 * @param selectedModel Optional currently selected model name.
 * @param currentModelNameRef A mutable ref object to update the currentModelName in the calling module.
 * @returns The model name that ended up being selected (or empty if none).
 */
export function populateModelDropdown(
    models: string[], 
    selectedModel: string | undefined,
    currentModelNameRef: { value: string }
): string {
    if (!DOM.modelNameInput) return '';
    DOM.modelNameInput.innerHTML = ''; // Clear existing options

    if (models.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No compatible models found or API key invalid.';
        DOM.modelNameInput.appendChild(option);
        if (DOM.refreshModelsBtn) DOM.refreshModelsBtn.style.display = 'inline';
        currentModelNameRef.value = '';
        return '';
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

    let finalSelectedModel = '';
    if (selectedModel && models.includes(selectedModel)) {
        DOM.modelNameInput.value = selectedModel;
        finalSelectedModel = selectedModel;
    } else if (currentModelNameRef.value && models.includes(currentModelNameRef.value)) {
        DOM.modelNameInput.value = currentModelNameRef.value;
        finalSelectedModel = currentModelNameRef.value;
    } else if (models.length > 0) {
        DOM.modelNameInput.value = models[0];
        finalSelectedModel = models[0];
    }
    currentModelNameRef.value = finalSelectedModel;
    // The event listener in settings-ui.ts will handle saving this change.
    return finalSelectedModel;
}

/**
 * Fetches models from the main process and populates the dropdown.
 * @param hasValidApiKey Indicates if a valid API key is currently set.
 * @param currentModelNameRef A mutable ref object to update the currentModelName in the calling module.
 */
export async function fetchAndPopulateModels(
    hasValidApiKey: boolean,
    currentModelNameRef: { value: string }
) {
    if (!hasValidApiKey) {
        populateModelDropdown([], undefined, currentModelNameRef);
        if (DOM.refreshModelsBtn) DOM.refreshModelsBtn.style.display = 'inline';
        return;
    }
    try {
        if (DOM.modelNameInput) DOM.modelNameInput.innerHTML = '<option value="">Loading models...</option>';
        const models: string[] = await ipcRenderer.invoke('ai:list-models');
        const newlySelected = populateModelDropdown(models, currentModelNameRef.value, currentModelNameRef);
        // If a new default was selected by populateModelDropdown, ensure it's saved.
        if (newlySelected && newlySelected !== currentModelNameRef.value) {
             // This state is managed by settings-ui.ts via its event listener on modelNameInput change.
        }
        currentModelNameRef.value = newlySelected; // Ensure ref is updated

    } catch (error) {
        const err = error as Error;
        console.error('Error fetching models:', err);
        appendMessage('Error', `Failed to load models: ${err.message}`);
        populateModelDropdown([], undefined, currentModelNameRef);
        if (DOM.refreshModelsBtn) DOM.refreshModelsBtn.style.display = 'inline';
    }
}
