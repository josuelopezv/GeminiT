import { AIConfigManager } from '../../../../src/services/chat/ai-config-manager';

describe('AIConfigManager', () => {
    let configManager: AIConfigManager;
    const initialConfig = {
        apiKey: 'test-api-key',
        modelName: 'test-model',
        initialModelInstruction: 'test-instruction'
    };

    beforeEach(() => {
        configManager = new AIConfigManager(
            initialConfig.apiKey,
            initialConfig.modelName,
            initialConfig.initialModelInstruction
        );
    });

    describe('initialization', () => {
        it('should initialize with provided values', () => {
            expect(configManager.getApiKey()).toBe(initialConfig.apiKey);
            expect(configManager.getModelName()).toBe(initialConfig.modelName);
            expect(configManager.getInitialInstruction()).toBe(initialConfig.initialModelInstruction);
        });

        it('should initialize with empty values when not provided', () => {
            const emptyConfig = new AIConfigManager();
            expect(emptyConfig.getApiKey()).toBe('');
            expect(emptyConfig.getModelName()).toBe('');
            expect(emptyConfig.getInitialInstruction()).toBe('');
        });
    });

    describe('updateConfig', () => {
        it('should update API key and return true when changed', () => {
            const newApiKey = 'new-api-key';
            const changed = configManager.updateConfig(newApiKey, initialConfig.modelName);
            
            expect(changed).toBe(true);
            expect(configManager.getApiKey()).toBe(newApiKey);
        });

        it('should update model name and return true when changed', () => {
            const newModelName = 'new-model';
            const changed = configManager.updateConfig(initialConfig.apiKey, newModelName);
            
            expect(changed).toBe(true);
            expect(configManager.getModelName()).toBe(newModelName);
        });

        it('should update instruction and return true when changed', () => {
            const newInstruction = 'new-instruction';
            const changed = configManager.updateConfig(
                initialConfig.apiKey,
                initialConfig.modelName,
                newInstruction
            );
            
            expect(changed).toBe(true);
            expect(configManager.getInitialInstruction()).toBe(newInstruction);
        });

        it('should return false when no values change', () => {
            const changed = configManager.updateConfig(
                initialConfig.apiKey,
                initialConfig.modelName,
                initialConfig.initialModelInstruction
            );
            
            expect(changed).toBe(false);
        });
    });

    describe('isConfigValid', () => {
        it('should return true when API key and model name are set', () => {
            expect(configManager.isConfigValid()).toBe(true);
        });

        it('should return false when API key is missing', () => {
            configManager.updateConfig('', initialConfig.modelName);
            expect(configManager.isConfigValid()).toBe(false);
        });

        it('should return false when model name is missing', () => {
            configManager.updateConfig(initialConfig.apiKey, '');
            expect(configManager.isConfigValid()).toBe(false);
        });

        it('should return false when both API key and model name are missing', () => {
            configManager.updateConfig('', '');
            expect(configManager.isConfigValid()).toBe(false);
        });
    });
});
