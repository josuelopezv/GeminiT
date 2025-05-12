import { renderHook, act } from '@testing-library/react';
import { useSettingsLogic } from '../../../../src/renderer-process/hooks/settings/useSettingsLogic';
import { ipcRenderer } from 'electron';

// Mock electron's ipcRenderer
jest.mock('electron', () => ({
    ipcRenderer: {
        invoke: jest.fn()
    }
}));

describe('useSettingsLogic', () => {
    const mockProps = {
        initialApiKey: 'initial-key',
        initialModelName: 'initial-model',
        initialModelInstruction: 'initial-instruction',
        onApiKeyChange: jest.fn(),
        onModelNameChange: jest.fn(),
        onInitialModelInstructionChange: jest.fn(),
        onClose: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize with provided values', () => {
        const { result } = renderHook(() => useSettingsLogic(mockProps));

        expect(result.current.apiKey).toBe(mockProps.initialApiKey);
        expect(result.current.modelName).toBe(mockProps.initialModelName);
        expect(result.current.modelInstruction).toBe(mockProps.initialModelInstruction);
        expect(result.current.availableModels).toEqual([]);
        expect(result.current.isLoadingModels).toBe(false);
        expect(result.current.error).toBeNull();
    });

    describe('handleFetchModels', () => {
        it('should fetch models successfully', async () => {
            const mockModels = ['model1', 'model2'];
            (ipcRenderer.invoke as jest.Mock).mockResolvedValueOnce(mockModels);

            const { result } = renderHook(() => useSettingsLogic(mockProps));

            await act(async () => {
                await result.current.handleFetchModels();
            });

            expect(ipcRenderer.invoke).toHaveBeenCalledWith('settings:fetch-models', mockProps.initialApiKey);
            expect(result.current.availableModels).toEqual(mockModels);
            expect(result.current.error).toBeNull();
        });

        it('should handle fetch models error', async () => {
            const error = new Error('Failed to fetch');
            (ipcRenderer.invoke as jest.Mock).mockRejectedValueOnce(error);

            const { result } = renderHook(() => useSettingsLogic(mockProps));

            await act(async () => {
                await result.current.handleFetchModels();
            });

            expect(result.current.error).toBe(error.message);
            expect(result.current.availableModels).toEqual([]);
        });

        it('should require API key to fetch models', async () => {
            const { result } = renderHook(() => useSettingsLogic({
                ...mockProps,
                initialApiKey: ''
            }));

            await act(async () => {
                await result.current.handleFetchModels();
            });

            expect(result.current.error).toBe('API key is required to fetch models.');
            expect(ipcRenderer.invoke).not.toHaveBeenCalled();
        });
    });

    describe('handleSave', () => {
        beforeEach(() => {
            (ipcRenderer.invoke as jest.Mock)
                .mockResolvedValueOnce({ success: true }) // API key
                .mockResolvedValueOnce({ success: true }) // Model name
                .mockResolvedValueOnce({ success: true }); // Model instruction
        });

        it('should save all settings successfully', async () => {
            const { result } = renderHook(() => useSettingsLogic(mockProps));

            await act(async () => {
                await result.current.handleSave();
            });

            expect(ipcRenderer.invoke).toHaveBeenCalledWith('settings:set-api-key', mockProps.initialApiKey);
            expect(ipcRenderer.invoke).toHaveBeenCalledWith('settings:set-model-name', mockProps.initialModelName);
            expect(ipcRenderer.invoke).toHaveBeenCalledWith('settings:set-initial-model-instruction', mockProps.initialModelInstruction);

            expect(mockProps.onApiKeyChange).toHaveBeenCalledWith(mockProps.initialApiKey);
            expect(mockProps.onModelNameChange).toHaveBeenCalledWith(mockProps.initialModelName);
            expect(mockProps.onInitialModelInstructionChange).toHaveBeenCalledWith(mockProps.initialModelInstruction);
            expect(mockProps.onClose).toHaveBeenCalled();
        });

        it('should handle save error', async () => {
            const error = { success: false, error: 'Failed to save' };
            (ipcRenderer.invoke as jest.Mock).mockResolvedValueOnce(error);

            const { result } = renderHook(() => useSettingsLogic(mockProps));

            await act(async () => {
                await result.current.handleSave();
            });

            expect(result.current.error).toBe(error.error);
            expect(mockProps.onClose).not.toHaveBeenCalled();
        });
    });

    it('should update state when props change', () => {
        const { result, rerender } = renderHook(
            (props) => useSettingsLogic(props as typeof mockProps),
            { initialProps: mockProps }
        );

        const newProps = {
            ...mockProps,
            initialApiKey: 'new-key',
            initialModelName: 'new-model',
            initialModelInstruction: 'new-instruction'
        };

        rerender(newProps);

        expect(result.current.apiKey).toBe(newProps.initialApiKey);
        expect(result.current.modelName).toBe(newProps.initialModelName);
        expect(result.current.modelInstruction).toBe(newProps.initialModelInstruction);
    });
});
