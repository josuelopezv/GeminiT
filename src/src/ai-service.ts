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
    private currentChatSession: ChatSession | null = null; // To store the active chat session

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
        this.currentChatSession = null; // Reset chat session

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
                this.model = this.genAI.getGenerativeModel({ model: this.modelName, tools: [EXECUTE_TERMINAL_COMMAND_TOOL] });
                // Initialize chat session here or when first query is made
                this.currentChatSession = this.model.startChat({ 
                    history: [], // Start with empty history, or provide initial context
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
                this.currentChatSession = null;
                return;
            }
        }
        this.initializeWithKeyAndModel(apiKey, modelName); // This will re-initialize model and chat
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
            // Define the initial context and instructions for the AI
            const initialModelInstruction = `You are a helpful and friendly AI assistant integrated into a terminal application.
            The user is on Windows 11.
            Your primary goal is to assist with terminal commands and queries.
            
            Instructions for your responses:
            1. When providing command line examples or code snippets, encapsulate them in markdown code blocks.
            2. For PowerShell commands, use \`\`\`powershell\`\`\` as the language identifier.
            3. For other shell commands (e.g., cmd, bash), use \`\`\`sh\`\`\`.
            4. ALWAYS provide commands on a single line; do not break them into multiple lines.
            5. Keep your explanations concise and to the point.
            6. If you decide to execute a command, you MUST use the 'execute_terminal_command' tool.

            Here is some recent terminal history for context (if available):
            ${terminalHistory || 'No recent terminal history available.'}`;

            // If currentChatSession is null or needs to be reset based on history, re-initialize.
            // For simplicity, let's assume initializeWithKeyAndModel correctly sets up currentChatSession.
            // If not, ensure it's valid here.
            if (!this.currentChatSession) {
                if (this.model) {
                    this.currentChatSession = this.model.startChat({
                        history: [
                            { role: "user", parts: [{ text: initialModelInstruction }] },
                            { role: "model", parts: [{ text: "Understood. I will follow these instructions and use the execute_terminal_command tool when appropriate." }] }
                        ],
                        tools: [EXECUTE_TERMINAL_COMMAND_TOOL]
                    });
                } else {
                    throw new Error('AI Model not available to start chat session.');
                }
            } else {
                // If chat session exists, we might want to ensure its history is appropriate.
                // For now, we assume the existing session is fine or re-initialized if API key/model changed.
                // If terminalHistory changes significantly per query, the chat history might need more careful management.
            }

            const result = await this.currentChatSession.sendMessage(query);
            const response = result.response;

            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                return {
                    toolCall: {
                        id: call.name, 
                        functionName: call.name, 
                        args: call.args as { command?: string }
                    }
                };
            }

            const text = response.text();
            // The regex parsing for "Command:" and "Explanation:" might become less necessary
            // if the AI consistently uses tool calls for executable commands.
            // However, it can remain as a fallback for purely textual suggestions.
            return { text };

        } catch (error) {
            console.error('AI Service processQuery Error:', error);
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