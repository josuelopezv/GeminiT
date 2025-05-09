import { ipcMain } from 'electron';
import { AIService } from '../../ai-service';
import Store from 'electron-store'; // Import Store type directly

export function initializeAiIpc(aiService: AIService, store: Store) {
    ipcMain.handle('ai:process-query', async (event, { query, terminalHistory }: { query: string; terminalHistory: string }) => {
        try {
            const apiKey = store.get('geminiApiKey') as string || '';
            const modelName = store.get('geminiModelName') as string;

            if (!apiKey) {
                throw new Error('Gemini API key is not set. Please set it in settings.');
            }
            if (!modelName) {
                throw new Error('Gemini Model Name is not set. Please set it in settings.');
            }

            // Ensure aiService is initialized or updated with the latest key and model
            if (aiService.getApiKey() !== apiKey || aiService.getModelName() !== modelName) {
                aiService.updateApiKeyAndModel(apiKey, modelName);
            }
            return await aiService.processQuery(query, terminalHistory);
        } catch (error) {
            const err = error as Error;
            console.error('AI processing error in main:', err);
            throw err; // Re-throw to be caught by renderer's invoke
        }
    });
}
