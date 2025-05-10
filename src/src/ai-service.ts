import { IAiProvider, IChatManager, IAiService as IServiceInterface, IAIResponse as IServiceAIResponse, GenericMessagePart } from './interfaces/ai-service.interface';
import { Logger } from './utils/logger';

const logger = new Logger('AIService');

class AIService implements IServiceInterface {
    private aiProvider: IAiProvider;
    private chatManager: IChatManager | null = null;
    private apiKey: string;
    private modelName: string;
    private initialModelInstruction: string;

    constructor(aiProvider: IAiProvider, apiKey: string, modelName: string, initialModelInstruction: string = '') {
        this.aiProvider = aiProvider;
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.initialModelInstruction = initialModelInstruction;
        this.initializeOrUpdateChatManager();
        logger.info(`AIService initialized with provider: ${aiProvider.getProviderName()}`);
    }

    private initializeOrUpdateChatManager() {
        if (this.apiKey && this.modelName) {
            try {
                this.chatManager = this.aiProvider.createChatManager(
                    this.apiKey,
                    this.modelName,
                    this.initialModelInstruction
                );
                logger.info(`Chat manager created/updated for model: ${this.modelName} using ${this.aiProvider.getProviderName()}`);
            } catch (error) {
                logger.error('Error initializing chat manager via provider:', error);
                this.chatManager = null;
            }
        } else {
            logger.warn('API key or model name is missing, cannot initialize chat manager.');
            this.chatManager = null;
        }
    }

    public updateApiKeyAndModel(apiKey: string, modelName: string, newInitialModelInstruction?: string) {
        const keyChanged = this.apiKey !== apiKey;
        const modelChanged = this.modelName !== modelName;
        const instructionChanged = newInitialModelInstruction !== undefined && this.initialModelInstruction !== newInitialModelInstruction;

        this.apiKey = apiKey;
        this.modelName = modelName;
        if (newInitialModelInstruction !== undefined) {
            this.initialModelInstruction = newInitialModelInstruction;
        }

        if (keyChanged || modelChanged || instructionChanged) {
            logger.info(`Updating API key, model, or instruction. Re-initializing chat manager.`);
            this.initializeOrUpdateChatManager();
        } else {
            logger.info('No change in API key, model, or instruction. Chat manager not re-initialized.');
        }
    }

    public getApiKey(): string {
        return this.apiKey;
    }

    public getModelName(): string {
        return this.modelName;
    }

    public async listAvailableModels(apiKey: string): Promise<string[]> {
        if (!apiKey) {
            logger.warn('Cannot list models: API key is not provided.');
            return [];
        }
        try {
            logger.info(`Fetching available models using provider: ${this.aiProvider.getProviderName()}`);
            return await this.aiProvider.fetchAvailableModels(apiKey);
        } catch (error) {
            logger.error('Error fetching available models via provider:', error);
            return [];
        }
    }

    public async processQuery(query: string, contextContent: string, contextType: string = 'terminal_history'): Promise<IServiceAIResponse> {
        if (!this.chatManager) {
            logger.error('Chat manager is not initialized. Cannot process query.');
            throw new Error('Chat manager is not initialized.');
        }

        const userMessageParts: GenericMessagePart[] = [];
        if (contextContent) {
            userMessageParts.push({ text: `Context (${contextType}):\n${contextContent}\n\nUser Query: ${query}` });
        } else {
            userMessageParts.push({ text: query });
        }

        try {
            logger.debug('Processing query with chat manager:', userMessageParts);
            const chatResponse = await this.chatManager.sendMessage(userMessageParts);

            if (chatResponse && chatResponse.candidates && chatResponse.candidates.length > 0) {
                const candidate = chatResponse.candidates[0];
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    const textPart = candidate.content.parts.find(part => part.text !== undefined && part.text !== null);
                    if (textPart && typeof textPart.text === 'string') {
                        logger.info('Text response received.');
                        return { text: textPart.text };
                    }
                }
            }
            logger.warn('No suitable text response found in AI candidate.');
            return { text: 'No response from AI.' };
        } catch (error) {
            logger.error('Error processing query with chat manager:', error);
            throw error;
        }
    }
}

export { AIService };