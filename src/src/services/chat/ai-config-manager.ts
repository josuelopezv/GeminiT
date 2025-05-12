import { Logger } from '../../utils/logger';

export class AIConfigManager {
    private logger: Logger;
    private apiKey: string;
    private modelName: string;
    private initialModelInstruction: string;

    constructor(apiKey: string = '', modelName: string = '', initialModelInstruction: string = '') {
        this.logger = new Logger('AIConfigManager');
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.initialModelInstruction = initialModelInstruction;
    }

    public updateConfig(apiKey: string, modelName: string, newInitialModelInstruction?: string): boolean {
        const keyChanged = this.apiKey !== apiKey;
        const modelChanged = this.modelName !== modelName;
        const instructionChanged = newInitialModelInstruction !== undefined && 
            this.initialModelInstruction !== newInitialModelInstruction;

        this.apiKey = apiKey;
        this.modelName = modelName;
        if (newInitialModelInstruction !== undefined) {
            this.initialModelInstruction = newInitialModelInstruction;
        }

        if (keyChanged || modelChanged || instructionChanged) {
            this.logger.info('Configuration updated.');
            return true;
        }
        
        this.logger.info('No configuration changes detected.');
        return false;
    }

    public getApiKey(): string {
        return this.apiKey;
    }

    public getModelName(): string {
        return this.modelName;
    }

    public getInitialInstruction(): string {
        return this.initialModelInstruction;
    }

    public isConfigValid(): boolean {
        return Boolean(this.apiKey && this.modelName);
    }
}
