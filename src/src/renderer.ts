import { initializeTerminal } from './renderer-process/terminal-setup';
import { initializeSettingsPanel } from './renderer-process/settings-ui';
import { initializeAiInterface } from './renderer-process/ai-interface';

// Import global styles if any are needed here, e.g., for xterm, though often handled by webpack/css imports in specific modules
// For xterm.css, it's imported directly in terminal-setup.ts via webpack's CSS loader.

document.addEventListener('DOMContentLoaded', () => {
    initializeTerminal();
    initializeSettingsPanel();
    initializeAiInterface();
});