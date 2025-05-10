import { 
    GoogleGenerativeAI, 
    GenerativeModel, 
    Content, 
    Part, 
    ChatSession, 
    FunctionResponsePart,
    GenerateContentResponse
} from '@google/generative-ai';
import { 
    IChatManager, 
    IChatResponse, 
    GenericMessagePart, 
    IChatCompletionPart, 
    IChatCompletionCandidate 
} from './interfaces/ai-service.interface';
import { Logger } from './utils/logger'; 

const logger = new Logger('GeminiChatManager'); 
const MAX_CHAT_HISTORY_LENGTH = 20;

export class GeminiChatSessionManager implements IChatManager {
    private genAI: GoogleGenerativeAI | null = null;
    private modelInstance!: GenerativeModel | null;
    private currentChatSession: ChatSession | null = null;
    private apiKey: string;
    private modelName: string;
    private chatHistory: Content[] = [];
    private initialModelInstruction: string;

    constructor(apiKey: string, modelName: string, initialModelInstruction: string) {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.initialModelInstruction = initialModelInstruction;
        this.initializeSdkAndModel();
    }

    private initializeSdkAndModel() {
        this.chatHistory = [];
        this.currentChatSession = null;
        if (this.apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.apiKey);
                if (this.modelName && this.genAI) {
                    this.modelInstance = this.genAI.getGenerativeModel({ 
                        model: this.modelName
                    });
                    this.startNewChatSession();
                    logger.info(`SDK and model initialized for: ${this.modelName}`);
                } else {
                    this.modelInstance = null;
                    logger.warn('Model name or genAI instance not available during SDK init.');
                }
            } catch (error) {
                logger.error('Error initializing GoogleGenerativeAI or Model in ChatManager:', error);
                this.genAI = null;
                this.modelInstance = null;
            }
        } else {
            logger.warn('API key not provided for ChatManager initialization.');
            this.genAI = null;
            this.modelInstance = null;
        }
    }

    private startNewChatSession() {
        if (!this.modelInstance) {
            logger.error('Model instance not available to start chat session.');
            this.currentChatSession = null;
            return;
        }
        this.chatHistory = [
            { role: "user", parts: [{ text: this.initialModelInstruction }] },
            { role: "model", parts: [{ text: "Understood. I will follow these instructions and provide commands in markdown code blocks." }] }
        ];
        this.currentChatSession = this.modelInstance.startChat({
            history: this.chatHistory
        });
        logger.info('New chat session started.');
    }

    public updateCredentials(apiKey: string, modelName: string, newInitialModelInstruction?: string) {
        const keyChanged = this.apiKey !== apiKey;
        const modelChanged = this.modelName !== modelName;
        const instructionChanged = newInitialModelInstruction !== undefined && this.initialModelInstruction !== newInitialModelInstruction;
        
        this.apiKey = apiKey;
        this.modelName = modelName;
        if (newInitialModelInstruction !== undefined) {
            this.initialModelInstruction = newInitialModelInstruction;
        }

        if (keyChanged || modelChanged || instructionChanged) {
            logger.info(`Updating credentials/instructions. Key changed: ${keyChanged}, Model changed: ${modelChanged}, Instruction changed: ${instructionChanged}`);
            this.initializeSdkAndModel();
        }
    }

    private addToHistory(content: Content) {
        this.chatHistory.push(content);
        if (this.chatHistory.length > MAX_CHAT_HISTORY_LENGTH) {
            const systemPrompts = this.chatHistory.slice(0, 2);
            const recentHistory = this.chatHistory.slice(this.chatHistory.length - (MAX_CHAT_HISTORY_LENGTH - 2));
            this.chatHistory = [...systemPrompts, ...recentHistory];
            logger.debug('Chat history truncated.');
        }
    }

    private mapGenericPartsToGeminiParts(parts: GenericMessagePart[]): Part[] {
        return parts.map(p => {
            if ('text' in p) {
                return { text: p.text };
            }
            if ('functionResponse' in p) {
                return { functionResponse: p.functionResponse } as FunctionResponsePart;
            }
            logger.warn('Unknown part type in mapGenericPartsToGeminiParts', p);
            return { text: '[Unsupported part type]' };
        });
    }

    private mapGeminiResponseToIChatResponse(geminiResponse: GenerateContentResponse): IChatResponse {
        const candidates: IChatCompletionCandidate[] = (geminiResponse.candidates || []).map(candidate => {
            const parts: IChatCompletionPart[] = (candidate.content?.parts || []).map(part => {
                const iPart: IChatCompletionPart = {};
                if (part.text) iPart.text = part.text;
                if (part.functionCall) {
                    logger.warn('A functionCall part was unexpectedly received from Gemini despite tools being removed:', part.functionCall);
                }
                return iPart;
            });
            return {
                content: {
                    parts: parts.filter(p => p.text !== undefined),
                    role: candidate.content?.role
                }
            };
        });
        return { candidates };
    }

    public async sendMessage(userQueryGenericParts: GenericMessagePart[]): Promise<IChatResponse | null> {
        if (!this.currentChatSession) {
            logger.error('No active chat session for sendMessage.');
            if (this.apiKey && this.modelName) {
                logger.info('Attempting to re-initialize SDK and model for sendMessage.');
                this.initializeSdkAndModel();
                if (!this.currentChatSession) return null;
            } else {
                return null;
            }
        }
        try {
            const geminiParts = this.mapGenericPartsToGeminiParts(userQueryGenericParts);
            const userContent: Content = { role: "user", parts: geminiParts }; 
            this.addToHistory(userContent);
            logger.debug('Sending message to Gemini:', userQueryGenericParts);
            
            const result = await this.currentChatSession.sendMessage(geminiParts);
            logger.debug('Received response from Gemini.');
            
            if (result.response.candidates && result.response.candidates.length > 0) {
                this.addToHistory(result.response.candidates[0].content);
            }
            return this.mapGeminiResponseToIChatResponse(result.response);
        } catch (error) {
            logger.error('ChatManager.sendMessage error:', error);
            if (this.chatHistory.length > 0 && this.chatHistory[this.chatHistory.length -1].role === "user") {
                this.chatHistory.pop();
            }
            throw error;
        }
    }
}