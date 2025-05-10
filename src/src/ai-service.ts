import { Part, FunctionResponsePart, GenerateContentResponse } from '@google/generative-ai';
import { fetchModelsFromGoogle } from './google-ai-utils';
import { GeminiChatSessionManager } from './gemini-chat-session-manager'; // New import

// AIResponse remains the same as it defines the structure AIService returns to its callers
export interface AIResponse {
    text?: string;
    toolCall?: {
        id: string; 
        functionName: string;
        args: { command?: string };
    };
    suggestedCommand?: string; // This might be phased out or derived differently
}

class AIService {
    private chatManager: GeminiChatSessionManager;
    private currentApiKey: string;
    private currentModelName: string;

    constructor(apiKey: string, modelName: string) {
        this.currentApiKey = apiKey;
        this.currentModelName = modelName;
        this.chatManager = new GeminiChatSessionManager(apiKey, modelName);
    }

    public updateApiKeyAndModel(apiKey: string, modelName: string) {
        this.currentApiKey = apiKey;
        this.currentModelName = modelName;
        this.chatManager.updateCredentials(apiKey, modelName);
    }

    public getApiKey(): string {
        return this.currentApiKey;
    }

    public getModelName(): string {
        return this.currentModelName;
    }

    async listAvailableModels(): Promise<string[]> {
        // This utility function is independent of the chat session manager for now
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
        return condensedHistory;
    }

    async processQuery(query: string, terminalHistory: string): Promise<AIResponse> {
        const condensedHistory = this.cleanAndPrepareTerminalHistory(terminalHistory);
        const fullQueryWithContext = `User Query: ${query}\n\nRecent Terminal Activity (cleaned, ${condensedHistory.length} chars of relevant lines):\n${condensedHistory || '(No recent terminal activity to show)'}`;
        
        const queryParts: Part[] = [{ text: fullQueryWithContext }];

        try {
            const sdkResponse: GenerateContentResponse | null = await this.chatManager.sendMessage(queryParts);

            if (!sdkResponse) {
                throw new Error('Received null response from ChatManager.sendMessage');
            }

            const functionCalls = sdkResponse.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                return {
                    toolCall: {
                        id: call.name, // Assuming call.name is suitable as a temporary ID for the call instance
                        functionName: call.name,
                        args: call.args as { command?: string }
                    }
                };
            }
            return { text: sdkResponse.text() };
        } catch (error) {
            console.error('AIService.processQuery Error:', error);
            throw error;
        }
    }

    async processToolExecutionResult(toolCallId: string, functionName: string, commandOutput: string): Promise<AIResponse> {
        console.log(`AIService: Processing tool execution result for ${functionName} (ID: ${toolCallId})`);
        
        const functionResponseParts: FunctionResponsePart[] = [{
            functionResponse: {
                name: functionName, // This should match the name of the function called
                response: { name: functionName, content: { output: commandOutput } },
            }
        }];

        try {
            const sdkResponse: GenerateContentResponse | null = await this.chatManager.sendFunctionResponse(functionResponseParts);
            if (!sdkResponse) {
                throw new Error('Received null response from ChatManager.sendFunctionResponse');
            }
            return { text: sdkResponse.text() };
        } catch (error) {
            console.error('AIService.processToolExecutionResult Error:', error);
            return { text: `Error processing tool result: ${(error as Error).message}` };
        }
    }
}

export { AIService };