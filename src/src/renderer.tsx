import React from 'react';
import ReactDOM from 'react-dom/client';

// Import global styles
import '../styles/tailwind.css'; 
import '../styles/main.css';     
import '@xterm/xterm/css/xterm.css'; 

import App from './renderer-process/components/App';

const rootElement = document.getElementById('root');

if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    document.addEventListener('DOMContentLoaded', () => {
        console.warn('Legacy initializers are being called. This should be empty once all UI is React components.');
    });
} else {
    console.error('Failed to find the root element. React app will not be mounted.');
}
