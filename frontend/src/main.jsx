import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

// fonts are bundled, so the shop works without internet access
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
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
