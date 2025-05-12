import { 
    GoogleGenerativeAI, 
    GenerativeModel, 
    Content,
    ChatSession
} from '@google/generative-ai';
import { IChatManager, IChatResponse, GenericMessagePart } from '../../interfaces/ai-service.interface';
import { Logger } from '../../utils/logger';
import { ChatHistoryManager } from './chat-history-manager';
import { MessageMapper } from './message-mapper';
import { BaseChatManager } from './base-chat-manager';

export class GeminiChatManager extends BaseChatManager {
    private genAI: GoogleGenerativeAI | null = null;
    private modelInstance: GenerativeModel | null = null;
    private currentChatSession: ChatSession | null = null;
    private historyManager: ChatHistoryManager;
    private messageMapper: MessageMapper;

    constructor(apiKey: string, modelName: string, initialInstruction: string) {
        super(apiKey, modelName, initialInstruction);
        this.logger = new Logger('GeminiChatManager');
        this.historyManager = new ChatHistoryManager(initialInstruction);
        this.messageMapper = new MessageMapper();
        this.initialize();
    }

    public async initialize(): Promise<void> {
        try {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            if (this.modelName && this.genAI) {
                this.modelInstance = this.genAI.getGenerativeModel({ 
                    model: this.modelName
                });
                await this.startNewChatSession();
                this.logger.info(`SDK and model initialized for: ${this.modelName}`);
            } else {
                this.modelInstance = null;
                this.logger.warn('Model name or genAI instance not available during SDK init.');
            }
        } catch (error) {
            this.logger.error('Error initializing GoogleGenerativeAI or Model:', error);
            this.genAI = null;
            this.modelInstance = null;
            throw error;
        }
    }

    private async startNewChatSession(): Promise<void> {
        if (!this.modelInstance) {
            this.logger.error('Model instance not available to start chat session.');
            this.currentChatSession = null;
            return;
        }

        this.currentChatSession = this.modelInstance.startChat({
            history: this.historyManager.getHistory()
        });
        this.logger.info('New chat session started.');
    }

    public updateCredentials(apiKey: string, modelName: string, newInitialInstruction?: string): void {
        const credsChanged = this.apiKey !== apiKey || this.modelName !== modelName;
        
        this.apiKey = apiKey;
        this.modelName = modelName;

        if (newInitialInstruction !== undefined) {
            this.historyManager.updateInitialInstruction(newInitialInstruction);
        }

        if (credsChanged) {
            this.logger.info('Credentials changed, reinitializing...');
            this.initialize();
        }
    }

    public async sendMessage(userQueryGenericParts: GenericMessagePart[]): Promise<IChatResponse> {
        if (!this.currentChatSession) {
            this.logger.error('No active chat session.');
            await this.initialize();
            if (!this.currentChatSession) {
                throw new Error('Failed to initialize chat session');
            }
        }

        try {
            const geminiParts = this.messageMapper.mapGenericPartsToGeminiParts(userQueryGenericParts);
            const userContent: Content = { role: "user", parts: geminiParts }; 
            this.historyManager.addToHistory(userContent);
            
            this.logger.debug('Sending message to Gemini...');
            const result = await this.currentChatSession.sendMessage(geminiParts);
            this.logger.debug('Received response from Gemini.');
            
            if (result.response.candidates && result.response.candidates.length > 0) {
                this.historyManager.addToHistory(result.response.candidates[0].content);
            }
            
            return this.messageMapper.mapGeminiResponseToIChatResponse(result.response);
        } catch (error) {
            this.logger.error('Error sending message:', error);
            this.historyManager.removeLastUserMessage();
            throw error;
        }
    }
}
