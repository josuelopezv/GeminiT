// filepath: c:/Users/Admin/source/repos/GeminiT/src/src/main-process/app-store-manager.ts
import Store, { Schema as ElectronStoreSchema } from 'electron-store';
import { AppStoreSchemaContents } from '../interfaces/store-schema.interface';

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
            schema,
            // TODO: Consider a more secure way to handle this encryption key or if it's needed.
            // For now, using a placeholder. If encryption is not strictly needed for these settings,
            // it might be better to remove it to avoid potential key management issues.
            encryptionKey: 'your-app-secret-key-placeholder' 
        });
    }

    // Gemini API Key
    public getGeminiApiKey(): string {
        return (this.store as any).get('geminiApiKey') as string;
    }

    public setGeminiApiKey(apiKey: string): void {
        (this.store as any).set('geminiApiKey', apiKey);
    }

    // Gemini Model Name
    public getGeminiModelName(): string {
        return (this.store as any).get('geminiModelName') as string;
    }

    public setGeminiModelName(modelName: string): void {
        (this.store as any).set('geminiModelName', modelName);
    }

    // Initial Model Instruction
    public getInitialModelInstruction(): string {
        // Provide a default if the stored value is undefined or empty, similar to settings-ipc
        const instruction = (this.store as any).get('initialModelInstruction') as string;
        return instruction || DEFAULT_INITIAL_MODEL_INSTRUCTION; // Ensure a default is returned
    }

    public setInitialModelInstruction(instruction: string): void {
        (this.store as any).set('initialModelInstruction', instruction);
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
const DEFAULT_INITIAL_MODEL_INSTRUCTION = "You are a helpful AI assistant integrated into a terminal application. When a user asks for a command, or if a command is the most helpful response, provide the command in a markdown code block, specifying the language (e.g., powershell, bash, cmd). If you are providing a command, use the execute_terminal_command tool. Do not use it for other purposes. If the user asks a question about a previous command's output, I will provide that output as context.";

// Export a single instance (singleton pattern)
const appStoreManagerInstance = new AppStoreManager();
export { AppStoreManager }; // Export the class for type usage
export default appStoreManagerInstance; // Default export the instance
