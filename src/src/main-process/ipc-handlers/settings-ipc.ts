import { ipcMain } from 'electron';
import { AIService } from '../../ai-service';
import Store from 'electron-store'; // Keep the import for type annotation if desired

interface AppStoreSchemaContents { // Keep schema for clarity if needed
    geminiApiKey: string;
    geminiModelName: string;
}

// The 'store' parameter type can be Store<AppStoreSchemaContents> or just Store
export function initializeSettingsIpc(store: Store<AppStoreSchemaContents>, aiService: AIService) {
    ipcMain.handle('settings:set-api-key', async (event, apiKey: string) => {
        try {
            (store as any).set('geminiApiKey', apiKey);
            aiService.updateApiKeyAndModel(apiKey, (store as any).get('geminiModelName') as string);
            return { success: true };
        } catch (error) {
            const err = error as Error;
            console.error('Error setting API key:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('settings:get-api-key', async () => {
        return (store as any).get('geminiApiKey') as string;
    });

    ipcMain.handle('settings:set-model-name', async (event, modelName: string) => {
        try {
            (store as any).set('geminiModelName', modelName);
            aiService.updateApiKeyAndModel((store as any).get('geminiApiKey') as string, modelName);
            return { success: true };
        } catch (error) {
            const err = error as Error;
            console.error('Error setting model name:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('settings:get-model-name', async () => {
        return (store as any).get('geminiModelName') as string;
    });
}
