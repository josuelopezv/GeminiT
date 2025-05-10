// Import styles first to ensure they are loaded
import '@xterm/xterm/css/xterm.css';

// Import and initialize renderer process modules
import { initializeTerminal } from './renderer-process/terminal-setup';
import { initializeSettingsPanel } from './renderer-process/settings-ui';
import { initializeAiInterface } from './renderer-process/ai-interface';

document.addEventListener('DOMContentLoaded', () => {
    initializeTerminal();
    initializeSettingsPanel();
    initializeAiInterface();
});