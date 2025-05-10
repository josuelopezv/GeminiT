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

    async processQuery(query: string, contextContent: string, contextType?: string): Promise<IAIResponse> {
        let finalContext = contextContent.trim();
        // Basic normalization, stripAnsiCodes should have handled most complex cases.
        finalContext = finalContext.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n');
        if (finalContext.length > MAX_AI_HISTORY_CONTEXT_CHARS) {
            finalContext = "[...context trimmed for brevity...]\n" + finalContext.slice(-MAX_AI_HISTORY_CONTEXT_CHARS);
        }

        let fullQueryWithContext = '';
        if (contextType === "output of the last executed command") {
            // More direct prompt for command output
            fullQueryWithContext = `User Query: ${query}\n\nOutput of the previously executed command:\n${finalContext || '(No output was captured)'}`;
            logger.debug(`[AIService] Using specific command output prompt. Context length: ${finalContext.length}`);
        } else {
            fullQueryWithContext = `User Query: ${query}\n\nContext (Source: ${contextType || 'general terminal activity'}):\n${finalContext || '(No context provided)'}`;
            logger.debug(`[AIService] Using general context prompt. Context length: ${finalContext.length}`);
        }
        
        if (!require('electron').app.isPackaged) {
            // Already logged above with more detail
            // logger.debug(`[AIService] Context for AI Prompt (type: ${contextType}, ${finalContext.length} chars):`, finalContext);
        }

        const queryMessageParts: GenericMessagePart[] = [{ text: fullQueryWithContext }];

        // ... (rest of processQuery method: try/catch block with chatManager.sendMessage, response parsing) ...
        try {
            const chatManagerResponse: IChatResponse | null = await this.chatManager.sendMessage(queryMessageParts);

            if (!chatManagerResponse) {
                throw new Error('Received null response from ChatManager.sendMessage');
            }
            if (!chatManagerResponse.candidates || chatManagerResponse.candidates.length === 0) {
                logger.warn('AIService.processQuery: No candidates found in chat manager response.');
                return { text: "[AI did not provide a response candidate]" };
            }
            const candidate = chatManagerResponse.candidates[0];
            if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                logger.warn('AIService.processQuery: No parts found in response candidate content.');
                return { text: "[AI response candidate had no content parts]" };
            }
            let combinedText = '';
            for (const part of candidate.content.parts) {
                if (part.functionCall && part.functionCall.name === 'execute_terminal_command') {
                    logger.info('AIService: Gemini proposed a tool call (execute_terminal_command):', part.functionCall.args);
                    const commandToSuggest = (part.functionCall.args as { command?: string }).command;
                    if (commandToSuggest) {
                        combinedText += `The AI suggests executing the following command:\n\`\`\`sh\n${commandToSuggest}\n\`\`\`\n`;
                    } else {
                        combinedText += "The AI considered executing a command but didn\'t specify which one.\n";
                    }
                } else if (part.text) {
                    combinedText += part.text;
                }
            }
            return { text: combinedText.trim() };
        } catch (error) {
            logger.error('AIService.processQuery Error:', error);
            throw error;
        }
    }

    // processToolExecutionResult is now effectively unused with this new approach.
    // We can comment it out or remove it later.
    async processToolExecutionResult(toolCallId: string, functionName: string, commandOutput: string): Promise<IAIResponse> {
        logger.warn('AIService.processToolExecutionResult called, but this flow is deprecated with the new approach.');
        return { text: `Command output processing is deprecated in this flow. Output was: ${commandOutput.substring(0,100)}...` };
    }
}

export { AIService };