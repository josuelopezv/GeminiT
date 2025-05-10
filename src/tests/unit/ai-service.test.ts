// tests/unit/ai-service.test.ts
import { AIService } from '../../src/ai-service';
import { GoogleGenerativeAI } from '@google/generative-ai';

describe('AIService', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });    test('constructor initializes with model instruction', () => {
        const mockInstruction = 'TEST: Custom instruction';
        const mockStartChat = jest.fn().mockReturnValue({
            sendMessage: jest.fn()
        });
        const mockGetGenerativeModel = jest.fn().mockReturnValue({
            startChat: mockStartChat
        });
        
        // Setup mock before creating service
        (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
            getGenerativeModel: mockGetGenerativeModel
        }));
        
        const service = new AIService('test-key', 'test-model', mockInstruction);
        
        expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-key');
        expect(service['initialModelInstruction']).toBe(mockInstruction);
        expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({
            model: 'test-model'
        }));
        expect(mockStartChat).toHaveBeenCalledWith(expect.objectContaining({
            history: [
                { role: "user", parts: [{ text: mockInstruction }] },
                { role: "model", parts: [{ text: "Understood. I will follow these instructions." }] }
            ]
        }));
    });    test('updateApiKeyAndModel updates instruction and reinitializes chat session', () => {
        const initialMockStartChat = jest.fn().mockReturnValue({
            sendMessage: jest.fn()
        });
        const initialMockGetGenerativeModel = jest.fn().mockReturnValue({
            startChat: initialMockStartChat
        });
        (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
            getGenerativeModel: initialMockGetGenerativeModel
        }));
        
        const service = new AIService('test-key', 'test-model', 'initial instruction');
        
        // Setup new mocks for the update
        const mockStartChat = jest.fn().mockReturnValue({
            sendMessage: jest.fn()
        });
        const mockGetGenerativeModel = jest.fn().mockReturnValue({
            startChat: mockStartChat
        });
        
        // Reset mock before update
        (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
            getGenerativeModel: mockGetGenerativeModel
        }));

        // Update with new instruction
        service.updateApiKeyAndModel('new-key', 'new-model', 'new instruction');

        expect(service['initialModelInstruction']).toBe('new instruction');
        expect(service['apiKey']).toBe('new-key');
        expect(service['modelName']).toBe('new-model');
        expect(mockGetGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({
            model: 'new-model'
        }));
        expect(mockStartChat).toHaveBeenCalledWith(expect.objectContaining({
            history: [
                { role: "user", parts: [{ text: 'new instruction' }] },
                { role: "model", parts: [{ text: "Understood. I will follow these instructions." }] }
            ]
        }));
    });test('chat session includes model instruction in history', async () => {
        const mockInstruction = 'TEST: Initialize with this instruction';
        const mockStartChat = jest.fn().mockReturnValue({
            sendMessage: jest.fn()
        });
        const mockGetGenerativeModel = jest.fn().mockReturnValue({
            startChat: mockStartChat
        });
        
        // Setup mock before creating service
        (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
            getGenerativeModel: mockGetGenerativeModel
        }));

        const service = new AIService('test-key', 'test-model', mockInstruction);

        // Verify the initial setup
        expect(mockStartChat).toHaveBeenCalledWith(expect.objectContaining({
            history: [
                { role: "user", parts: [{ text: mockInstruction }] },
                { role: "model", parts: [{ text: "Understood. I will follow these instructions." }] }
            ],
            tools: [expect.any(Object)] // Verify tools array exists with at least one item
        }));
    });
});
