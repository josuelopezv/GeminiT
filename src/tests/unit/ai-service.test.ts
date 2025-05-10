// tests/unit/ai-service.test.ts
import { AIService } from '../../src/ai-service';
import {
    IAiProvider,
    IChatManager,
    IAIResponse, // This is the response type for AIService methods
    IChatResponse, // This is the response type for IChatManager methods
    GenericMessagePart
} from '../../src/interfaces/ai-service.interface';

// Mock the IAiProvider
const mockAiProvider: jest.Mocked<IAiProvider> = {
    getProviderName: jest.fn(),
    fetchAvailableModels: jest.fn(),
    createChatManager: jest.fn(),
};

// Mock the IChatManager
const mockChatManager: jest.Mocked<IChatManager> = {
    sendMessage: jest.fn(),
    sendFunctionResponse: jest.fn(),
    updateCredentials: jest.fn(),
};

// Helper to create a mock IChatResponse for text
const createMockChatResponseText = (text: string): IChatResponse => ({
    candidates: [{
        content: {
            parts: [{ text }],
            role: 'model' // Role is often part of the content structure
        }
        // Other candidate properties like finishReason, safetyRatings can be added if needed for specific tests
    }]
    // Other IChatResponse properties like promptFeedback can be added if needed
});

describe('AIService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAiProvider.getProviderName.mockReturnValue('mockProvider');
        mockAiProvider.createChatManager.mockReturnValue(mockChatManager);
        mockAiProvider.fetchAvailableModels.mockResolvedValue([]);
        
        // IChatManager methods should resolve with IChatResponse
        mockChatManager.sendMessage.mockResolvedValue(createMockChatResponseText('mock chat manager response'));
        mockChatManager.sendFunctionResponse.mockResolvedValue(createMockChatResponseText('mock chat manager function response'));
        // mockChatManager.updateCredentials.mockImplementation(() => {}); // No return value needed for void
    });

    test('constructor initializes with AI provider and creates chat manager', () => {
        const apiKey = 'test-key';
        const modelName = 'test-model';
        const initialInstruction = 'TEST: Custom instruction';

        const service = new AIService(mockAiProvider, apiKey, modelName, initialInstruction);

        expect(mockAiProvider.createChatManager).toHaveBeenCalledWith(
            apiKey,
            modelName,
            initialInstruction
        );
        expect(service.getApiKey()).toBe(apiKey);
        expect(service.getModelName()).toBe(modelName);
    });

    // Test for listAvailableModels
    describe('listAvailableModels', () => {
        const apiKey = 'test-key-for-models';

        test('should call fetchAvailableModels on the provider with the api key', async () => {
            const service = new AIService(mockAiProvider, apiKey, 'test-model');
            mockAiProvider.fetchAvailableModels.mockResolvedValueOnce(['model1', 'model2']);
            
            const models = await service.listAvailableModels(apiKey);

            expect(mockAiProvider.fetchAvailableModels).toHaveBeenCalledWith(apiKey);
            expect(models).toEqual(['model1', 'model2']);
        });

        test('should return an empty array if api key is not provided to listAvailableModels', async () => {
            const service = new AIService(mockAiProvider, 'any-key', 'test-model'); // Service itself has an API key
            const models = await service.listAvailableModels(''); // Call listAvailableModels with empty API key
            
            expect(mockAiProvider.fetchAvailableModels).not.toHaveBeenCalled();
            expect(models).toEqual([]);
        });

        test('should return an empty array and log error if provider throws an error', async () => {
            const service = new AIService(mockAiProvider, apiKey, 'test-model');
            mockAiProvider.fetchAvailableModels.mockRejectedValueOnce(new Error('Provider error'));

            const models = await service.listAvailableModels(apiKey);

            expect(mockAiProvider.fetchAvailableModels).toHaveBeenCalledWith(apiKey);
            expect(models).toEqual([]);
            // Add logger spy here if needed: import logger and use jest.spyOn(logger, 'error');
        });
    });

    // Tests for processQuery
    describe('processQuery', () => {
        const apiKey = 'test-key';
        const modelName = 'test-model';
        let service: AIService;

        beforeEach(() => {
            service = new AIService(mockAiProvider, apiKey, modelName, 'Instruction');
        });

        test('should call sendMessage on chatManager with query and context', async () => {
            const query = 'test query';
            const contextContent = 'test context';
            const contextType = 'test_type';
            const expectedMessageParts: GenericMessagePart[] = [
                { text: `Context (${contextType}):\n${contextContent}\n\nUser Query: ${query}` }
            ];
            mockChatManager.sendMessage.mockResolvedValueOnce(createMockChatResponseText('response text'));

            await service.processQuery(query, contextContent, contextType);

            expect(mockChatManager.sendMessage).toHaveBeenCalledWith(expectedMessageParts);
        });

        test('should process text response from chatManager', async () => {
            const query = 'test query';
            const responseText = 'AI response text';
            mockChatManager.sendMessage.mockResolvedValueOnce(createMockChatResponseText(responseText));

            const result = await service.processQuery(query, '');

            expect(result).toEqual({ text: responseText });
        });

        test('should process function call response from chatManager', async () => {
            const query = 'test query';
            const functionCallName = 'testFunction';
            const functionCallArgs = { arg1: 'value1' };
            const mockFunctionCallResponse: IChatResponse = {
                candidates: [{
                    content: {
                        parts: [{ functionCall: { name: functionCallName, args: functionCallArgs } }],
                        role: 'model'
                    }
                }]
            };
            mockChatManager.sendMessage.mockResolvedValueOnce(mockFunctionCallResponse);

            const result = await service.processQuery(query, '');

            expect(result).toEqual({
                toolCall: {
                    id: functionCallName, // AIService uses functionCall.name as id for now
                    functionName: functionCallName,
                    args: functionCallArgs
                }
            });
            expect(service['currentToolCallId']).toBe(functionCallName);
        });

        test('should throw error if chatManager is not initialized', async () => {
            // Sabotage chatManager initialization for this test
            mockAiProvider.createChatManager.mockReturnValueOnce(null as any); // Force chatManager to be null
            const newService = new AIService(mockAiProvider, apiKey, modelName, 'Instruction');
            
            await expect(newService.processQuery('test', '')).rejects.toThrow('Chat manager is not initialized.');
        });

        test('should re-throw error from chatManager sendMessage', async () => {
            const query = 'test query';
            const errorMessage = 'Chat manager error';
            mockChatManager.sendMessage.mockRejectedValueOnce(new Error(errorMessage));

            await expect(service.processQuery(query, '')).rejects.toThrow(errorMessage);
        });

        test('should handle no suitable response from AI', async () => {
            const query = 'test query';
            const mockEmptyResponse: IChatResponse = {
                candidates: [{
                    content: {
                        parts: [], // No parts
                        role: 'model'
                    }
                }]
            };
            mockChatManager.sendMessage.mockResolvedValueOnce(mockEmptyResponse);

            const result = await service.processQuery(query, '');
            expect(result).toEqual({ text: 'No response from AI.' });
        });
    });

    // Tests for processToolExecutionResult
    describe('processToolExecutionResult', () => {
        const apiKey = 'test-key';
        const modelName = 'test-model';
        let service: AIService;
        const toolCallId = 'testToolCallId';
        const functionName = 'testFunction';
        const commandOutput = 'tool output';

        beforeEach(() => {
            service = new AIService(mockAiProvider, apiKey, modelName, 'Instruction');
            // Simulate a tool call being in progress
            service['currentToolCallId'] = toolCallId;
        });

        test('should call sendFunctionResponse on chatManager with tool output', async () => {
            const expectedFunctionResponseParts: GenericMessagePart[] = [
                { functionResponse: { name: functionName, response: { output: commandOutput } } }
            ];
            mockChatManager.sendFunctionResponse.mockResolvedValueOnce(createMockChatResponseText('response after tool'));

            await service.processToolExecutionResult(toolCallId, functionName, commandOutput);

            expect(mockChatManager.sendFunctionResponse).toHaveBeenCalledWith(expectedFunctionResponseParts);
        });

        test('should process text response after tool execution and reset currentToolCallId', async () => {
            const responseText = 'AI response after tool execution';
            mockChatManager.sendFunctionResponse.mockResolvedValueOnce(createMockChatResponseText(responseText));

            const result = await service.processToolExecutionResult(toolCallId, functionName, commandOutput);

            expect(result).toEqual({ text: responseText });
            expect(service['currentToolCallId']).toBeNull();
        });

        test('should throw error if chatManager is not initialized', async () => {
            mockAiProvider.createChatManager.mockReturnValueOnce(null as any); // Force chatManager to be null
            const newService = new AIService(mockAiProvider, apiKey, modelName, 'Instruction');
            // No need to set currentToolCallId on newService as it will throw before using it

            await expect(newService.processToolExecutionResult(toolCallId, functionName, commandOutput))
                .rejects.toThrow('Chat manager is not initialized.');
        });

        test('should re-throw error from chatManager sendFunctionResponse and reset currentToolCallId', async () => {
            const errorMessage = 'Chat manager error during function response';
            mockChatManager.sendFunctionResponse.mockRejectedValueOnce(new Error(errorMessage));

            await expect(service.processToolExecutionResult(toolCallId, functionName, commandOutput))
                .rejects.toThrow(errorMessage);
            expect(service['currentToolCallId']).toBeNull(); // Should be reset even on error
        });
        
        test('should handle no suitable text response after tool execution', async () => {
            const mockEmptyResponse: IChatResponse = {
                candidates: [{
                    content: {
                        parts: [], // No text part
                        role: 'model'
                    }
                }]
            };
            mockChatManager.sendFunctionResponse.mockResolvedValueOnce(mockEmptyResponse);

            const result = await service.processToolExecutionResult(toolCallId, functionName, commandOutput);
            expect(result).toEqual({ text: 'Tool executed, but no further textual response from AI.' });
            expect(service['currentToolCallId']).toBeNull();
        });
    });

    // Tests for updateApiKeyAndModel
    describe('updateApiKeyAndModel', () => {
        const initialApiKey = 'initial-key';
        const initialModelName = 'initial-model';
        const initialInstruction = 'initial instruction';
        let service: AIService;

        beforeEach(() => {
            // Reset to a known state for each test, including a fresh chat manager mock for the update
            mockAiProvider.createChatManager.mockReset(); // Reset call counts etc.
            mockAiProvider.createChatManager.mockReturnValue(mockChatManager); // Set default return
            service = new AIService(mockAiProvider, initialApiKey, initialModelName, initialInstruction);
            // Clear the mock call from the constructor to only focus on updateApiKeyAndModel calls
            mockAiProvider.createChatManager.mockClear(); 
        });

        test('should update API key, model name, and instruction, then reinitialize chat manager', () => {
            const newApiKey = 'new-key';
            const newModelName = 'new-model';
            const newInstruction = 'new instruction';
            
            const newMockChatManager: jest.Mocked<IChatManager> = {
                sendMessage: jest.fn(),
                sendFunctionResponse: jest.fn(),
                updateCredentials: jest.fn(),
            };
            mockAiProvider.createChatManager.mockReturnValueOnce(newMockChatManager);

            service.updateApiKeyAndModel(newApiKey, newModelName, newInstruction);

            expect(service.getApiKey()).toBe(newApiKey);
            expect(service.getModelName()).toBe(newModelName);
            expect(service['initialModelInstruction']).toBe(newInstruction);
            expect(mockAiProvider.createChatManager).toHaveBeenCalledWith(
                newApiKey,
                newModelName,
                newInstruction
            );
            expect(service['chatManager']).toBe(newMockChatManager);
        });

        test('should preserve existing instruction if new one not provided', () => {
            const newApiKey = 'new-key-no-instruction';
            const newModelName = 'new-model-no-instruction';
            
            // Service is initialized with 'initialInstruction' in beforeEach
            service.updateApiKeyAndModel(newApiKey, newModelName); // Instruction not provided

            expect(service.getApiKey()).toBe(newApiKey);
            expect(service.getModelName()).toBe(newModelName);
            // Expect the instruction to remain the one set during service initialization
            expect(service['initialModelInstruction']).toBe(initialInstruction); 
            expect(mockAiProvider.createChatManager).toHaveBeenCalledWith(
                newApiKey,
                newModelName,
                initialInstruction // Expect the original instruction
            );
        });

        test('should handle error during chat manager re-creation and use existing instruction', () => {
            const newApiKey = 'key-causing-error';
            const newModelName = 'model-causing-error';
            const errorMessage = 'Failed to create chat manager';
            mockAiProvider.createChatManager.mockImplementationOnce(() => {
                throw new Error(errorMessage);
            });

            service.updateApiKeyAndModel(newApiKey, newModelName); // Instruction not provided

            expect(service.getApiKey()).toBe(newApiKey);
            expect(service.getModelName()).toBe(newModelName);
            // Expect createChatManager to be called with the original instruction
            expect(mockAiProvider.createChatManager).toHaveBeenCalledWith(
                newApiKey, 
                newModelName, 
                initialInstruction // Expect the original instruction
            );
            expect(service['chatManager']).toBeNull();
        });
    });
});
