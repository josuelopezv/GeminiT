import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatInput from '../../../../src/renderer-process/components/chat/ChatInput';

describe('ChatInput', () => {
    const defaultProps = {
        value: '',
        onChange: jest.fn(),
        onSend: jest.fn(),
        isDisabled: false,
        isProcessing: false,
        errorMessage: ''
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render input and send button', () => {
        render(<ChatInput {...defaultProps} />);
        
        expect(screen.getByPlaceholderText('Ask the AI...')).toBeInTheDocument();
        expect(screen.getByTitle('Send')).toBeInTheDocument();
    });

    it('should call onChange when input value changes', () => {
        render(<ChatInput {...defaultProps} />);
        
        const input = screen.getByPlaceholderText('Ask the AI...');
        fireEvent.change(input, { target: { value: 'test message' } });
        
        expect(defaultProps.onChange).toHaveBeenCalledWith('test message');
    });

    it('should call onSend when send button is clicked', () => {
        render(<ChatInput {...defaultProps} />);
        
        const sendButton = screen.getByTitle('Send');
        fireEvent.click(sendButton);
        
        expect(defaultProps.onSend).toHaveBeenCalled();
    });

    it('should call onSend when Enter is pressed', () => {
        render(<ChatInput {...defaultProps} />);
        
        const input = screen.getByPlaceholderText('Ask the AI...');
        fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });
        
        expect(defaultProps.onSend).toHaveBeenCalled();
    });

    it('should disable input and button when isDisabled is true', () => {
        render(<ChatInput {...defaultProps} isDisabled={true} />);
        
        expect(screen.getByPlaceholderText('Ask the AI...')).toBeDisabled();
        expect(screen.getByTitle('Send')).toBeDisabled();
    });

    it('should show loading spinner when isProcessing is true', () => {
        render(<ChatInput {...defaultProps} isProcessing={true} />);
        
        expect(screen.getByText('', { selector: '.loading-spinner' })).toBeInTheDocument();
    });

    it('should display error message when provided', () => {
        const errorMessage = 'API Key not set';
        render(<ChatInput {...defaultProps} errorMessage={errorMessage} />);
        
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should not call onSend when input is disabled or processing', () => {
        render(<ChatInput {...defaultProps} isDisabled={true} isProcessing={true} />);
        
        const input = screen.getByPlaceholderText('Ask the AI...');
        fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });
        
        const sendButton = screen.getByTitle('Send');
        fireEvent.click(sendButton);
        
        expect(defaultProps.onSend).not.toHaveBeenCalled();
    });
});
