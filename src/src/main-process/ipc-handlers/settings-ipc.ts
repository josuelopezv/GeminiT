import { ipcMain, net } from 'electron';
import { IAiService } from '../../interfaces/ai-service.interface'; // Import IAiService
import Store from 'electron-store';
import { AppStoreSchemaContents } from '../../interfaces/store-schema.interface'; // Import shared interface
import { Logger } from '../../utils/logger'; // Import Logger

const logger = new Logger('SettingsIPC'); // Create a logger instance for this module

const DEFAULT_INITIAL_MODEL_INSTRUCTION = "You are a helpful AI assistant integrated into a terminal application. When a user asks for a command, or if a command is the most helpful response, provide the command in a markdown code block, specifying the language (e.g., powershell, bash, cmd). If you are providing a command, use the execute_terminal_command tool. Do not use it for other purposes. If the user asks a question about a previous command's output, I will provide that output as context.";

// Add type assertion to make TypeScript happy with electron-store methods
export function initializeSettingsIpc(storeInstance: Store<AppStoreSchemaContents>, aiService: IAiService) {
    // Use the storeInstance directly, its type already provides typed get/set
    const store = storeInstance;
    
    // Use IAiService type
    ipcMain.handle('settings:set-api-key', async (event, apiKey: string) => {
        try {
            (store as any).set('geminiApiKey', apiKey);
            aiService.updateApiKeyAndModel(apiKey, (store as any).get('geminiModelName') as string);
            logger.info('API key updated and set in store.');
            return { success: true };
        } catch (error) {
            const err = error as Error;
            logger.error('Error setting API key:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('settings:get-api-key', async () => {
        const apiKey = (store as any).get('geminiApiKey') as string;
        // logger.debug('Retrieved API key.'); // Can be noisy
        return apiKey;
    });

    ipcMain.handle('settings:set-model-name', async (event, modelName: string) => {
        try {
            (store as any).set('geminiModelName', modelName);
            aiService.updateApiKeyAndModel((store as any).get('geminiApiKey') as string, modelName);
            logger.info(`Model name updated to "${modelName}" and set in store.`);
            return { success: true };
        } catch (error) {
            const err = error as Error;
            logger.error('Error setting model name:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('settings:get-model-name', async () => {
        const modelName = (store as any).get('geminiModelName') as string;
        // logger.debug('Retrieved model name.'); // Can be noisy
        return modelName;
    });

    ipcMain.handle('settings:set-initial-model-instruction', async (event, instruction: string) => {
        try {
            (store as any).set('initialModelInstruction', instruction);
            aiService.updateApiKeyAndModel(
                (store as any).get('geminiApiKey') as string,
                (store as any).get('geminiModelName') as string,
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
        const value = (store as any).get('initialModelInstruction');
        const instruction = value === undefined ? DEFAULT_INITIAL_MODEL_INSTRUCTION : value;
        // logger.debug('Retrieved initial model instruction.'); // Can be noisy
        return instruction;
    });

    // Modified handler for fetching models, now delegates to AIService
    ipcMain.handle('settings:fetch-models', async (event, apiKey: string) => {
        if (!apiKey) {
            logger.warn('fetch-models: API key is missing from renderer.');
            logger.warn('fetch-models: API key from renderer is currently not directly passed to aiService.listAvailableModels. AIService will use its stored API key.');
        }

        try {
            logger.info(`IPC settings:fetch-models: Triggering model fetch. Renderer API Key: ${apiKey ? 'provided' : 'missing'}`);
            const models = await aiService.listAvailableModels(); // This uses aiService's internal API key.
            logger.info(`IPC settings:fetch-models: Received ${models.length} models from AIService.`);
            return models;
        } catch (error) {
            const err = error as Error;
            logger.error('IPC settings:fetch-models: Error calling aiService.listAvailableModels:', err.message);
            throw err; // Propagate error to renderer
        }
    });
}
