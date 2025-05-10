import { 
    GoogleGenerativeAI, 
    GenerativeModel, 
    Content, 
    Part, 
    ChatSession, 
    FunctionResponsePart,
    GenerateContentResponse,
    FunctionCall
} from '@google/generative-ai';
import { EXECUTE_TERMINAL_COMMAND_TOOL } from './ai-tools';
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

    constructor(apiKey: string, modelName: string) {
        this.apiKey = apiKey;
        this.modelName = modelName;
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
                        model: this.modelName, 
                        tools: [EXECUTE_TERMINAL_COMMAND_TOOL] 
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
        const initialModelInstruction = `You are a helpful and friendly AI assistant integrated into a terminal application.
        The user is on Windows 11.
        Your primary goal is to assist with terminal commands and queries.
        Instructions for your responses:
        1. When providing command line examples or code snippets, encapsulate them in markdown code blocks.
        2. For PowerShell commands, use '\`\`\`powershell' as the language identifier.
        3. For other shell commands (e.g., cmd, bash), use '\`\`\`sh'.
        4. ALWAYS provide commands on a single line; do not break them into multiple lines.
        5. Keep your explanations concise and to the point.
        6. If you decide to execute a command, you MUST use the 'execute_terminal_command' tool.`; // Keep your detailed prompt
        this.chatHistory = [
            { role: "user", parts: [{ text: initialModelInstruction }] },
            { role: "model", parts: [{ text: "Understood. I will follow these instructions and use the execute_terminal_command tool when appropriate." }] }
        ];
        this.currentChatSession = this.modelInstance.startChat({
            history: this.chatHistory,
            tools: [EXECUTE_TERMINAL_COMMAND_TOOL]
        });
        logger.info('New chat session started.');
    }

    public updateCredentials(apiKey: string, modelName: string) {
        const keyChanged = this.apiKey !== apiKey;
        const modelChanged = this.modelName !== modelName;
        this.apiKey = apiKey;
        this.modelName = modelName;

        if (keyChanged || modelChanged) {
            logger.info(`Updating credentials. Key changed: ${keyChanged}, Model changed: ${modelChanged}`);
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
            if ('functionCall' in p && p.functionCall) {
                 logger.warn('Mapping GenericMessagePart with functionCall to Gemini Part - this is unusual for sending.');
                 return { functionCall: p.functionCall as FunctionCall }; 
            }
            throw new Error('Unsupported GenericMessagePart type for Gemini mapping');
        });
    }

    private mapGeminiResponseToIChatResponse(geminiResponse: GenerateContentResponse): IChatResponse {
        const candidates: IChatCompletionCandidate[] = (geminiResponse.candidates || []).map(candidate => {
            const parts: IChatCompletionPart[] = (candidate.content?.parts || []).map(part => {
                const iPart: IChatCompletionPart = {};
                if (part.text) iPart.text = part.text;
                if (part.functionCall) {
                    iPart.functionCall = {
                        name: part.functionCall.name,
                        args: part.functionCall.args
                    };
                }
                return iPart;
            });
            return {
                content: {
                    parts: parts,
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

    public async sendFunctionResponse(functionResponseGenericParts: GenericMessagePart[]): Promise<IChatResponse | null> {
        if (!this.currentChatSession) {
            logger.error('No active chat session for sendFunctionResponse.');
            return null;
        }
        try {
            const geminiFunctionResponseParts = this.mapGenericPartsToGeminiParts(functionResponseGenericParts) as FunctionResponsePart[];
            this.addToHistory({ role: "function", parts: geminiFunctionResponseParts });
            logger.debug('Sending function response to Gemini:', functionResponseGenericParts);

            const result = await this.currentChatSession.sendMessage(geminiFunctionResponseParts);
            logger.debug('Received response from Gemini after function response.');
            
            if (result.response.candidates && result.response.candidates.length > 0) {
                this.addToHistory(result.response.candidates[0].content);
            }
            return this.mapGeminiResponseToIChatResponse(result.response);
        } catch (error) {
            logger.error('ChatManager.sendFunctionResponse error:', error);
            throw error;
        }
    }
}