import { Part, FunctionResponsePart, GenerateContentResponse } from '@google/generative-ai';
import { GenericMessagePart, IChatResponse, IChatCompletionCandidate, IChatCompletionPart } from '../../interfaces/ai-service.interface';
import { Logger } from '../../utils/logger';

export class MessageMapper {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('MessageMapper');
    }

    public mapGenericPartsToGeminiParts(parts: GenericMessagePart[]): Part[] {
        return parts.map(p => {
            if ('text' in p) {
                return { text: p.text };
            }
            if ('functionResponse' in p) {
                return { functionResponse: p.functionResponse } as FunctionResponsePart;
            }
            this.logger.warn('Unknown part type in mapGenericPartsToGeminiParts', p);
            return { text: '[Unsupported part type]' };
        });
    }

    public mapGeminiResponseToIChatResponse(geminiResponse: GenerateContentResponse): IChatResponse {
        const candidates: IChatCompletionCandidate[] = (geminiResponse.candidates || []).map(candidate => {
            const parts: IChatCompletionPart[] = (candidate.content?.parts || []).map(part => {
                const iPart: IChatCompletionPart = {};
                if (part.text) iPart.text = part.text;
                if (part.functionCall) {
                    this.logger.warn('A functionCall part was unexpectedly received from Gemini:', part.functionCall);
                }
                return iPart;
            });
            return {
                content: {
                    parts: parts.filter(p => p.text !== undefined),
                    role: candidate.content?.role
                }
            };
        });
        return { candidates };
    }
}
