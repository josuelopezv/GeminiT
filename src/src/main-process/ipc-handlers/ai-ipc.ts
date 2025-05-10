import { ipcMain, app } from 'electron';
import { IAiService, IAIResponse } from '../../interfaces/ai-service.interface';
import Store from 'electron-store';
import { Logger } from '../../utils/logger'; // Import Logger

const logger = new Logger('AI_IPC'); // Create a logger instance

interface AppStoreSchemaContents {
    geminiApiKey: string;
    geminiModelName: string;
}

export function initializeAiIpc(aiService: IAiService, storeInstance: Store<AppStoreSchemaContents>) {
    // Create a typed wrapper around the store instance
    const store = storeInstance as Store & {
        get<K extends keyof AppStoreSchemaContents>(key: K): AppStoreSchemaContents[K];
        set<K extends keyof AppStoreSchemaContents>(key: K, value: AppStoreSchemaContents[K]): void;
    };
    ipcMain.handle('ai:process-query', async (event, 
        { query, contextContent, contextType }: 
        { query: string; contextContent: string; contextType: string } // Added contextContent and contextType
    ): Promise<IAIResponse> => {
        try {
            const apiKey = (store as any).get('geminiApiKey') as string;
            const modelName = (store as any).get('geminiModelName') as string;

            if (!apiKey) throw new Error('Gemini API key is not set. Please set it in settings.');
            if (!modelName) throw new Error('Gemini Model Name is not set. Please set it in settings.');

            if (aiService.getApiKey() !== apiKey || aiService.getModelName() !== modelName) {
                aiService.updateApiKeyAndModel(apiKey, modelName);
            }

            if (!app.isPackaged) {
                logger.debug(`User Query:`, query);
                logger.debug(`Context Type for AI:`, contextType);
                // Detailed context content is now logged by AIService itself
            }

            // Pass contextContent and contextType to aiService.processQuery
            const response = await aiService.processQuery(query, contextContent, contextType);

            if (!app.isPackaged) {
                logger.debug(`AI Response:`, response);
            }
            return response;
        } catch (error) {
            const err = error as Error;
            if (!app.isPackaged) {
                logger.error(`AI Processing Error:`, err.stack || err.message);
            } else {
                logger.error('AI processing error in main:', err.message); // Log less detail in packaged app
            }
            throw err;
        }
    });

    ipcMain.handle('ai:list-models', async () => {
        try {
            const apiKey = (store as any).get('geminiApiKey') as string;
            if (!apiKey) {
                logger.warn('Cannot list models: API key is not set in store.');
                return [];
            }
            if (aiService.getApiKey() !== apiKey) {
                const currentModel = aiService.getModelName() || (store as any).get('geminiModelName') as string;
                aiService.updateApiKeyAndModel(apiKey, currentModel); 
            }
            if (!app.isPackaged) {
                logger.debug('Requesting list of available models...');
            }
            const models = await aiService.listAvailableModels();
            if (!app.isPackaged) {
                logger.debug(`Models received:`, models);
            }
            return models;
        } catch (error) {
            const err = error as Error;
            logger.error('Error listing AI models in main:', err.stack || err.message);
            throw err; 
        }
    });
}
