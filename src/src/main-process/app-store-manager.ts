// filepath: c:/Users/Admin/source/repos/GeminiT/src/src/main-process/app-store-manager.ts
import Store, { Schema as ElectronStoreSchema } from 'electron-store';
import { AppStoreSchemaContents } from '../interfaces/store-schema.interface';
import { Logger } from '../utils/logger'; // Import Logger

const logger = new Logger('AppStoreManager'); // Create a logger instance

// Define the schema structure for electron-store
const schema: ElectronStoreSchema<AppStoreSchemaContents> = {
    geminiApiKey: {
        type: 'string',
        default: ''
    },
    geminiModelName: {
        type: 'string',
        default: 'gemini-1.5-flash-latest'
    },
    initialModelInstruction: {
        type: 'string',
        default: 'You are a helpful AI assistant integrated into a terminal application. When a user asks for a command, or if a command is the most helpful response, provide the command in a markdown code block, specifying the language (e.g., powershell, bash, cmd). If you are providing a command, use the execute_terminal_command tool. Do not use it for other purposes. If the user asks a question about a previous command\'s output, I will provide that output as context.'
    }
};

class AppStoreManager {
    private store: Store<AppStoreSchemaContents>;

    constructor() {
        this.store = new Store<AppStoreSchemaContents>({
            schema
        });
        logger.info('AppStoreManager initialized (encryption removed).');
        logger.debug('Initial store path:', (this.store as any).path); // Log store path
        logger.debug('Initial store content:', (this.store as any).store);
    }

    // Gemini API Key
    public getGeminiApiKey(): string {
        const value = (this.store as any).get('geminiApiKey') as string;
        logger.debug(`getGeminiApiKey: returning '${value}'`);
        return value;
    }

    public setGeminiApiKey(apiKey: string): void {
        logger.info(`setGeminiApiKey: setting to '${apiKey}'`);
        (this.store as any).set('geminiApiKey', apiKey);
        logger.debug('Store content after setGeminiApiKey:', (this.store as any).store);
    }

    // Gemini Model Name
    public getGeminiModelName(): string {
        const value = (this.store as any).get('geminiModelName') as string;
        logger.debug(`getGeminiModelName: returning '${value}'`);
        return value;
    }

    public setGeminiModelName(modelName: string): void {
        logger.info(`setGeminiModelName: setting to '${modelName}'`);
        (this.store as any).set('geminiModelName', modelName);
        logger.debug('Store content after setGeminiModelName:', (this.store as any).store);
    }

    // Initial Model Instruction
    public getInitialModelInstruction(): string {
        const instruction = (this.store as any).get('initialModelInstruction') as string;
        logger.debug(`getInitialModelInstruction: returning '${instruction ? instruction.substring(0, 50) + "..." : "<empty_or_default>"}'`);
        return instruction; // The IPC handler will apply the DEFAULT_INITIAL_MODEL_INSTRUCTION logic
    }

    public setInitialModelInstruction(instruction: string): void {
        logger.info(`setInitialModelInstruction: setting to '${instruction ? instruction.substring(0,50) + "..." : "<empty>"}'`);
        (this.store as any).set('initialModelInstruction', instruction);
        logger.debug('Store content after setInitialModelInstruction:', (this.store as any).store);
    }

    // Utility to get all store data, might be useful for debugging or settings export
    public getAllSettings(): AppStoreSchemaContents {
        return (this.store as any).store as AppStoreSchemaContents;
    }

    // Utility to clear a specific setting or all settings
    public clearSetting(key: keyof AppStoreSchemaContents): void {
        (this.store as any).delete(key);
    }

    public clearAllSettings(): void {
        (this.store as any).clear();
    }
}

// Re-add DEFAULT_INITIAL_MODEL_INSTRUCTION if it was removed or ensure it's accessible
const DEFAULT_INITIAL_MODEL_INSTRUCTION = `You are an expert command-line assistant integrated into a terminal application.
When you suggest a command, you MUST embed it directly in your response using a markdown code block.
For example: \`\`\`shell
your_command_here
\`\`\` or \`\`\`powershell
Get-Help
\`\`\`
Do NOT attempt to use any functions, tools, or special calling mechanisms to execute commands. Simply provide the command text in a markdown code block.
The user's operating system is Windows, and their default shell is PowerShell (pwsh.exe). Please provide commands suitable for this environment if possible, or use generic shell commands.
If multiple commands are part of a sequence, provide them in separate, clearly explained markdown blocks if appropriate.`;

// Export a single instance (singleton pattern)
const appStoreManagerInstance = new AppStoreManager();
export { AppStoreManager }; // Export the class for type usage
export default appStoreManagerInstance; // Default export the instance
