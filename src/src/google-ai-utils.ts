import { GoogleGenerativeAI } from '@google/generative-ai';
import { Logger } from './utils/logger'; // Corrected import path

const logger = new Logger('GoogleAIUtils'); // Create a logger instance

export const FALLBACK_MODELS = [
    'gemini-1.5-flash-latest',
    'gemini-1.0-pro',
    'gemini-pro',
];

export async function fetchModelsFromGoogle(apiKey: string): Promise<string[]> {
    if (!apiKey) {
        logger.warn('fetchModelsFromGoogle: API key is missing. Using fallback.');
        return FALLBACK_MODELS;
    }
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // @ts-ignore - Retaining for type-checking, but runtime is the primary issue.
        const modelsResult = await genAI.listModels();
        const compatibleModels: string[] = [];
        for (const m of modelsResult) {
            if (m.supportedGenerationMethods.includes('generateContent') && !m.name.includes('chat-bison') && !m.name.includes('text-bison')) {
                compatibleModels.push(m.name.replace(/^models\//, ''));
            }
        }
        if (compatibleModels.length > 0) {
            logger.debug('Successfully fetched models via SDK:', compatibleModels);
            return compatibleModels;
        }
        logger.warn("fetchModelsFromGoogle: No compatible models found via SDK. Using fallback list.");
        return FALLBACK_MODELS;
    } catch (error) {
        logger.error('fetchModelsFromGoogle: Error listing models via SDK:', error);
        if (error instanceof Error && error.message.includes('listModels is not a function')){
            logger.warn("fetchModelsFromGoogle: genAI.listModels is not a function. SDK version or usage might be incorrect. Using fallback list.");
        } else {
            logger.warn("fetchModelsFromGoogle: An unexpected error occurred while listing models via SDK. Using fallback list.");
        }
        return FALLBACK_MODELS;
    }
}
