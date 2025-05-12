import React from 'react';
import ReactDOM from 'react-dom/client';

// Import global styles
import '../styles/tailwind.css'; 
import '../styles/main.css';     
import '@xterm/xterm/css/xterm.css'; 
import 'remixicon/fonts/remixicon.css'; // Added Remix Icon CSS import

import App from './renderer-process/components/App';

const rootElement = document.getElementById('root');

if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );    // In development mode, check for legacy initializers
    if (process.env.NODE_ENV === 'development') {
        const legacyScripts = document.querySelectorAll('script:not([src*="renderer.js"])');
        if (legacyScripts.length > 0) {
            console.warn('Found non-React scripts. All UI should be React components.');
        }
    }
} else {
    console.error('Failed to find the root element. React app will not be mounted.');
}
