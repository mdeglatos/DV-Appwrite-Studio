
import React, { useState, useCallback } from 'react';
import type { ModalState, FormField } from '../types';

export function useStudioModals() {
    const [modal, setModal] = useState<ModalState | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [formValues, setFormValues] = useState<any>({});

    const closeModal = useCallback(() => {
        setModal(null);
        setFormValues({});
        setModalLoading(false);
    }, []);

    const confirmAction = useCallback((title: string, message: string, onConfirm: () => Promise<void>) => {
        setModal({
            isOpen: true,
            type: 'confirm',
            title,
            message,
            confirmLabel: 'Confirm',
            confirmClass: 'bg-red-600 hover:bg-red-700',
            onConfirm
        });
    }, []);

    const openForm = useCallback((
        title: string, 
        fields: FormField[], 
        onConfirm: (data: any) => Promise<void>, 
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
