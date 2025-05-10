import { ipcMain } from 'electron';
import { AIService } from '../../ai-service';
import Store from 'electron-store'; // Keep the import for type annotation if desired

interface AppStoreSchemaContents { // Keep schema for clarity if needed, or remove if AppStoreType was fully removed
    geminiApiKey: string;
    geminiModelName: string;
}

// The 'store' parameter type can be Store<AppStoreSchemaContents> or just Store
export function initializeAiIpc(aiService: AIService, store: Store<AppStoreSchemaContents>) {
    ipcMain.handle('ai:process-query', async (event, { query, terminalHistory }: { query: string; terminalHistory: string }) => {
        try {
            const apiKey = (store as any).get('geminiApiKey') as string;
            const modelName = (store as any).get('geminiModelName') as string;

            if (!apiKey) {
                throw new Error('Gemini API key is not set. Please set it in settings.');
            }
            if (!modelName) {
                throw new Error('Gemini Model Name is not set. Please set it in settings.');
            }

            if (aiService.getApiKey() !== apiKey || aiService.getModelName() !== modelName) {
                aiService.updateApiKeyAndModel(apiKey, modelName);
            }
            return await aiService.processQuery(query, terminalHistory);
        } catch (error) {
            const err = error as Error;
            console.error('AI processing error in main:', err);
            throw err;
        }
    });
}
