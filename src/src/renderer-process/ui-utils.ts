import * as DOM from './dom-elements';

/**
 * Appends a message to the AI output panel.
 * @param sender The sender of the message (e.g., "User", "AI", "System").
 * @param content The content of the message.
 */
export function appendMessage(sender: string, content: string) {
    if (!DOM.aiOutput) return;
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '10px';
    // Basic sanitization to prevent HTML injection from content, consider a more robust library if needed.
    const strong = document.createElement('strong');
    strong.textContent = `${sender}: `;
    messageDiv.appendChild(strong);
    messageDiv.appendChild(document.createTextNode(content));
    DOM.aiOutput.appendChild(messageDiv);
    DOM.aiOutput.scrollTo(0, DOM.aiOutput.scrollHeight);
}

/**
 * Strips ANSI escape codes from a string.
 * @param str The string to clean.
 * @returns The string without ANSI escape codes.
 */
export function stripAnsiCodes(str: string): string {
    return str.replace(/[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}
