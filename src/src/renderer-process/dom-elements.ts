// This file is now deprecated as UI is being managed by React components.
// DOM elements should be accessed via React refs within their respective components.
// Please delete this file.

export const terminalContainer = document.getElementById('terminal-container');
export const aiPanel = document.getElementById('ai-panel');
export const settingsBtn = document.getElementById('settings-btn');
export const settingsPanel = document.getElementById('settings-panel');
export const settingsCloseBtn = document.querySelector('.settings-close');
export const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
export const modelNameInput = document.getElementById('model-name') as HTMLSelectElement;
export const refreshModelsBtn = document.getElementById('refresh-models-btn') as HTMLButtonElement;
export const aiOutput = document.getElementById('ai-output') as HTMLDivElement;
export const aiQueryInput = document.querySelector('#ai-input input') as HTMLInputElement;
export const aiSendButton = document.querySelector('#ai-input button') as HTMLButtonElement;
