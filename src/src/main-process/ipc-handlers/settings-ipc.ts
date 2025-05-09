import { ipcMain } from 'electron';
import { AIService } from '../../ai-service';
import Store from 'electron-store'; // Import Store type directly

export function initializeSettingsIpc(store: Store, aiService: AIService) {
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
        return store.get('geminiApiKey') || '';
    });

    ipcMain.handle('settings:set-model-name', async (event, modelName: string) => {
        try {
            store.set('geminiModelName', modelName);
            aiService.updateApiKeyAndModel(store.get('geminiApiKey') as string || '', modelName);
            return { success: true };
        } catch (error) {
            const err = error as Error;
            console.error('Error setting model name:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('settings:get-model-name', async () => {
        return store.get('geminiModelName') || '';
    });
}
