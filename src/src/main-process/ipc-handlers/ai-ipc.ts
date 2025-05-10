import { ipcMain, app } from 'electron';
import { IAiService, IAIResponse } from '../../interfaces/ai-service.interface';
import Store from 'electron-store';
import { Logger } from '../../utils/logger'; // Import Logger

const logger = new Logger('AI_IPC'); // Create a logger instance

interface AppStoreSchemaContents {
    geminiApiKey: string;
    geminiModelName: string;
}

export function initializeAiIpc(aiService: IAiService, store: Store<AppStoreSchemaContents>) {
    ipcMain.handle('ai:process-query', async (event, { query, terminalHistory }: { query: string; terminalHistory: string }): Promise<IAIResponse> => {
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
                // The detailed condensed history is logged from AIService itself
            }

            const response = await aiService.processQuery(query, terminalHistory);

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

    ipcMain.handle('ai:process-tool-result', async (event, 
        { toolCallId, functionName, commandOutput }: 
        { toolCallId: string; functionName: string; commandOutput: string }
    ): Promise<IAIResponse> => {
        try {
            if (!app.isPackaged) {
                logger.debug(`Tool Result for ${functionName} (ID: ${toolCallId}):`, commandOutput.substring(0, 200));
            }
            const response = await aiService.processToolExecutionResult(toolCallId, functionName, commandOutput);
            if (!app.isPackaged) {
                logger.debug(`AI Follow-up Response:`, response);
            }
            return response;
        } catch (error) {
            const err = error as Error;
            logger.error(`Error processing AI tool result in main (ToolID: ${toolCallId}):`, err.stack || err.message);
            throw err; 
        }
    });
}
