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
        const fullQueryWithContext = `User Query: ${query}\n\nRecent Terminal Activity (cleaned, up to ${MAX_AI_HISTORY_CONTEXT_CHARS} chars of relevant lines):\n${condensedHistory || '(No recent terminal activity to show)'}`;
        const queryMessageParts: GenericMessagePart[] = [{ text: fullQueryWithContext }];

        if (!require('electron').app.isPackaged) {
            logger.debug(`[AIService] Condensed History for AI Prompt (${condensedHistory.length} chars):`, condensedHistory);
        }

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
                    // Convert tool call into a textual suggestion with a markdown code block
                    const commandToSuggest = (part.functionCall.args as { command?: string }).command;
                    if (commandToSuggest) {
                        // Assume powershell for now if lang is not specified by AI, or make it generic 'sh'
                        // The AI prompt already asks for ```powershell or ```sh
                        combinedText += `The AI suggests executing the following command:\n\`\`\`sh\n${commandToSuggest}\n\`\`\`\n`;
                    } else {
                        combinedText += "The AI considered executing a command but didn't specify which one.\n";
                    }
                    // Do not set potentialToolCall here, as we are converting it to text.
                } else if (part.text) {
                    combinedText += part.text;
                }
            }
            
            // The IAIResponse interface might no longer need the toolCall field if we always do this conversion.
            // For now, we just return text.
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