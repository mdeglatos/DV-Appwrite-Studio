import React from 'react';

export type ModalType = 'confirm' | 'form' | 'custom';

export interface FormField {
    name: string;
    label: string;
    type?: 'text' | 'password' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox';
    placeholder?: string;
    defaultValue?: string | boolean | number;
    options?: { label: string; value: string }[];
    required?: boolean;
    description?: string;
}

export interface ModalState {
    isOpen: boolean;
    type: ModalType;
    title: string;
    message?: string; // For confirmation
    fields?: FormField[]; // For forms
    content?: React.ReactNode; // For custom content
    confirmLabel?: string;
    confirmClass?: string;
    // Fix: Allow returning boolean or Promise<boolean | void> to support preventing auto-close in Studio actions
    onConfirm?: (formData: any) => Promise<boolean | void> | boolean | void;
    hideCancel?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}