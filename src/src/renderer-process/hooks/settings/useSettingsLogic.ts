import { useState, useEffect, useCallback } from 'react';
import { ipcRenderer } from 'electron';
import { Logger } from '../../../utils/logger';

const logger = new Logger('useSettingsLogic');

interface UseSettingsLogicProps {
    initialApiKey: string;
    initialModelName: string;
    initialModelInstruction: string;
    onApiKeyChange: (key: string) => void;
    onModelNameChange: (name: string) => void;
    onInitialModelInstructionChange: (instruction: string) => void;
    onClose: () => void;
}

export const useSettingsLogic = ({
    initialApiKey,
    initialModelName,
    initialModelInstruction,
    onApiKeyChange,
    onModelNameChange,
    onInitialModelInstructionChange,
    onClose
}: UseSettingsLogicProps) => {
    const [apiKey, setApiKey] = useState(initialApiKey || '');
    const [modelName, setModelName] = useState(initialModelName || '');
    const [modelInstruction, setModelInstruction] = useState(initialModelInstruction || '');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setApiKey(initialApiKey || '');
        setModelName(initialModelName || '');
        setModelInstruction(initialModelInstruction || '');
    }, [initialApiKey, initialModelName, initialModelInstruction]);

    const handleFetchModels = useCallback(async () => {
        if (!apiKey) {
            setError('API key is required to fetch models.');
            setAvailableModels([]);
            return;
        }
        setIsLoadingModels(true);
        setError(null);
        try {
            const models = await ipcRenderer.invoke('settings:fetch-models', apiKey);
            setAvailableModels(models || []);
            if (!models || models.length === 0) {
                setError('No models found for this API key or an error occurred.');
            }
        } catch (err: any) {
            logger.error('Error fetching models:', err);
            setError(err.message || 'Failed to fetch models.');
            setAvailableModels([]);
        }
        setIsLoadingModels(false);
    }, [apiKey]);

    const handleSave = async () => {
        try {
            setError(null);
            logger.info('Attempting to save settings...');

            // API Key
            const apiKeyResult = await ipcRenderer.invoke('settings:set-api-key', apiKey);
            if (!apiKeyResult.success) {
                throw new Error(apiKeyResult.error || 'Failed to save API key.');
            }
            onApiKeyChange(apiKey);
            logger.info('API key saved successfully.');

            // Model Name
            const modelNameResult = await ipcRenderer.invoke('settings:set-model-name', modelName);
            if (!modelNameResult.success) {
                throw new Error(modelNameResult.error || 'Failed to save model name.');
            }
            onModelNameChange(modelName);
            logger.info('Model name saved successfully.');

            // Initial Model Instruction
            const instructionResult = await ipcRenderer.invoke('settings:set-initial-model-instruction', modelInstruction);
            if (!instructionResult.success) {
                throw new Error(instructionResult.error || 'Failed to save model instruction.');
            }
            onInitialModelInstructionChange(modelInstruction);
            logger.info('Model instruction saved successfully.');

            onClose();
        } catch (err: any) {
            logger.error('Error saving settings:', err);
            setError(err.message || 'An unexpected error occurred while saving settings.');
        }
    };

    return {
        apiKey,
        modelName,
        modelInstruction,
        availableModels,
        isLoadingModels,
        error,
        setApiKey,
        setModelName,
        setModelInstruction,
        handleFetchModels,
        handleSave
    };
};

export type UseSettingsLogicReturn = ReturnType<typeof useSettingsLogic>;
