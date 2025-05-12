import { renderHook, act } from '@testing-library/react';
import { useChatLogic } from '../../../../src/renderer-process/hooks/chat/useChatLogic';
import { ipcRenderer } from 'electron';

// Mock electron's ipcRenderer
jest.mock('electron', () => ({
    ipcRenderer: {
        invoke: jest.fn()
    }
}));

describe('useChatLogic', () => {
    const mockProps = {
        terminalId: 'test-terminal',
        terminalHistory: 'test history',
        apiKeyStatus: { isValid: true, key: 'test-key' },
        currentModelNameFromApp: 'test-model',
        setIsSettingsPanelVisible: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize with empty state', () => {
        const { result } = renderHook(() => useChatLogic(mockProps));

        expect(result.current.messages).toEqual([]);
        expect(result.current.suggestedCommands).toEqual([]);
        expect(result.current.userInput).toBe('');
        expect(result.current.isProcessing).toBe(false);
    });

    describe('handleSendQuery', () => {
        it('should show error if API key is not valid', async () => {
            const { result } = renderHook(() => useChatLogic({
                ...mockProps,
                apiKeyStatus: { isValid: false, key: '' }
            }));

            await act(async () => {
                await result.current.handleSendQuery();
            });

            expect(result.current.messages[0]).toEqual(expect.objectContaining({
                sender: 'System',
                content: expect.stringContaining('API key'),
                type: 'error'
            }));
            expect(mockProps.setIsSettingsPanelVisible).toHaveBeenCalledWith(true);
        });

        it('should show error if model name is not set', async () => {
            const { result } = renderHook(() => useChatLogic({
                ...mockProps,
                currentModelNameFromApp: ''
            }));

            await act(async () => {
                await result.current.handleSendQuery();
            });

            expect(result.current.messages[0]).toEqual(expect.objectContaining({
                sender: 'System',
                content: expect.stringContaining('Model Name'),
                type: 'error'
            }));
        });

        it('should process query successfully', async () => {
            const mockResponse = { text: 'AI response' };
            (ipcRenderer.invoke as jest.Mock).mockResolvedValueOnce(mockResponse);

            const { result } = renderHook(() => useChatLogic(mockProps));

            await act(async () => {
                result.current.setUserInput('test query');
                await result.current.handleSendQuery();
            });

            expect(ipcRenderer.invoke).toHaveBeenCalledWith('ai:process-query', expect.any(Object));
            expect(result.current.messages).toEqual([
                expect.objectContaining({
                    sender: 'User',
                    content: 'test query'
                }),
                expect.objectContaining({
                    sender: 'AI',
                    content: 'AI response'
                })
            ]);
        });
    });

    describe('handleExecuteSuggestedCommand', () => {
        const mockCommand = { command: 'test command' };

        it('should execute command successfully', async () => {
            const mockResult = { output: 'command output' };
            (ipcRenderer.invoke as jest.Mock).mockResolvedValueOnce(mockResult);

            const { result } = renderHook(() => useChatLogic(mockProps));

            await act(async () => {
                await result.current.handleExecuteSuggestedCommand(mockCommand);
            });

            expect(ipcRenderer.invoke).toHaveBeenCalledWith('terminal:execute-and-capture-output', {
                command: mockCommand.command,
                terminalId: mockProps.terminalId
            });

            expect(result.current.messages).toEqual([
                expect.objectContaining({
                    sender: 'User (Executing)',
                    content: mockCommand.command,
                    type: 'command'
                }),
                expect.objectContaining({
                    sender: 'System',
                    content: expect.stringContaining(mockResult.output),
                    type: 'command-output'
                })
            ]);
        });

        it('should handle command execution error', async () => {
            const mockError = { error: 'command failed' };
            (ipcRenderer.invoke as jest.Mock).mockResolvedValueOnce(mockError);

            const { result } = renderHook(() => useChatLogic(mockProps));

            await act(async () => {
                await result.current.handleExecuteSuggestedCommand(mockCommand);
            });

            expect(result.current.messages[1]).toEqual(expect.objectContaining({
                sender: 'System',
                content: expect.stringContaining(mockError.error),
                type: 'error'
            }));
        });
    });
});
