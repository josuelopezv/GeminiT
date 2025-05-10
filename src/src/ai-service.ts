import { fetchModelsFromGoogle } from './google-ai-utils';
import { GeminiChatSessionManager } from './gemini-chat-manager';
import { IAiService, IAIResponse, IChatResponse, GenericMessagePart } from './interfaces/ai-service.interface';
import { Logger } from './utils/logger'; // Import Logger

const logger = new Logger('AIService'); // Create a logger instance
const MAX_AI_HISTORY_CONTEXT_CHARS = 1000; 

class AIService implements IAiService {
    private chatManager: GeminiChatSessionManager; 
    private currentApiKey: string;
    private currentModelName: string;

    constructor(apiKey: string, modelName: string) {
        this.currentApiKey = apiKey;
        this.currentModelName = modelName;
        this.chatManager = new GeminiChatSessionManager(apiKey, modelName);
        logger.info(`Initialized with model: ${modelName}`);
    }

    public updateApiKeyAndModel(apiKey: string, modelName: string) {
        this.currentApiKey = apiKey;
        this.currentModelName = modelName;
        this.chatManager.updateCredentials(apiKey, modelName);
        logger.info(`Updated to model: ${modelName}`);
    }

    public getApiKey(): string {
        return this.currentApiKey;
    }

    public getModelName(): string {
        return this.currentModelName;
    }

    async listAvailableModels(): Promise<string[]> {
        logger.debug('Listing available models...');
        return fetchModelsFromGoogle(this.currentApiKey);
    }

    private cleanAndPrepareTerminalHistory(terminalHistory: string): string {
        let processedHistory = terminalHistory.trim(); 
        processedHistory = processedHistory.replace(/\r\n/g, '\n'); 
        const historyLines = processedHistory.split('\n');
        const trimmedAndNonEmptyLines = historyLines
            .map(line => line.trim())       
            .filter(line => line.length > 0); 
        let condensedHistory = trimmedAndNonEmptyLines.join('\n');
        condensedHistory = condensedHistory.replace(/\n{2,}/g, '\n'); 
        if (condensedHistory.length > MAX_AI_HISTORY_CONTEXT_CHARS) {
            condensedHistory = condensedHistory.slice(-MAX_AI_HISTORY_CONTEXT_CHARS);
            condensedHistory = "[...trimmed for brevity...]\n" + condensedHistory;
        }
        return condensedHistory;
    }

    async processQuery(query: string, terminalHistory: string): Promise<IAIResponse> {
        const condensedHistory = this.cleanAndPrepareTerminalHistory(terminalHistory);
        
        if (!require('electron').app.isPackaged) { 
            logger.debug(`Condensed History for AI Prompt (${condensedHistory.length} chars):`, condensedHistory);
        }

        const fullQueryWithContext = `User Query: ${query}\n\nRecent Terminal Activity (cleaned, up to ${MAX_AI_HISTORY_CONTEXT_CHARS} chars of relevant lines):\n${condensedHistory || '(No recent terminal activity to show)'}`;
        const queryMessageParts: GenericMessagePart[] = [{ text: fullQueryWithContext }];

        try {
            const chatManagerResponse: IChatResponse | null = await this.chatManager.sendMessage(queryMessageParts);

            if (!chatManagerResponse) {
                logger.error('Received null response from ChatManager.sendMessage');
                throw new Error('Received null response from ChatManager.sendMessage');
            }

            if (!chatManagerResponse.candidates || chatManagerResponse.candidates.length === 0) {
                logger.warn('No candidates found in chat manager response.');
                return { text: "[AI did not provide a response candidate]" };
            }

            const candidate = chatManagerResponse.candidates[0];
            if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                logger.warn('No parts found in response candidate content.');
                return { text: "[AI response candidate had no content parts]" };
            }

            for (const part of candidate.content.parts) {
                if (part.functionCall) {
                    logger.debug(`Detected functionCall part:`, part.functionCall);
                    return {
                        toolCall: {
                            id: part.functionCall.name, 
                            functionName: part.functionCall.name,
                            args: part.functionCall.args
                        }
                    };
                }
            }

            let combinedText = '';
            for (const part of candidate.content.parts) {
                if (part.text) {
                    combinedText += part.text;
                }
            }
            return { text: combinedText };

        } catch (error) {
            logger.error('AIService.processQuery Error:', error);
            throw error;
        }
    }

    async processToolExecutionResult(toolCallId: string, functionName: string, commandOutput: string): Promise<IAIResponse> {
        logger.debug(`Processing tool execution result for ${functionName} (ID: ${toolCallId})`);
        
        const functionResponseGenericParts: GenericMessagePart[] = [{
            functionResponse: {
                name: functionName, 
                response: { name: functionName, content: { output: commandOutput } },
            }
        }];

        try {
            const chatManagerResponse: IChatResponse | null = await this.chatManager.sendFunctionResponse(functionResponseGenericParts);
            if (!chatManagerResponse) {
                logger.error('Received null response from ChatManager.sendFunctionResponse');
                throw new Error('Received null response from ChatManager.sendFunctionResponse');
            }

            if (!chatManagerResponse.candidates || chatManagerResponse.candidates.length === 0 || 
                !chatManagerResponse.candidates[0].content || !chatManagerResponse.candidates[0].content.parts || 
                chatManagerResponse.candidates[0].content.parts.length === 0) {
                logger.warn('No valid text part found in chat manager response after tool execution.');
                return { text: "[AI did not provide a follow-up text response]" };
            }
            
            let combinedText = '';
            for (const part of chatManagerResponse.candidates[0].content.parts) {
                if (part.text) {
                    combinedText += part.text;
                }
            }
            return { text: combinedText };

        } catch (error) {
            logger.error('AIService.processToolExecutionResult Error:', error);
            return { text: `Error processing tool result: ${(error as Error).message}` };
        }
    }
}

export { AIService };