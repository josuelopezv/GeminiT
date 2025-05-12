import { ChatHistoryManager } from '../../../../src/services/chat/chat-history-manager';

describe('ChatHistoryManager', () => {
    let chatHistoryManager: ChatHistoryManager;
    const initialInstruction = 'Initial test instruction';
    const maxHistoryLength = 5;

    beforeEach(() => {
        chatHistoryManager = new ChatHistoryManager(initialInstruction, maxHistoryLength);
    });

    describe('initialization', () => {
        it('should initialize with system prompts', () => {
            const history = chatHistoryManager.getHistory();
            expect(history).toHaveLength(2);
            expect(history[0]).toEqual({
                role: 'user',
                parts: [{ text: initialInstruction }]
            });
            expect(history[1]).toEqual({
                role: 'model',
                parts: [{ text: 'Understood. I will follow these instructions and provide commands in markdown code blocks.' }]
            });
        });
    });

    describe('addToHistory', () => {
        it('should add new content to history', () => {
            const newContent = {
                role: 'user',
                parts: [{ text: 'Test message' }]
            };

            chatHistoryManager.addToHistory(newContent);
            const history = chatHistoryManager.getHistory();

            expect(history).toHaveLength(3);
            expect(history[2]).toEqual(newContent);
        });

        it('should truncate history when exceeding max length', () => {
            // Add messages up to max length
            for (let i = 0; i < maxHistoryLength; i++) {
                chatHistoryManager.addToHistory({
                    role: 'user',
                    parts: [{ text: `Message ${i}` }]
                });
            }

            // Add one more message
            const newMessage = {
                role: 'user',
                parts: [{ text: 'Overflow message' }]
            };
            chatHistoryManager.addToHistory(newMessage);

            const history = chatHistoryManager.getHistory();
            
            // Should keep initial 2 system messages + (maxLength - 2) recent messages
            expect(history).toHaveLength(maxHistoryLength);
            expect(history[0].parts[0].text).toBe(initialInstruction);
            expect(history[history.length - 1]).toEqual(newMessage);
        });
    });

    describe('resetHistory', () => {
        it('should reset history to initial state', () => {
            // Add some messages
            chatHistoryManager.addToHistory({
                role: 'user',
                parts: [{ text: 'Test message' }]
            });

            chatHistoryManager.resetHistory();
            const history = chatHistoryManager.getHistory();

            expect(history).toHaveLength(2);
            expect(history[0].parts[0].text).toBe(initialInstruction);
        });
    });

    describe('removeLastUserMessage', () => {
        it('should remove last message if it is from user', () => {
            const userMessage = {
                role: 'user',
                parts: [{ text: 'Test message' }]
            };
            chatHistoryManager.addToHistory(userMessage);
            
            chatHistoryManager.removeLastUserMessage();
            const history = chatHistoryManager.getHistory();

            expect(history).toHaveLength(2);
            expect(history[history.length - 1].role).toBe('model');
        });

        it('should not remove last message if it is not from user', () => {
            const modelMessage = {
                role: 'model',
                parts: [{ text: 'Test response' }]
            };
            chatHistoryManager.addToHistory(modelMessage);
            
            chatHistoryManager.removeLastUserMessage();
            const history = chatHistoryManager.getHistory();

            expect(history).toHaveLength(3);
            expect(history[history.length - 1]).toEqual(modelMessage);
        });
    });

    describe('updateInitialInstruction', () => {
        it('should update initial instruction and reset history', () => {
            // Add some messages
            chatHistoryManager.addToHistory({
                role: 'user',
                parts: [{ text: 'Test message' }]
            });

            const newInstruction = 'New test instruction';
            chatHistoryManager.updateInitialInstruction(newInstruction);
            const history = chatHistoryManager.getHistory();

            expect(history).toHaveLength(2);
            expect(history[0].parts[0].text).toBe(newInstruction);
        });

        it('should not reset history if instruction is the same', () => {
            // Add a message
            const testMessage = {
                role: 'user',
                parts: [{ text: 'Test message' }]
            };
            chatHistoryManager.addToHistory(testMessage);

            chatHistoryManager.updateInitialInstruction(initialInstruction);
            const history = chatHistoryManager.getHistory();

            expect(history).toHaveLength(3);
            expect(history[2]).toEqual(testMessage);
        });
    });
});
