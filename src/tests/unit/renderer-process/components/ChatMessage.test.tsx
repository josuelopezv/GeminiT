import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatMessage from '../../../../src/renderer-process/components/chat/ChatMessage';

describe('ChatMessage', () => {
    const defaultProps = {
        sender: 'User',
        content: 'Test message',
        id: 1,
    };

    it('should render user message correctly', () => {
        render(<ChatMessage {...defaultProps} />);
        
        expect(screen.getByText('User')).toBeInTheDocument();
        expect(screen.getByText('Test message')).toBeInTheDocument();
        expect(screen.getByText('User').parentElement).toHaveClass('chat-end');
    });

    it('should render AI message correctly', () => {
        render(<ChatMessage {...defaultProps} sender="AI" />);
        
        expect(screen.getByText('AI')).toBeInTheDocument();
        expect(screen.getByText('Test message')).toBeInTheDocument();
        expect(screen.getByText('AI').parentElement).toHaveClass('chat-start');
    });

    it('should apply error styling for error type', () => {
        render(<ChatMessage {...defaultProps} sender="System" type="error" />);
        
        const messageBubble = screen.getByText('Test message');
        expect(messageBubble).toHaveClass('chat-bubble-error');
    });

    it('should apply command styling for command type', () => {
        render(<ChatMessage {...defaultProps} sender="System" type="command" />);
        
        const messageBubble = screen.getByText('Test message');
        expect(messageBubble).toHaveClass('chat-bubble-info');
    });

    it('should handle multiline content', () => {
        const multilineContent = \`Line 1
Line 2
Line 3\`;
        
        render(<ChatMessage {...defaultProps} content={multilineContent} />);
        
        expect(screen.getByText(multilineContent)).toHaveClass('whitespace-pre-wrap');
    });

    it('should handle empty content', () => {
        render(<ChatMessage {...defaultProps} content="" />);
        
        expect(screen.getByText('User')).toBeInTheDocument();
        expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    });
});
