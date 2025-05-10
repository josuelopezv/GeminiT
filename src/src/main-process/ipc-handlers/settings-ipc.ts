import { ipcMain } from 'electron';
import { IAiService } from '../../interfaces/ai-service.interface'; // Import IAiService
import Store from 'electron-store';
import { AppStoreSchemaContents } from '../../interfaces/store-schema.interface'; // Import shared interface

const DEFAULT_INITIAL_MODEL_INSTRUCTION = "You are a helpful AI assistant integrated into a terminal application. When a user asks for a command, or if a command is the most helpful response, provide the command in a markdown code block, specifying the language (e.g., powershell, bash, cmd). If you are providing a command, use the execute_terminal_command tool. Do not use it for other purposes. If the user asks a question about a previous command's output, I will provide that output as context.";

// Add type assertion to make TypeScript happy with electron-store methods
export function initializeSettingsIpc(storeInstance: Store<AppStoreSchemaContents>, aiService: IAiService) {
    // Use the storeInstance directly, its type already provides typed get/set
    const store = storeInstance;
    
    // Use IAiService type
    ipcMain.handle('settings:set-api-key', async (event, apiKey: string) => {
        try {
            store.set('geminiApiKey', apiKey);
            aiService.updateApiKeyAndModel(apiKey, store.get('geminiModelName') as string);
            return { success: true };
        } catch (error) {
            const err = error as Error;
            console.error('Error setting API key:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('settings:get-api-key', async () => {
        return store.get('geminiApiKey') as string;
    });

    ipcMain.handle('settings:set-model-name', async (event, modelName: string) => {
        try {
            store.set('geminiModelName', modelName);
            aiService.updateApiKeyAndModel(store.get('geminiApiKey') as string, modelName);
            return { success: true };
        } catch (error) {
            const err = error as Error;
            console.error('Error setting model name:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('settings:get-model-name', async () => {
        return store.get('geminiModelName') as string;
    });

    ipcMain.handle('settings:set-initial-model-instruction', async (event, instruction: string) => {
        try {
            store.set('initialModelInstruction', instruction);
            // Also update the AI service with the new instruction
            aiService.updateApiKeyAndModel(
                store.get('geminiApiKey') as string,
                store.get('geminiModelName') as string,
                instruction
            );
            return { success: true };
        } catch (error) {
            const err = error as Error;
            console.error('Error setting initial model instruction:', err);
            return { success: false, error: err.message };
        }
    });    ipcMain.handle('settings:get-initial-model-instruction', async () => {
        const value = store.get('initialModelInstruction');
        return value === undefined ? DEFAULT_INITIAL_MODEL_INSTRUCTION : value;
    });
}
