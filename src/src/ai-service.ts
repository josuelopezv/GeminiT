import { GoogleGenerativeAI, GenerativeModel, Content, FunctionResponsePart, ChatSession, Part } from '@google/generative-ai'; // Added Part
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
    private initialModelInstruction: string;
    private currentChatSession: ChatSession | null = null; // To store the active chat session

    constructor(apiKey: string, modelName: string, initialModelInstruction: string = '') {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.initialModelInstruction = initialModelInstruction;
        if (this.apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(this.apiKey);
            } catch (error) {
                console.error('Error initializing GoogleGenerativeAI in constructor:', error);
                this.genAI = null;
            }
        }
        this.initializeWithKeyAndModel(apiKey, modelName);
    }    private initializeWithKeyAndModel(apiKey: string, modelName: string) {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.currentChatSession = null; // Reset chat session

        if (apiKey) { 
            try {
                // Always create a fresh GoogleGenerativeAI instance with the latest key
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
                this.model = this.genAI.getGenerativeModel({ model: this.modelName, tools: [EXECUTE_TERMINAL_COMMAND_TOOL] });
                
                // Initialize chat session with the model instruction
                const chatHistory = this.initialModelInstruction ? [
                    { role: "user", parts: [{ text: this.initialModelInstruction }] },
                    { role: "model", parts: [{ text: "Understood. I will follow these instructions." }] }
                ] : [];

                this.currentChatSession = this.model.startChat({
                    history: chatHistory,
                    tools: [EXECUTE_TERMINAL_COMMAND_TOOL]
                });
            } catch (error) {
                console.error(`Error initializing AI Service with model ${modelName}:`, error);
                this.model = null;
                this.currentChatSession = null;
            }
        } else {
            this.model = null;
            this.currentChatSession = null;
        }
    }    updateApiKeyAndModel(apiKey: string, modelName: string, newInitialModelInstruction?: string) {
        const oldApiKey = this.apiKey;
        this.apiKey = apiKey;
        this.modelName = modelName;
        if (newInitialModelInstruction !== undefined) {
            this.initialModelInstruction = newInitialModelInstruction;
        }

        if (apiKey !== oldApiKey || !this.genAI) {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
            } catch (error) {
                console.error('Error re-initializing GoogleGenerativeAI in updateApiKeyAndModel:', error);
                this.genAI = null;
                this.model = null;
                this.currentChatSession = null;
                return;
            }
        }
        this.initializeWithKeyAndModel(apiKey, modelName); // This will re-initialize model and chat with updated instruction
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
        if (!this.currentChatSession) {
            // Attempt to re-initialize if session is missing but model/key are present
            if (this.model && this.apiKey && this.modelName) {
                console.warn('AIService: Chat session was null, attempting to re-initialize.');
                this.currentChatSession = this.model.startChat({
                    history: [], // Or some predefined initial history
                    tools: [EXECUTE_TERMINAL_COMMAND_TOOL]
                });
            } else {
                 throw new Error('AI Service chat session is not initialized. API key or Model Name may be missing or invalid.');
            }
        }
        
        try {
            // Construct message parts, including terminal history if relevant for this turn
            const messageParts: Part[] = [{ text: query }];
            if (terminalHistory) {
                // Consider how to best present terminal history. Appending to query or as separate context.
                // For now, let's assume it's part of the user's broader context for the query.
                // messageParts.unshift({ text: "Terminal Context:\n" + terminalHistory + "\n\nUser Query:" });
            }

            const result = await this.currentChatSession.sendMessage(messageParts);
            const response = result.response;

            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                return {
                    toolCall: {
                        id: call.name, // This should be the unique ID of the function call
                        functionName: call.name, 
                        args: call.args as { command?: string }
                    }
                };
            }

            const text = response.text();
            return { text };

        } catch (error) {
            console.error('AI Service processQuery Error:', error);
            // If sendMessage fails, the chat session might be in a bad state. 
            // Consider resetting or re-initializing the chat session on certain errors.
            // this.currentChatSession = null; // Or re-initialize
            throw error;
        }
    }

    async processToolExecutionResult(toolCallId: string, functionName: string, commandOutput: string): Promise<AIResponse> {
        if (!this.currentChatSession) {
            throw new Error('AI Service chat session is not initialized for tool result processing.');
        }
        console.log(`AIService: Sending tool execution result for ${functionName} (ID: ${toolCallId})`);
        
        try {
            const functionResponsePart: FunctionResponsePart = {
                functionResponse: {
                    name: functionName, 
                    response: { name: functionName, content: { output: commandOutput } }, 
                }
            };
            
            // Send the function response part using the existing chat session
            const result = await this.currentChatSession.sendMessage([functionResponsePart]);
            const response = result.response;

            const text = response.text();
            return { text };

        } catch (error) {
            console.error('AI Service processToolExecutionResult Error:', error);
            // Consider chat session state here too
            throw error; // Re-throw so renderer can display a generic error
        }
    }
}

export { AIService };