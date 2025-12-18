
import React, { useEffect, useRef } from 'react';
import { CloseIcon } from './Icons';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);

    // Keep the latest onClose in a ref to avoid re-triggering effects when it changes
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Handle initial focus once per open
    useEffect(() => {
        if (isOpen) {
            // Delay focus slightly to ensure the modal is fully rendered and transitions are complete
            const timer = setTimeout(() => {
                if (modalRef.current && !modalRef.current.contains(document.activeElement)) {
                    modalRef.current.focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Handle escape key listener
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onCloseRef.current();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out] p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={() => onCloseRef.current()} // Close on backdrop click
        >
            <div
                ref={modalRef}
                className={`bg-gray-800 rounded-lg shadow-xl w-full ${sizeClasses[size]} border border-gray-700 animate-[slideInUp_0.3s_ease-out] flex flex-col max-h-[90vh]`}
                tabIndex={-1} // Make it focusable
                onClick={e => e.stopPropagation()} // Prevent closing when clicking inside modal
                style={{ outline: 'none' }}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                    <h2 id="modal-title" className="text-xl font-semibold text-gray-100">{title}</h2>
                    <button
                        onClick={() => onCloseRef.current()}
                        className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-600"
                        aria-label="Close dialog"
                    >
                        <CloseIcon />
                    </button>
                </header>
                <main className="p-6 overflow-y-auto custom-scrollbar">
                    {children}
                </main>
            </div>
        </div>
    );
};