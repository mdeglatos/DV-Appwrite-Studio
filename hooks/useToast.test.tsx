import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './useToast';

function Emitter({ onReady }: { onReady: (toast: ReturnType<typeof useToast>) => void }): null {
    const toast = useToast();
    React.useEffect(() => { onReady(toast); }, [onReady, toast]);
    return null;
}

/** Captures the live toast API from inside a provider. */
function renderWithProvider() {
    let api: ReturnType<typeof useToast> | null = null;
    const view = render(
        <ToastProvider>
            <Emitter onReady={t => { api = t; }} />
        </ToastProvider>
    );
    return { view, getApi: () => api! };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('ToastProvider', () => {
    it('renders a toast fired from a component that mounts no container of its own', () => {
        const { getApi } = renderWithProvider();
        act(() => { getApi().error('boom'); });
        expect(screen.getByText('boom')).toBeInTheDocument();
    });

    it('renders every toast type', () => {
        const { getApi } = renderWithProvider();
        act(() => {
            getApi().success('ok');
            getApi().info('fyi');
            getApi().warning('careful');
        });
        expect(screen.getByText('ok')).toBeInTheDocument();
        expect(screen.getByText('fyi')).toBeInTheDocument();
        expect(screen.getByText('careful')).toBeInTheDocument();
    });

    it('caps the container at 5 toasts', () => {
        const { getApi } = renderWithProvider();
        act(() => {
            for (let i = 1; i <= 7; i++) getApi().info(`toast-${i}`);
        });
        expect(getApi().toasts).toHaveLength(5);
        expect(screen.queryByText('toast-1')).not.toBeInTheDocument();
        expect(screen.queryByText('toast-2')).not.toBeInTheDocument();
        expect(screen.getByText('toast-3')).toBeInTheDocument();
        expect(screen.getByText('toast-7')).toBeInTheDocument();
    });

    it('removes a toast on request', () => {
        const { getApi } = renderWithProvider();
        act(() => { getApi().info('temporary'); });
        const id = getApi().toasts[0].id;
        act(() => { getApi().removeToast(id); });
        expect(screen.queryByText('temporary')).not.toBeInTheDocument();
    });
});

describe('useToast outside a provider', () => {
    it('throws a named error rather than failing silently', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const Orphan: React.FC = () => { useToast(); return null; };
        expect(() => render(<Orphan />)).toThrow('useToast must be used within a ToastProvider');
    });
});
