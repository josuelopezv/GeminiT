import { MessageMapper } from '../../../../src/services/chat/message-mapper';
import { GenericMessagePart } from '../../../../src/interfaces/ai-service.interface';

describe('MessageMapper', () => {
    let messageMapper: MessageMapper;

    beforeEach(() => {
        messageMapper = new MessageMapper();
    });

    describe('mapGenericPartsToGeminiParts', () => {
        it('should map text parts correctly', () => {
            const parts: GenericMessagePart[] = [
                { text: 'Test message' }
            ];

            const result = messageMapper.mapGenericPartsToGeminiParts(parts);

            expect(result).toEqual([
                { text: 'Test message' }
            ]);
        });

        it('should map function response parts correctly', () => {
            const parts: GenericMessagePart[] = [
                { functionResponse: { name: 'test', response: { data: 'test' } } }
            ];

            const result = messageMapper.mapGenericPartsToGeminiParts(parts);

            expect(result).toEqual([
                { functionResponse: { name: 'test', response: { data: 'test' } } }
            ]);
        });

        it('should handle unsupported parts', () => {
            const parts = [
                { unknownType: 'test' }
            ] as GenericMessagePart[];

            const result = messageMapper.mapGenericPartsToGeminiParts(parts);

            expect(result).toEqual([
                { text: '[Unsupported part type]' }
            ]);
        });
    });

    describe('mapGeminiResponseToIChatResponse', () => {
        it('should map Gemini response to IChatResponse format', () => {
            const geminiResponse = {
                candidates: [
                    {
                        content: {
                            parts: [{ text: 'Test response' }],
                            role: 'model'
                        }
                    }
                ]
            };

            const result = messageMapper.mapGeminiResponseToIChatResponse(geminiResponse);

            expect(result).toEqual({
                candidates: [
                    {
                        content: {
                            parts: [{ text: 'Test response' }],
                            role: 'model'
                        }
                    }
                ]
            });
        });

        it('should filter out non-text parts', () => {
            const geminiResponse = {
                candidates: [
                    {
                        content: {
                            parts: [
                                { text: 'Test response' },
                                { functionCall: { name: 'test', args: {} } }
                            ],
                            role: 'model'
                        }
                    }
                ]
            };

            const result = messageMapper.mapGeminiResponseToIChatResponse(geminiResponse);

            expect(result).toEqual({
                candidates: [
                    {
                        content: {
                            parts: [{ text: 'Test response' }],
                            role: 'model'
                        }
                    }
                ]
            });
        });

        it('should handle empty response', () => {
            const geminiResponse = { candidates: [] };

            const result = messageMapper.mapGeminiResponseToIChatResponse(geminiResponse);

            expect(result).toEqual({ candidates: [] });
        });
    });
});
