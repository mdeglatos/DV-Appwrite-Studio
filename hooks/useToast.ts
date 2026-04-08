import { useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

export interface ToastActions {
    toasts: Toast[];
    addToast: (type: ToastType, message: string, duration?: number) => void;
    removeToast: (id: string) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
}

let globalIdCounter = 0;

export function useToast(): ToastActions {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const removeToast = useCallback((id: string) => {
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
        const id = `toast_${++globalIdCounter}_${Date.now()}`;
        const toast: Toast = { id, type, message, duration };
        
        setToasts(prev => [...prev.slice(-4), toast]); // Keep max 5

        if (duration > 0) {
            const timer = setTimeout(() => {
                removeToast(id);
            }, duration);
            timersRef.current.set(id, timer);
        }

        return id;
    }, [removeToast]);

    const success = useCallback((message: string) => addToast('success', message), [addToast]);
    const error = useCallback((message: string) => addToast('error', message, 6000), [addToast]);
    const info = useCallback((message: string) => addToast('info', message), [addToast]);
    const warning = useCallback((message: string) => addToast('warning', message, 5000), [addToast]);

    return { toasts, addToast, removeToast, success, error, info, warning };
}
