import React from 'react';
import ReactDOM from 'react-dom/client';

// Import global styles
import '../../styles/tailwind.css'; 
import '../../styles/main.css';     
import '@xterm/xterm/css/xterm.css'; 
import 'remixicon/fonts/remixicon.css';

import App from './components/App';

const rootElement = document.getElementById('root');

if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
} else {
    console.error('Failed to find the root element. React app will not be mounted.');
}
