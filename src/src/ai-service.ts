import { GoogleGenerativeAI, GenerativeModel, Tool, FunctionDeclaration } from '@google/generative-ai';

// Updated AIResponse to handle potential tool calls
export interface AIResponse {
    text?: string; // For direct text responses from AI
    toolCall?: {
        id: string; // ID of the tool call, needed for sending back results
        functionName: string;
        args: { command?: string }; // Arguments for the function, e.g., the command to run
    };
    // suggestedCommand can be phased out if tool calls become the primary way to suggest commands
    suggestedCommand?: string; 
}

const EXECUTE_TERMINAL_COMMAND_TOOL: Tool = {
    functionDeclarations: [
        {
            name: "execute_terminal_command",
            description: "Executes a shell command in the user's terminal and returns its output. Use this to perform actions or retrieve information from the user's system.",
            parameters: {
                type: "OBJECT",
                properties: {
                    command: {
                        type: "STRING",
                        description: "The terminal command to execute (e.g., 'ls -l', 'git status')."
                    }
                },
                required: ["command"]
            }
        } as FunctionDeclaration // Cast to FunctionDeclaration for stricter typing if needed by SDK version
    ]
};

const FALLBACK_MODELS = [
    'gemini-1.5-flash-latest',
    'gemini-1.0-pro', // Older but might be available
    'gemini-pro', // Common alias
];

async function fetchModelsFromGoogle(apiKey: string): Promise<string[]> {
    if (!apiKey) {
        console.warn('fetchModelsFromGoogle: API key is missing.');
        return FALLBACK_MODELS; // Provide fallback if no API key to attempt SDK call
    }
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // @ts-ignore - Retaining for type-checking, but runtime is the primary issue.
        const modelsResult = await genAI.listModels();
        const compatibleModels: string[] = [];
        for (const m of modelsResult) {
            if (m.supportedGenerationMethods.includes('generateContent') && !m.name.includes('chat-bison') && !m.name.includes('text-bison')) {
                compatibleModels.push(m.name.replace(/^models\//, ''));
            }
        }
        if (compatibleModels.length > 0) {
            return compatibleModels;
        }
        console.warn("fetchModelsFromGoogle: No compatible models found via SDK. Using fallback list.");
        return FALLBACK_MODELS;
    } catch (error) {
        console.error('fetchModelsFromGoogle: Error listing models via SDK:', error);
        if (error instanceof Error && error.message.includes('listModels is not a function')){
            console.warn("fetchModelsFromGoogle: genAI.listModels is not a function. SDK version or usage might be incorrect. Using fallback list.");
        } else {
            console.warn("fetchModelsFromGoogle: An unexpected error occurred while listing models via SDK. Using fallback list.");
        }
        return FALLBACK_MODELS;
    }
}

class AIService {
    private genAI!: GoogleGenerativeAI | null;
    private model!: GenerativeModel | null;
    private apiKey: string;
    private modelName: string;

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
                this.model = this.genAI.getGenerativeModel({ model: this.modelName });
            } catch (error) {
                console.error(`Error initializing AI Service with model ${modelName}:`, error);
                this.model = null;
            }
        } else {
            this.model = null;
        }
    }

    updateApiKeyAndModel(apiKey: string, modelName: string) {
        if (apiKey !== this.apiKey || !this.genAI) {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
            } catch (error) {
                console.error('Error re-initializing GoogleGenerativeAI in updateApiKeyAndModel:', error);
                this.genAI = null;
                this.model = null;
                this.apiKey = apiKey;
                this.modelName = modelName;
                return;
            }
        }
        this.initializeWithKeyAndModel(apiKey, modelName);
    }

    getApiKey(): string {
        return this.apiKey;
    }

    getModelName(): string {
        return this.modelName;
    }

    async listAvailableModels(): Promise<string[]> {
        // Use the standalone helper function
        return fetchModelsFromGoogle(this.apiKey);
    }

    async processQuery(query: string, terminalHistory: string): Promise<AIResponse> {
        if (!this.apiKey || !this.modelName || !this.model) {
            throw new Error('AI Service is not initialized. API key or Model Name may be missing or invalid.');
        }
        try {
            const chat = this.model.startChat({
                history: [
                    { role: "user", parts: [{ text: "You are an AI assistant integrated into a terminal. Here is some recent terminal history:\n" + terminalHistory }] },
                    { role: "model", parts: [{ text: "Understood. I will assist with terminal commands and queries. I can also execute commands if you ask me to and I deem it appropriate by calling the execute_terminal_command tool." }] }
                ],
                tools: [EXECUTE_TERMINAL_COMMAND_TOOL]
            });

            const result = await chat.sendMessage(query);
            const response = result.response;

            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0]; // Assuming one tool call for now
                console.log('AIService: Received tool call:', JSON.stringify(call));
                return {
                    toolCall: {
                        id: call.name, // The SDK might use call.name or a specific ID field for the call instance
                        functionName: call.name, // Or ensure this is the actual function name if different
                        args: call.args as { command?: string } // Type assertion for args
                    }
                };
            }

            // If no tool call, process as text response
            const text = response.text();
            const commandMatch = text.match(/Command:\s*(.+)$/m);
            const explanationMatch = text.match(/Explanation:\s*(.+)(?=\nCommand:|$)/s);

            return {
                text: explanationMatch ? explanationMatch[1].trim() : text,
                suggestedCommand: commandMatch ? commandMatch[1].trim() : undefined
            };

        } catch (error) {
            console.error('AI Service processQuery Error:', error);
            throw error;
        }
    }

    // Placeholder for the next step: processing tool execution results
    async processToolExecutionResult(toolCallId: string, commandOutput: string): Promise<AIResponse> {
        if (!this.apiKey || !this.modelName || !this.model) {
            throw new Error('AI Service is not initialized for tool result processing.');
        }
        console.log(`AIService: Sending tool execution result for ${toolCallId} with output: ${commandOutput.substring(0,100)}...`);
        
        // This will involve sending the tool response back to the model via chat.sendMessage with a functionResponse part
        // For now, let's return a simple text confirmation
        // const chat = this.model.startChat(... with history and tools ...);
        // const result = await chat.sendMessage([{ functionResponse: { name: toolCallId, response: { output: commandOutput } } }]);
        // const response = result.response.text();
        // return { text: response };

        return { text: `AI acknowledges output for ${toolCallId}: "${commandOutput.substring(0, 50)}..." Further processing to be implemented.` };
    }
}

export { AIService }; // AIResponse is already exported at the top