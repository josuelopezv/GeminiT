import { ipcMain, net } from 'electron';
import { IAiService } from '../../interfaces/ai-service.interface';
// import Store from 'electron-store'; // No longer directly using Store type here
// import { AppStoreSchemaContents } from '../../interfaces/store-schema.interface';
import { AppStoreManager } from '../app-store-manager'; // Import AppStoreManager class for type usage
import { Logger } from '../../utils/logger';

const logger = new Logger('SettingsIPC');

const DEFAULT_INITIAL_MODEL_INSTRUCTION = "You are a helpful AI assistant integrated into a terminal application. When a user asks for a command, or if a command is the most helpful response, provide the command in a markdown code block, specifying the language (e.g., powershell, bash, cmd). If you are providing a command, use the execute_terminal_command tool. Do not use it for other purposes. If the user asks a question about a previous command's output, I will provide that output as context.";

// Update function signature to accept AppStoreManager
export function initializeSettingsIpc(appStore: AppStoreManager, aiService: IAiService) {
    // No need to reassign store, use appStore directly
    
    ipcMain.handle('settings:set-api-key', async (event, apiKey: string) => {
        try {
            appStore.setGeminiApiKey(apiKey); // Use AppStoreManager method
            // When setting API key, also update AIService with current model and instruction from store
            aiService.updateApiKeyAndModel(
                apiKey, 
                appStore.getGeminiModelName(), 
                appStore.getInitialModelInstruction()
            );
            logger.info('API key updated and set in store.');
            return { success: true };
        } catch (error) {
            const err = error as Error;
            logger.error('Error setting API key:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('settings:get-api-key', async () => {
        const apiKey = appStore.getGeminiApiKey(); // Use AppStoreManager method
        return apiKey;
    });

    ipcMain.handle('settings:set-model-name', async (event, modelName: string) => {
        try {
            appStore.setGeminiModelName(modelName); // Use AppStoreManager method
            // When setting model name, also update AIService with current API key and instruction from store
            aiService.updateApiKeyAndModel(
                appStore.getGeminiApiKey(), 
                modelName, 
                appStore.getInitialModelInstruction()
            );
            logger.info(`Model name updated to "${modelName}" and set in store.`);
            return { success: true };
        } catch (error) {
            const err = error as Error;
            logger.error('Error setting model name:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('settings:get-model-name', async () => {
        const modelName = appStore.getGeminiModelName(); // Use AppStoreManager method
        return modelName;
    });

    ipcMain.handle('settings:set-initial-model-instruction', async (event, instruction: string) => {
        try {
            appStore.setInitialModelInstruction(instruction); // Use AppStoreManager method
            aiService.updateApiKeyAndModel(
                appStore.getGeminiApiKey(),
                appStore.getGeminiModelName(),
                instruction
            );
            logger.info('Initial model instruction updated and set in store.');
            return { success: true };
        } catch (error) {
            const err = error as Error;
            logger.error('Error setting initial model instruction:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('settings:get-initial-model-instruction', async () => {
        const instructionFromStore = appStore.getInitialModelInstruction();
        // If the stored instruction is an empty string, return the default instruction.
        // Otherwise, return the stored instruction.
        // The schema default (long string) handles the case where the key was never set.
        if (instructionFromStore === '') {
            logger.debug('Stored initial model instruction is empty, returning default.');
            return DEFAULT_INITIAL_MODEL_INSTRUCTION;
        }
        return instructionFromStore;
    });

    // Modified handler for fetching models
    ipcMain.handle('settings:fetch-models', async (event, apiKeyFromRenderer: string) => {
        // Prefer apiKey passed from renderer for this specific action, 
        // as user might be testing a new key before saving it.
        const apiKeyToUse = apiKeyFromRenderer || appStore.getGeminiApiKey();

        if (!apiKeyToUse) {
            logger.warn('settings:fetch-models: API key is missing.');
            return [];
        }

        try {
            logger.info(`IPC settings:fetch-models: Triggering model fetch with API Key: ${apiKeyToUse ? 'provided' : 'missing'}`);
            // Ensure AI service is temporarily configured with this key for the fetch if it's different
            // This is a bit tricky as listAvailableModels now takes the key directly.
            // We should ensure AIService itself uses the key passed to listAvailableModels.
            // The current AIService.listAvailableModels(apiKey) should be sufficient.
            
            const models = await aiService.listAvailableModels(apiKeyToUse);
            logger.info(`IPC settings:fetch-models: Received ${models.length} models from AIService.`);
            return models;
        } catch (error) {
            const err = error as Error;
            logger.error('IPC settings:fetch-models: Error calling aiService.listAvailableModels:', err.message);
            throw err; // Propagate error to renderer
        }
    });
}
