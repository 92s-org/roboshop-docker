import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info };

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id) => {
        setToasts((list) => list.filter((t) => t.id !== id));
    }, []);

    const push = useCallback((kind, title, detail) => {
        const id = nextId.current++;
        setToasts((list) => [...list.slice(-3), { id, kind, title, detail }]);
        setTimeout(() => dismiss(id), 4200);
    }, [dismiss]);

    const toast = useMemo(() => ({
        success: (title, detail) => push('success', title, detail),
        error: (title, detail) => push('error', title, detail),
        info: (title, detail) => push('info', title, detail)
    }), [push]);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toasts" role="status" aria-live="polite">
                {toasts.map((t) => {
                    const Icon = ICONS[t.kind];
                    return (
                        <div key={t.id} className={`toast toast-${t.kind}`}>
                            <Icon size={18} className="toast-icon" />
                            <div className="toast-body">
                                <strong>{t.title}</strong>
                                {t.detail && <span>{t.detail}</span>}
                            </div>
                            <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
