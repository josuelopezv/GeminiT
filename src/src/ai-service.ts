import { GoogleGenerativeAI, GenerativeModel, Part, Content, FunctionResponsePart } from '@google/generative-ai'; // Added Content, FunctionResponsePart
import { EXECUTE_TERMINAL_COMMAND_TOOL } from './ai-tools';
import { fetchModelsFromGoogle } from './google-ai-utils';

export interface AIResponse {
    text?: string;
    toolCall?: {
        id: string; 
        functionName: string;
        args: { command?: string };
    };
    suggestedCommand?: string;
}

class AIService {
    private genAI!: GoogleGenerativeAI | null;
    private model!: GenerativeModel | null;
    private apiKey: string;
    private modelName: string;
    private chatHistory: Content[] = []; // Changed from Part[] to Content[]

    constructor(apiKey: string, modelName: string) {
        this.apiKey = apiKey;
        this.modelName = modelName;
        if (this.apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.apiKey);
            } catch (error) {
                console.error('Error initializing GoogleGenerativeAI in constructor:', error);
                this.genAI = null;
            }
        }
        this.initializeWithKeyAndModel(apiKey, modelName);
    }

    private initializeWithKeyAndModel(apiKey: string, modelName: string) {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.chatHistory = []; // Reset history

        if (apiKey && !this.genAI) { 
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
            } catch (error) {
                console.error('Error initializing GoogleGenerativeAI in initializeWithKeyAndModel:', error);
                this.genAI = null;
                this.model = null;
                return;
            }
        }
        if (this.genAI && modelName) {
            try {
                // Tools are now typically passed to the model instance directly
                this.model = this.genAI.getGenerativeModel({ model: this.modelName, tools: [EXECUTE_TERMINAL_COMMAND_TOOL] });
            } catch (error) {
                console.error(`Error initializing AI Service with model ${modelName}:`, error);
                this.model = null;
            }
        } else {
            this.model = null;
        }
    }

    updateApiKeyAndModel(apiKey: string, modelName: string) {
        const oldApiKey = this.apiKey;
        this.apiKey = apiKey;
        this.modelName = modelName;

        if (apiKey !== oldApiKey || !this.genAI) {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
            } catch (error) {
                console.error('Error re-initializing GoogleGenerativeAI in updateApiKeyAndModel:', error);
                this.genAI = null;
                this.model = null;
                this.chatHistory = [];
                return;
            }
        }
        // Re-initialize model with new settings and reset history
        this.initializeWithKeyAndModel(apiKey, modelName);
    }

    getApiKey(): string {
        return this.apiKey;
    }

    getModelName(): string {
        return this.modelName;
    }

    async listAvailableModels(): Promise<string[]> {
        return fetchModelsFromGoogle(this.apiKey);
    }

    async processQuery(query: string, terminalHistory: string): Promise<AIResponse> {
        if (!this.apiKey || !this.modelName || !this.model) {
            throw new Error('AI Service is not initialized. API key or Model Name may be missing or invalid.');
        }
        try {
            const userQueryContent: Content = { role: "user", parts: [{ text: query }] };
            let historyForThisTurn = [...this.chatHistory];
            historyForThisTurn.push(userQueryContent);

            // Optional: Add terminal history as a separate user message for clarity in history
            // if (terminalHistory) {
            //     historyForThisTurn.push({ role: "user", parts: [{ text: "Current terminal context:\n" + terminalHistory }] });
            // }

            const chat = this.model.startChat({
                history: historyForThisTurn, // Send a copy of history up to this point
                // tools are already part of the model instance
            });
            
            const result = await chat.sendMessage(query); // Send only the current query string
            const response = result.response;

            // Add user query and model response to persistent history
            this.chatHistory.push(userQueryContent);
            if (response.candidates && response.candidates.length > 0) {
                this.chatHistory.push(response.candidates[0].content); 
            } else {
                // Handle cases where there might be no candidates (e.g. safety blocked)
                this.chatHistory.push({role: "model", parts: [{text: "[No response content from model]"}]});
            }

            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                return {
                    toolCall: {
                        id: call.name, // This should be the unique ID of the function call if available
                        functionName: call.name, 
                        args: call.args as { command?: string }
                    }
                };
            }

            const text = response.text();
            return { text };

        } catch (error) {
            console.error('AI Service processQuery Error:', error);
            // Don't modify chatHistory here as it might lead to inconsistencies
            throw error;
        }
    }

    async processToolExecutionResult(toolCallId: string, functionName: string, commandOutput: string): Promise<AIResponse> {
        if (!this.apiKey || !this.modelName || !this.model) {
            throw new Error('AI Service is not initialized for tool result processing.');
        }
        console.log(`AIService: Sending tool execution result for ${functionName} (ID: ${toolCallId})`);
        
        try {
            const functionResponsePart: FunctionResponsePart = {
                functionResponse: {
                    name: functionName, 
                    response: { name: functionName, content: { output: commandOutput } },
                }
            };
            
            // Add the function response part to history
            this.chatHistory.push({ role: "function", parts: [functionResponsePart] });

            const chat = this.model.startChat({
                history: this.chatHistory,
                // tools are already part of the model instance
            });

            // Send an empty message or a specific prompt to get the AI's reaction to the tool output
            // For some SDK versions, after a functionResponse, you might send an empty message or a specific follow-up query.
            // Or, the SDK might handle this as part of a multi-turn chat implicitly.
            // Let's try sending the functionResponsePart directly as the next message in the chat.
            const result = await chat.sendMessageStream([functionResponsePart]); // Send stream for potential multi-part response
            
            let accumulatedText = "";
            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                accumulatedText += chunkText;
            }
            
            // Add model's response to history
            if (accumulatedText) {
                 this.chatHistory.push({role: "model", parts: [{text: accumulatedText}]});
            }

            return { text: accumulatedText };

        } catch (error) {
            console.error('AI Service processToolExecutionResult Error:', error);
            return { text: `Error processing tool result: ${(error as Error).message}` };
        }
    }
}

export { AIService };