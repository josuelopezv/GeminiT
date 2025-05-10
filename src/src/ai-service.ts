import { Part, FunctionResponsePart } from '@google/generative-ai'; // Keep for constructing parts to send
import { fetchModelsFromGoogle } from './google-ai-utils';
import { GeminiChatSessionManager } from './gemini-chat-session-manager';
import { 
    IAiService, 
    IChatManager, 
    IAIResponse, 
    IChatResponse, 
    IToolCall,
    GenericMessagePart 
} from './interfaces/ai-service.interface'; // Import our defined interfaces

const MAX_AI_HISTORY_CONTEXT_CHARS = 1000; 

class AIService implements IAiService { // Implement IAiService
    private chatManager: IChatManager; // Use IChatManager interface
    private currentApiKey: string;
    private currentModelName: string;

    constructor(apiKey: string, modelName: string) {
        this.currentApiKey = apiKey;
        this.currentModelName = modelName;
        // Instantiate the concrete GeminiChatSessionManager
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
        return fetchModelsFromGoogle(this.currentApiKey);
    }

    private cleanAndPrepareTerminalHistory(terminalHistory: string): string {
        // ... (existing cleaning logic remains the same) ...
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
        
        // Use GenericMessagePart for sending
        const queryMessageParts: GenericMessagePart[] = [{ text: fullQueryWithContext }];

        if (!require('electron').app.isPackaged) {
            console.log(`[DEV AI Service] Condensed History for AI Prompt (${condensedHistory.length} chars):\n${JSON.stringify(condensedHistory)}`);
        }

        try {
            const chatManagerResponse: IChatResponse | null = await this.chatManager.sendMessage(queryMessageParts);

            if (!chatManagerResponse) {
                throw new Error('Received null response from ChatManager.sendMessage');
            }

            if (!chatManagerResponse.candidates || chatManagerResponse.candidates.length === 0) {
                console.warn('AIService.processQuery: No candidates found in chat manager response.');
                return { text: "[AI did not provide a response candidate]" };
            }

            const candidate = chatManagerResponse.candidates[0];
            if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                console.warn('AIService.processQuery: No parts found in response candidate content.');
                return { text: "[AI response candidate had no content parts]" };
            }

            for (const part of candidate.content.parts) {
                if (part.functionCall) {
                    console.log('AIService: Detected functionCall part:', JSON.stringify(part.functionCall));
                    return {
                        toolCall: {
                            id: part.functionCall.name, // Or a more unique ID if available from the generic response
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
            console.error('AIService.processQuery Error:', error);
            throw error;
        }
    }

    async processToolExecutionResult(toolCallId: string, functionName: string, commandOutput: string): Promise<IAIResponse> {
        console.log(`AIService: Processing tool execution result for ${functionName} (ID: ${toolCallId})`);
        
        // Use GenericMessagePart for sending
        const functionResponseGenericParts: GenericMessagePart[] = [{
            functionResponse: {
                name: functionName, 
                response: { name: functionName, content: { output: commandOutput } }, // Ensure this structure matches GenericMessagePart
            }
        }];

        try {
            const chatManagerResponse: IChatResponse | null = await this.chatManager.sendFunctionResponse(functionResponseGenericParts);
            if (!chatManagerResponse) {
                throw new Error('Received null response from ChatManager.sendFunctionResponse');
            }

            if (!chatManagerResponse.candidates || chatManagerResponse.candidates.length === 0 || 
                !chatManagerResponse.candidates[0].content || !chatManagerResponse.candidates[0].content.parts || 
                chatManagerResponse.candidates[0].content.parts.length === 0) {
                console.warn('AIService.processToolExecutionResult: No valid text part found in chat manager response after tool execution.');
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
            console.error('AIService.processToolExecutionResult Error:', error);
            return { text: `Error processing tool result: ${(error as Error).message}` };
        }
    }
}

export { AIService };