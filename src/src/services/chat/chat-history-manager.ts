import { Content } from '@google/generative-ai';
import { Logger } from '../../utils/logger';

export class ChatHistoryManager {
    private logger: Logger;
    private history: Content[] = [];
    private maxHistoryLength: number;
    private initialInstruction: string;

    constructor(initialInstruction: string, maxHistoryLength: number = 20) {
        this.logger = new Logger('ChatHistoryManager');
        this.maxHistoryLength = maxHistoryLength;
        this.initialInstruction = initialInstruction;
        this.initializeHistory();
    }

    private initializeHistory(): void {
        this.history = [
            { role: "user", parts: [{ text: this.initialInstruction }] },
            { role: "model", parts: [{ text: "Understood. I will follow these instructions and provide commands in markdown code blocks." }] }
        ];
        this.logger.info('Chat history initialized with system prompt.');
    }

    public addToHistory(content: Content): void {
        this.history.push(content);
        if (this.history.length > this.maxHistoryLength) {
            const systemPrompts = this.history.slice(0, 2);
            const recentHistory = this.history.slice(this.history.length - (this.maxHistoryLength - 2));
            this.history = [...systemPrompts, ...recentHistory];
            this.logger.debug('Chat history truncated.');
        }
    }

    public getHistory(): Content[] {
        return this.history;
    }

    public resetHistory(): void {
        this.initializeHistory();
    }

    public removeLastUserMessage(): void {
        if (this.history.length > 0 && this.history[this.history.length - 1].role === "user") {
            this.history.pop();
            this.logger.debug('Last user message removed from history.');
        }
    }

    public updateInitialInstruction(newInstruction: string): void {
        if (this.initialInstruction !== newInstruction) {
            this.initialInstruction = newInstruction;
            this.initializeHistory();
            this.logger.info('Initial instruction updated, history reset.');
        }
    }
}
