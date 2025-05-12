import { IChatResponse, IAIResponse } from '../../interfaces/ai-service.interface';
import { Logger } from '../../utils/logger';

export class ChatResponseProcessor {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('ChatResponseProcessor');
    }

    public processResponse(chatResponse: IChatResponse): IAIResponse {
        if (chatResponse && chatResponse.candidates && chatResponse.candidates.length > 0) {
            const candidate = chatResponse.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                const textPart = candidate.content.parts.find(part => part.text !== undefined && part.text !== null);
                if (textPart && typeof textPart.text === 'string') {
                    this.logger.info('Text response received.');
                    return { text: textPart.text };
                }
            }
        }
        this.logger.warn('No suitable text response found in AI candidate.');
        return { text: 'No response from AI.' };
    }
}
