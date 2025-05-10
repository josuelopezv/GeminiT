import { GoogleGenerativeAI } from '@google/generative-ai';

export const FALLBACK_MODELS = [
    'gemini-1.5-flash-latest',
    'gemini-1.0-pro',
    'gemini-pro',
];

export async function fetchModelsFromGoogle(apiKey: string): Promise<string[]> {
    if (!apiKey) {
        console.warn('fetchModelsFromGoogle: API key is missing.');
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
            return compatibleModels;
        }
        console.warn("fetchModelsFromGoogle: No compatible models found via SDK. Using fallback list.");
        return FALLBACK_MODELS;
    } catch (error) {
        console.error('fetchModelsFromGoogle: Error listing models via SDK:', error);
        if (error instanceof Error && error.message.includes('listModels is not a function')){
            console.warn("fetchModelsFromGoogle: genAI.listModels is not a function. SDK version or usage might be incorrect. Using fallback list.");
        } else {
            console.warn("fetchModelsFromGoogle: An unexpected error occurred while listing models via SDK. Using fallback list.");
        }
        return FALLBACK_MODELS;
    }
}
