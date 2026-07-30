import React, { useState, useCallback } from 'react';
import type { ModalState, FormField } from '../types';
import { useConfirm } from '../../../hooks/useConfirm';
import { useToast } from '../../../hooks/useToast';

/**
 * @param onAfterClose invoked once `closeModal` has cleared the modal state —
 *        `Studio.tsx` uses it to keep the URL in step with the closed modal.
 *        Replaces the previous post-hoc reassignment of `closeModal`.
 */
export function useStudioModals(onAfterClose?: () => void) {
    const [modal, setModal] = useState<ModalState | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [formValues, setFormValues] = useState<any>({});

    const confirm = useConfirm();
    const toast = useToast();

    const closeModal = useCallback(() => {
        setModal(null);
        setFormValues({});
        setModalLoading(false);
        onAfterClose?.();
    }, [onAfterClose]);

    // A thin wrapper over the app-wide confirmation owner: the call signature is
    // unchanged, so every existing `confirmAction(...)` call site is untouched.
    const confirmAction = useCallback((title: string, message: string, onConfirm: () => Promise<boolean | void> | boolean | void) => {
        void (async () => {
            const confirmed = await confirm({
                title,
                message,
                confirmText: 'Confirm',
                confirmButtonClass: 'bg-red-600 hover:bg-red-700',
            });
            if (!confirmed) return;
            try {
                await onConfirm();
            } catch (err: any) {
                toast.error(`Action Failed: ${err?.message || String(err)}`);
            }
        })();
    }, [confirm, toast]);

    // Fix: Update onConfirm type to allow returning boolean or void to match ModalState
    const openForm = useCallback((
        title: string, 
        fields: FormField[], 
        onConfirm: (data: any) => Promise<boolean | void> | boolean | void, 
        confirmLabel = "Create"
    ) => {
        const initialValues: any = {};
        fields.forEach(f => {
            if (f.defaultValue !== undefined) initialValues[f.name] = f.defaultValue;
        });
        setFormValues(initialValues);
        
        setModal({
            isOpen: true,
            type: 'form',
            title,
            fields,
            confirmLabel,
            confirmClass: 'bg-cyan-600 hover:bg-cyan-500',
            onConfirm
        });
    }, []);

    const openCustomModal = useCallback((title: string, content: React.ReactNode, size: any = 'md') => {
        setModal({
            isOpen: true,
            type: 'custom',
            title,
            content,
            size,
            hideCancel: true,
            confirmLabel: "Close",
            confirmClass: "bg-gray-700 hover:bg-gray-600",
            onConfirm: () => {}
        });
    }, []);

    return {
        modal, setModal,
        modalLoading, setModalLoading,
        formValues, setFormValues,
        closeModal, confirmAction, openForm, openCustomModal
    };
}