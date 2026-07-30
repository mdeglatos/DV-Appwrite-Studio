import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmProvider, useConfirm } from './useConfirm';

function Harness({ onResult, label = 'ask' }: { onResult: (v: boolean) => void; label?: string }) {
    const confirm = useConfirm();
    return (
        <button onClick={async () => onResult(await confirm({ title: 'Delete Thing?', message: 'This is permanent.' }))}>
            {label}
        </button>
    );
}

function renderHarness() {
    const onResult = vi.fn();
    render(
        <ConfirmProvider>
            <Harness onResult={onResult} />
        </ConfirmProvider>
    );
    return onResult;
}

describe('useConfirm', () => {
    it('shows the dialog with the requested title and message', async () => {
        renderHarness();
        fireEvent.click(screen.getByText('ask'));
        expect(await screen.findByText('Delete Thing?')).toBeInTheDocument();
        expect(screen.getByText('This is permanent.')).toBeInTheDocument();
    });

    it('resolves true when confirmed', async () => {
        const onResult = renderHarness();
        fireEvent.click(screen.getByText('ask'));
        fireEvent.click(await screen.findByText('Confirm'));
        await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('resolves false when cancelled', async () => {
        const onResult = renderHarness();
        fireEvent.click(screen.getByText('ask'));
        fireEvent.click(await screen.findByText('Cancel'));
        await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('resolves false on Escape', async () => {
        const onResult = renderHarness();
        fireEvent.click(screen.getByText('ask'));
        await screen.findByRole('dialog');
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps exactly one dialog in the tree when a second request arrives', async () => {
        const onResult = vi.fn();
        render(
            <ConfirmProvider>
                <Harness onResult={onResult} label="ask-a" />
                <Harness onResult={onResult} label="ask-b" />
            </ConfirmProvider>
        );

        fireEvent.click(screen.getByText('ask-a'));
        await screen.findByRole('dialog');
        fireEvent.click(screen.getByText('ask-b'));
        await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));

        // The superseded request must not be left dangling.
        await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
        expect(onResult).toHaveBeenCalledTimes(1);
    });
});

describe('useConfirm outside a provider', () => {
    it('throws a named error rather than failing silently', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const Orphan: React.FC = () => { useConfirm(); return null; };
        expect(() => render(<Orphan />)).toThrow('useConfirm must be used within a ConfirmProvider');
    });
});
