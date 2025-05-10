export interface IToolCall {
    id: string;
    functionName: string;
    args: { [key: string]: any }; 
}

export interface IAIResponse {
    text?: string;
    // toolCall?: IToolCall; // This field is no longer directly returned by AIService.processQuery
}

// Generic response from a chat manager
export interface IChatCompletionPart {
    text?: string;
    functionCall?: {
        name: string;
        args: { [key: string]: any };
    };
}

export interface IChatCompletionCandidate {
    content: {
        parts: IChatCompletionPart[];
        role?: string; // Optional role
    };
    // Add other relevant candidate properties if needed, like finishReason
}

export interface IChatResponse {
    candidates: IChatCompletionCandidate[];
    // Add other generic response properties if needed, like usage metadata
}

// Generic parts for sending messages. These might need to be more abstract
// if different SDKs have very different input structures beyond simple text/function parts.
export type GenericMessagePart = { text: string } | { functionResponse: { name: string; response: any } } | { functionCall: { name: string; args: any } };

export interface IChatManager {
    updateCredentials(apiKey: string, modelName: string): void;
    sendMessage(userQueryParts: GenericMessagePart[]): Promise<IChatResponse | null>; 
    sendFunctionResponse(functionResponseParts: GenericMessagePart[]): Promise<IChatResponse | null>; 
}

export interface IAiService {
    updateApiKeyAndModel(apiKey: string, modelName: string): void;
    getApiKey(): string;
    getModelName(): string;
    listAvailableModels(): Promise<string[]>;
    // Updated processQuery to accept contextType
    processQuery(query: string, contextContent: string, contextType?: string): Promise<IAIResponse>; 
    processToolExecutionResult(toolCallId: string, functionName: string, commandOutput: string): Promise<IAIResponse>; 
}
