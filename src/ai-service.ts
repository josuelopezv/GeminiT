import { IAiProvider, IChatManager, IAIResponse, GenericMessagePart, IChatResponse } from './interfaces/ai-service.interface';
import { Logger } from './utils/logger';

const logger = new Logger('AIService');

class AIService {
    private aiProvider: IAiProvider;
    private chatManager: IChatManager | null = null;
    private apiKey: string;
    private modelName: string;
    private initialModelInstruction: string;
    private currentToolCallId: string | null = null;

    constructor(aiProvider: IAiProvider, apiKey: string, modelName: string, initialModelInstruction: string = '') {
        this.aiProvider = aiProvider;
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.initialModelInstruction = initialModelInstruction;
        this.initializeOrUpdateChatManager();
        logger.info(`AIService initialized with provider: ${aiProvider.getProviderName()}`);
    }

    private initializeOrUpdateChatManager(): void {
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

    public updateApiKeyAndModel(newApiKey: string, newModelName: string, newInitialModelInstruction?: string): void {
        logger.info('Updating API key, model, or instruction. Re-initializing chat manager.');
        this.apiKey = newApiKey;
        this.modelName = newModelName;
        this.initialModelInstruction = newInitialModelInstruction || ''; 
        this.initializeOrUpdateChatManager();
    }

    public setApiKey(apiKey: string): void {
        if (this.apiKey !== apiKey) {
            this.apiKey = apiKey;
            this.initializeOrUpdateChatManager();
        }
    }

    public setModelName(modelName: string): void {
        if (this.modelName !== modelName) {
            this.modelName = modelName;
            this.initializeOrUpdateChatManager();
        }
    }

    public setInitialModelInstruction(initialModelInstruction: string): void {
        if (this.initialModelInstruction !== initialModelInstruction) {
            this.initialModelInstruction = initialModelInstruction;
            this.initializeOrUpdateChatManager();
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

    public async processQuery(query: string, contextContent: string, contextType: string = 'terminal_history'): Promise<IAIResponse> {
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
                    const part = candidate.content.parts[0];
                    if (part.functionCall) {
                        this.currentToolCallId = part.functionCall.name;
                        logger.info('Function call received:', part.functionCall);
                        return {
                            toolCall: {
                                id: part.functionCall.name, // Or a more robust ID generation if needed
                                functionName: part.functionCall.name,
                                args: part.functionCall.args
                            }
                        };
                    }
                    if (part.text) {
                        logger.info('Text response received.');
                        return { text: part.text };
                    }
                }
            }
            logger.warn('No suitable response (text or function call) found in AI candidate.');
            return { text: 'No response from AI.' };
        } catch (error) {
            logger.error('Error processing query with chat manager:', error);
            throw error;
        }
    }

    public async processToolExecutionResult(toolCallId: string, functionName: string, commandOutput: string): Promise<IAIResponse> {
        if (!this.chatManager) {
            logger.error('Chat manager is not initialized. Cannot process tool execution result.');
            throw new Error('Chat manager is not initialized.');
        }
        // Ensure the result being processed matches the current tool call in progress
        // if (this.currentToolCallId !== toolCallId) {
        //     logger.error(`Mismatched toolCallId. Expected ${this.currentToolCallId}, got ${toolCallId}`);
        //     throw new Error('Mismatched toolCallId processing result.');
        // }

        const functionResponseParts: GenericMessagePart[] = [
            { functionResponse: { name: functionName, response: { output: commandOutput } } }
        ];

        try {
            logger.debug('Processing tool execution result with chat manager:', functionResponseParts);
            const chatResponse = await this.chatManager.sendFunctionResponse(functionResponseParts);
            this.currentToolCallId = null; 

            if (chatResponse && chatResponse.candidates && chatResponse.candidates.length > 0) {
                const candidate = chatResponse.candidates[0];
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    const part = candidate.content.parts[0];
                    if (part.text) {
                        logger.info('Text response received after tool execution.');
                        return { text: part.text };
                    }
                }
            }
            logger.warn('No suitable text response found in AI candidate after tool execution.');
            return { text: 'Tool executed, but no further textual response from AI.' };
        } catch (error) {
            logger.error('Error processing tool execution result with chat manager:', error);
            this.currentToolCallId = null; 
            throw error;
        }
    }
}

export { AIService };