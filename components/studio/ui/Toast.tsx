import React, { useEffect, useState } from 'react';
import type { Toast as ToastType } from '../../../hooks/useToast';
import { CheckIcon, WarningIcon, CloseIcon } from '../../Icons';

interface ToastContainerProps {
    toasts: ToastType[];
    onRemove: (id: string) => void;
}

const toastStyles: Record<string, { bg: string; border: string; icon: React.ReactNode; accent: string }> = {
    success: {
        bg: 'bg-green-950/90',
        border: 'border-green-800/60',
        icon: <CheckIcon size={16} className="text-green-400" />,
        accent: 'text-green-300'
    },
    error: {
        bg: 'bg-red-950/90',
        border: 'border-red-800/60',
        icon: <WarningIcon size={16} className="text-red-400" />,
        accent: 'text-red-300'
    },
    info: {
        bg: 'bg-cyan-950/90',
        border: 'border-cyan-800/60',
        icon: <CheckIcon size={16} className="text-cyan-400" />,
        accent: 'text-cyan-300'
    },
    warning: {
        bg: 'bg-yellow-950/90',
        border: 'border-yellow-800/60',
        icon: <WarningIcon size={16} className="text-yellow-400" />,
        accent: 'text-yellow-300'
    },
};

const ToastItem: React.FC<{ toast: ToastType; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
    const [isVisible, setIsVisible] = useState(false);
    const style = toastStyles[toast.type] || toastStyles.info;

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleRemove = () => {
        setIsVisible(false);
        setTimeout(() => onRemove(toast.id), 200);
    };

    return (
        <div
            className={`
                flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl
                transition-all duration-300 ease-out min-w-[300px] max-w-[420px]
                ${style.bg} ${style.border}
                ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
            `}
        >
            <span className="flex-shrink-0 mt-0.5">{style.icon}</span>
            <p className={`text-sm font-medium flex-1 leading-snug ${style.accent}`}>
                {toast.message}
            </p>
            <button
                onClick={handleRemove}
                className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors p-0.5 -mt-0.5 -mr-1"
            >
                <CloseIcon size={14} />
            </button>
        </div>
    );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-2 pointer-events-auto">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
};
