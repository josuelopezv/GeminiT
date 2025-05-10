// filepath: c:\Users\Admin\source\repos\GeminiT\src\src\ai-providers\gemini-ai-provider.ts
import { net } from 'electron';
import { IAiProvider, IChatManager } from '../interfaces/ai-service.interface';
import { GeminiChatSessionManager } from '../gemini-chat-manager';
import { Logger } from '../utils/logger';

const logger = new Logger('GeminiAiProvider');

export class GeminiAiProvider implements IAiProvider {
    public getProviderName(): string {
        return 'Gemini';
    }

    public async fetchAvailableModels(apiKey: string): Promise<string[]> {
        if (!apiKey) {
            logger.warn('fetchAvailableModels: API key is missing.');
            throw new Error('API key is required to fetch models.');
        }

        logger.info('Fetching Gemini models from Google API...');
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

        try {
            const request = net.request({ method: 'GET', url });
            const responseBody = await new Promise<string>((resolve, reject) => {
                let body = '';
                request.on('response', (response) => {
                    logger.debug(`Fetch models response status: ${response.statusCode}`);
                    response.on('data', (chunk) => {
                        body += chunk.toString();
                    });
                    response.on('end', () => {
                        if (response.statusCode === 200) {
                            resolve(body);
                        } else {
                            logger.error(`Error fetching models: ${response.statusCode}`, body.substring(0, 500));
                            reject(new Error(`Failed to fetch models. Status: ${response.statusCode}.`));
                        }
                    });
                    response.on('error', (err: Error) => {
                        logger.error('Response error fetching models:', err);
                        reject(err);
                    });
                });
                request.on('error', (err: Error) => {
                    logger.error('Request error fetching models:', err);
                    reject(err);
                });
                request.end();
            });

            const parsedBody = JSON.parse(responseBody);
            if (parsedBody && parsedBody.models) {
                const modelNames = parsedBody.models
                    .map((model: any) => model.name)
                    .filter((name: string) => name && name.startsWith('models/')); // Ensure name exists before calling startsWith
                logger.info(`Found ${modelNames.length} Gemini models.`);
                return modelNames;
            }
            logger.warn('No models found in API response or response was malformed.');
            return [];
        } catch (error) {
            const err = error as Error;
            logger.error('Failed to fetch models from Google API:', err.message);
            // Rethrow the error so it can be caught by the caller (e.g., AIService or IPC handler)
            throw err; 
        }
    }

    public createChatManager(apiKey: string, modelName: string, initialModelInstruction: string): IChatManager {
        logger.info(`Creating GeminiChatSessionManager for model: ${modelName}`);
        return new GeminiChatSessionManager(apiKey, modelName, initialModelInstruction);
    }
}
