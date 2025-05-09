import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

interface AIResponse {
    text: string;
    suggestedCommand?: string;
}

class AIService {
    private genAI!: GoogleGenerativeAI | null;
    private model!: GenerativeModel | null;
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.initializeWithKey(apiKey);
    }

    private initializeWithKey(apiKey: string) {
        this.apiKey = apiKey; // Store the key
        if (apiKey) { // Only initialize if key is present
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        } else {
            this.genAI = null;
            this.model = null;
        }
    }

    updateApiKey(apiKey: string) {
        this.initializeWithKey(apiKey);
    }

    getApiKey(): string { // Added this method
        return this.apiKey;
    }

    async processQuery(query: string, terminalHistory: string): Promise<AIResponse> {
        if (!this.apiKey || !this.model) {
            throw new Error('AI Service is not initialized. API key may be missing or invalid.');
        }
        try {
            const prompt = `You are an AI assistant helping with terminal commands.
            Recent terminal history:
            ${terminalHistory}
            
            User query: ${query}
            
            If the user is asking for a command, suggest one and explain what it does.
            If not, provide a helpful explanation.
            
            Format your response as:
            Explanation: <your explanation>
            Command: <suggested command if applicable>`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Parse the response to extract command if present
            const commandMatch = text.match(/Command:\s*(.+)$/m);
            const explanationMatch = text.match(/Explanation:\s*(.+)(?=\nCommand:|$)/s);

            return {
                text: explanationMatch ? explanationMatch[1].trim() : text,
                suggestedCommand: commandMatch ? commandMatch[1].trim() : undefined
            };
        } catch (error) {
            console.error('AI Service Error:', error);
            throw error;
        }
    }
}

export { AIService, AIResponse };