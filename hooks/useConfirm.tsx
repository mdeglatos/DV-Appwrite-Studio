import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ConfirmationModal } from '../components/ConfirmationModal';

/**
 * The single owner of "how the app asks for confirmation".
 *
 * `CONTEXT.md` §2 bans `confirm()`; every destructive action goes through
 * `useConfirm()`, which resolves `true` on confirm and `false` on cancel or
 * Escape. `components/ConfirmationModal.tsx` is this provider's presentation —
 * it is not duplicated anywhere else.
 */

export interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;        // default 'Confirm'
    cancelText?: string;         // default 'Cancel'
    confirmButtonClass?: string; // default 'bg-red-600 hover:bg-red-700'
}

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const pendingRef = useRef<((result: boolean) => void) | null>(null);

    const confirm = useCallback<ConfirmFn>((opts) => new Promise<boolean>(resolve => {
        // Exactly one dialog is ever in the tree: a new request cancels any pending one.
        pendingRef.current?.(false);
        pendingRef.current = resolve;
        setOptions(opts);
    }), []);

    const settle = useCallback((result: boolean) => {
        const resolve = pendingRef.current;
        pendingRef.current = null;
        setOptions(null);
        resolve?.(result);
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {options && (
                <ConfirmationModal
                    isOpen
                    title={options.title}
                    message={options.message}
                    confirmText={options.confirmText}
                    cancelText={options.cancelText}
                    confirmButtonClass={options.confirmButtonClass}
                    onConfirm={() => settle(true)}
                    onClose={() => settle(false)}
                />
            )}
        </ConfirmContext.Provider>
    );
};

export function useConfirm(): ConfirmFn {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
}
