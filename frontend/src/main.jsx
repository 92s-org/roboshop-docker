import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

// fonts are bundled, so the shop works without internet access
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';

import App from './App.jsx';
import { SessionProvider } from './session.jsx';
import { ToastProvider } from './toast.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <ToastProvider>
                <SessionProvider>
                    <App />
                </SessionProvider>
            </ToastProvider>
        </BrowserRouter>
    </StrictMode>
);
