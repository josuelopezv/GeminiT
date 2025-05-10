import { ipcMain, app } from 'electron';
import { IAiService, IAIResponse } from '../../interfaces/ai-service.interface'; // Import IAiService and IAIResponse
import Store from 'electron-store';

interface AppStoreSchemaContents {
    geminiApiKey: string;
    geminiModelName: string;
}

export function initializeAiIpc(aiService: IAiService, store: Store<AppStoreSchemaContents>) { // Use IAiService type
    ipcMain.handle('ai:process-query', async (event, { query, terminalHistory }: { query: string; terminalHistory: string }): Promise<IAIResponse> => { // Return IAIResponse
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

            if (!app.isPackaged) { // Conditional logging
                console.log('[DEV AI Query]:', query);
                console.log('[DEV AI History Context (last 500 chars)]:', terminalHistory.slice(-500));
            }

            const response = await aiService.processQuery(query, terminalHistory);

            if (!app.isPackaged) { // Conditional logging
                console.log('[DEV AI Response]:', response);
            }

            return response;
        } catch (error) {
            const err = error as Error;
            if (!app.isPackaged) { // Conditional logging for errors
                console.error('[DEV AI Processing Error]:', err);
            }
            console.error('AI processing error in main:', err);
            throw err;
        }
    });

    ipcMain.handle('ai:list-models', async () => {
        try {
            const apiKey = (store as any).get('geminiApiKey') as string;
            if (!apiKey) {
                // Don't throw an error, just return empty if no key, renderer can decide to prompt for key.
                console.warn('Cannot list models: API key is not set in store.');
                return [];
            }
            // Ensure AI service has the latest API key before listing models
            if (aiService.getApiKey() !== apiKey) {
                // Temporarily update API key in the service instance for this call
                // The model name used here doesn't matter for listModels, but API key does.
                const currentModel = aiService.getModelName() || (store as any).get('geminiModelName') as string;
                aiService.updateApiKeyAndModel(apiKey, currentModel); 
            }
            
            if (!app.isPackaged) {
                console.log('[DEV AI]: Requesting list of available models...');
            }
            const models = await aiService.listAvailableModels();
            if (!app.isPackaged) {
                console.log('[DEV AI]: Models received:', models);
            }
            return models;
        } catch (error) {
            const err = error as Error;
            if (!app.isPackaged) {
                console.error('[DEV AI List Models Error]:', err);
            }
            console.error('Error listing AI models in main:', err);
            throw err; // Re-throw to be caught by renderer's invoke
        }
    });

    ipcMain.handle('ai:process-tool-result', async (event, 
        { toolCallId, functionName, commandOutput }: 
        { toolCallId: string; functionName: string; commandOutput: string }
    ): Promise<IAIResponse> => { // Return IAIResponse
        try {
            if (!app.isPackaged) { // Conditional logging
                console.log(`[DEV AI Tool Result for ${functionName} (ID: ${toolCallId})]:`, commandOutput.substring(0, 200));
            }
            // The AIService needs to be already configured with API key and model via previous calls or initialization
            const response = await aiService.processToolExecutionResult(toolCallId, functionName, commandOutput);
            
            if (!app.isPackaged) { // Conditional logging
                console.log('[DEV AI Follow-up Response]:', response);
            }
            return response;
        } catch (error) {
            const err = error as Error;
            if (!app.isPackaged) { // Conditional logging for errors
                console.error('[DEV AI Processing Tool Result Error]:', err);
            }
            console.error('Error processing AI tool result in main:', err);
            throw err; // Re-throw to be caught by renderer's invoke
        }
    });
}
