import { 
    IAiProvider, 
    IChatManager, 
    IAiService as IServiceInterface, 
    IAIResponse as IServiceAIResponse, 
    GenericMessagePart 
} from '../interfaces/ai-service.interface';
import { Logger } from '../utils/logger';
import { AIConfigManager } from './chat/ai-config-manager';
import { ChatResponseProcessor } from './chat/chat-response-processor';

export class AIService implements IServiceInterface {
    private logger: Logger;
    private aiProvider: IAiProvider;
    private chatManager: IChatManager | null = null;
    private configManager: AIConfigManager;
    private responseProcessor: ChatResponseProcessor;

    constructor(aiProvider: IAiProvider, apiKey: string, modelName: string, initialModelInstruction: string = '') {
        this.logger = new Logger('AIService');
        this.aiProvider = aiProvider;
        this.configManager = new AIConfigManager(apiKey, modelName, initialModelInstruction);
        this.responseProcessor = new ChatResponseProcessor();
        this.initializeOrUpdateChatManager();
    }

    private initializeOrUpdateChatManager(): void {
        if (this.configManager.isConfigValid()) {
            try {
                this.chatManager = this.aiProvider.createChatManager(
                    this.configManager.getApiKey(),
                    this.configManager.getModelName(),
                    this.configManager.getInitialInstruction()
                );
                this.logger.info(`Chat manager created/updated for model: ${this.configManager.getModelName()}`);
            } catch (error) {
                this.logger.error('Error initializing chat manager:', error);
                this.chatManager = null;
            }
        } else {
            this.logger.warn('Invalid configuration, cannot initialize chat manager.');
            this.chatManager = null;
        }
    }

    public updateApiKeyAndModel(apiKey: string, modelName: string, newInitialModelInstruction?: string): void {
        const configChanged = this.configManager.updateConfig(apiKey, modelName, newInitialModelInstruction);
        if (configChanged) {
            this.initializeOrUpdateChatManager();
        }
    }

    public getApiKey(): string {
        return this.configManager.getApiKey();
    }

    public getModelName(): string {
        return this.configManager.getModelName();
    }

    public async listAvailableModels(apiKey: string): Promise<string[]> {
        if (!apiKey) {
            this.logger.warn('Cannot list models: API key is not provided.');
            return [];
        }
        try {
            this.logger.info('Fetching available models...');
            return await this.aiProvider.fetchAvailableModels(apiKey);
        } catch (error) {
            this.logger.error('Error fetching available models:', error);
            return [];
        }
    }

    public async processQuery(query: string, contextContent: string, contextType: string = 'terminal_history'): Promise<IServiceAIResponse> {
        if (!this.chatManager) {
            this.logger.error('Chat manager is not initialized. Cannot process query.');
            throw new Error('Chat manager is not initialized.');
        }

        const userMessageParts: GenericMessagePart[] = [];
        if (contextContent) {
            userMessageParts.push({ text: `Context (${contextType}):\n${contextContent}\n\nUser Query: ${query}` });
        } else {
            userMessageParts.push({ text: query });
        }

        try {
            this.logger.debug('Processing query...');
            const chatResponse = await this.chatManager.sendMessage(userMessageParts);
            if (!chatResponse) {
                throw new Error('No response received from chat manager');
            }
            return this.responseProcessor.processResponse(chatResponse);
        } catch (error) {
            this.logger.error('Error processing query:', error);
            throw error;
        }
    }
}
