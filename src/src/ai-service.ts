import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

interface AIResponse {
    text: string;
    suggestedCommand?: string;
}

const FALLBACK_MODELS = [
    'gemini-1.5-flash-latest',
    'gemini-1.0-pro', // Older but might be available
    'gemini-pro', // Common alias
];

async function fetchModelsFromGoogle(apiKey: string): Promise<string[]> {
    if (!apiKey) {
        console.warn('fetchModelsFromGoogle: API key is missing.');
        return FALLBACK_MODELS; // Provide fallback if no API key to attempt SDK call
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

class AIService {
    private genAI!: GoogleGenerativeAI | null;
    private model!: GenerativeModel | null;
    private apiKey: string;
    private modelName: string;

    constructor(apiKey: string, modelName: string) {
        this.apiKey = apiKey;
        this.modelName = modelName;
        if (this.apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.apiKey);
            } catch (error) {
                console.error('Error initializing GoogleGenerativeAI in constructor:', error);
                this.genAI = null;
            }
        }
        this.initializeWithKeyAndModel(apiKey, modelName);
    }

    private initializeWithKeyAndModel(apiKey: string, modelName: string) {
        this.apiKey = apiKey;
        this.modelName = modelName;
        if (apiKey && !this.genAI) { 
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
            } catch (error) {
                console.error('Error initializing GoogleGenerativeAI in initializeWithKeyAndModel:', error);
                this.genAI = null;
                this.model = null;
                return;
            }
        }
        if (this.genAI && modelName) {
            try {
                this.model = this.genAI.getGenerativeModel({ model: this.modelName });
            } catch (error) {
                console.error(`Error initializing AI Service with model ${modelName}:`, error);
                this.model = null;
            }
        } else {
            this.model = null;
        }
    }

    updateApiKeyAndModel(apiKey: string, modelName: string) {
        if (apiKey !== this.apiKey || !this.genAI) {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
            } catch (error) {
                console.error('Error re-initializing GoogleGenerativeAI in updateApiKeyAndModel:', error);
                this.genAI = null;
                this.model = null;
                this.apiKey = apiKey;
                this.modelName = modelName;
                return;
            }
        }
        this.initializeWithKeyAndModel(apiKey, modelName);
    }

    getApiKey(): string {
        return this.apiKey;
    }

    getModelName(): string {
        return this.modelName;
    }

    async listAvailableModels(): Promise<string[]> {
        // Use the standalone helper function
        return fetchModelsFromGoogle(this.apiKey);
    }

    async processQuery(query: string, terminalHistory: string): Promise<AIResponse> {
        if (!this.apiKey || !this.modelName || !this.model) {
            throw new Error('AI Service is not initialized. API key or Model Name may be missing or invalid.');
        }
        try {
            const prompt = `You are an AI assistant helping with terminal commands.
            Recent terminal history:
            ${terminalHistory}
            
            User query: ${query}
            
            If the user is asking for a command, suggest one and explain what it does.
            If not, provide a helpful explanation.
            
            Format your response as:
            Explanation: <your explanation>
            Command: <suggested command if applicable>`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const commandMatch = text.match(/Command:\s*(.+)$/m);
            const explanationMatch = text.match(/Explanation:\s*(.+)(?=\nCommand:|$)/s);

            return {
                text: explanationMatch ? explanationMatch[1].trim() : text,
                suggestedCommand: commandMatch ? commandMatch[1].trim() : undefined
            };
        } catch (error) {
            console.error('AI Service Error:', error);
            throw error;
        }
    }
}

export { AIService, AIResponse };