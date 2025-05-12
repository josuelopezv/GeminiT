import { IChatManager, GenericMessagePart, IChatResponse } from '../../interfaces/ai-service.interface';
import { Logger } from '../../utils/logger';

export abstract class BaseChatManager implements IChatManager {
    protected logger: Logger;
    protected apiKey: string;
    protected modelName: string;
    protected initialInstruction: string;

    constructor(apiKey: string, modelName: string, initialInstruction: string = '') {
        this.logger = new Logger('BaseChatManager');
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.initialInstruction = initialInstruction;
    }

    abstract sendMessage(messageParts: GenericMessagePart[]): Promise<IChatResponse>;
    abstract initialize(): Promise<void>;

    updateCredentials(apiKey: string, modelName: string, newInitialInstruction?: string): void {
        this.apiKey = apiKey;
        this.modelName = modelName;
        if (newInitialInstruction !== undefined) {
            this.initialInstruction = newInitialInstruction;
        }
    }
}
