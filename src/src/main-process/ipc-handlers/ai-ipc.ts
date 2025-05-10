import { ipcMain, app } from 'electron';
import { IAiService, IAIResponse } from '../../interfaces/ai-service.interface';
import { Logger } from '../../utils/logger';
import { AppStoreManager } from '../app-store-manager'; // Import the AppStoreManager class for type usage

const logger = new Logger('AI_IPC');

// Update function signature to use the imported AppStoreManager class as type
export function initializeAiIpc(aiService: IAiService, appStore: AppStoreManager) {
    // No need to reassign store, use appStore directly

    ipcMain.handle('ai:process-query', async (event, 
        { query, contextContent, contextType }: 
        { query: string; contextContent: string; contextType: string }
    ): Promise<IAIResponse> => {
        try {
            // Use AppStoreManager to get settings
            const apiKey = appStore.getGeminiApiKey();
            const modelName = appStore.getGeminiModelName();

            if (!apiKey) throw new Error('Gemini API key is not set. Please set it in settings.');
            if (!modelName) throw new Error('Gemini Model Name is not set. Please set it in settings.');

            if (aiService.getApiKey() !== apiKey || aiService.getModelName() !== modelName) {
                // Pass the initial instruction from the store as well if it needs to be updated
                const initialInstruction = appStore.getInitialModelInstruction();
                aiService.updateApiKeyAndModel(apiKey, modelName, initialInstruction);
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
            // Use AppStoreManager to get API key
            const apiKey = appStore.getGeminiApiKey();
            if (!apiKey) {
                logger.warn('Cannot list models: API key is not set in store.');
                return [];
            }
            // Ensure AI service is using the latest key from store before listing models
            if (aiService.getApiKey() !== apiKey) {
                const currentModel = appStore.getGeminiModelName(); // Get model from store
                const initialInstruction = appStore.getInitialModelInstruction(); // Get instruction from store
                aiService.updateApiKeyAndModel(apiKey, currentModel, initialInstruction); 
            }
            if (!app.isPackaged) {
                logger.debug('Requesting list of available models...');
            }
            const models = await aiService.listAvailableModels(apiKey); // Use the existing apiKey from the store
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
