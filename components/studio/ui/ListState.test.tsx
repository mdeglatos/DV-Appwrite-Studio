import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListState } from './ListState';
import { ResourceTable } from './ResourceTable';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('ListState', () => {
    it('shows progress — not the empty copy — while loading', () => {
        render(<ListState isLoading isEmpty />);
        expect(screen.getByText('Loading…')).toBeInTheDocument();
        expect(screen.queryByText('No items found.')).not.toBeInTheDocument();
    });

    it('lets loading win over an error, so a retry shows progress and not the stale failure', () => {
        render(<ListState isLoading isEmpty error="Missing scope" onRetry={vi.fn()} />);
        expect(screen.getByText('Loading…')).toBeInTheDocument();
        expect(screen.queryByText('Missing scope')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });

    it('shows the failure and a retry — never "No items found." — when the fetch failed', () => {
        render(<ListState isLoading={false} isEmpty error="user_unauthorized_scope" onRetry={vi.fn()} />);
        expect(screen.getByText('user_unauthorized_scope')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
        expect(screen.queryByText('No items found.')).not.toBeInTheDocument();
    });

    it('calls onRetry exactly once per click', () => {
        const onRetry = vi.fn();
        render(<ListState isLoading={false} isEmpty error="boom" onRetry={onRetry} />);
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('omits the retry button when no handler is given', () => {
        render(<ListState isLoading={false} isEmpty error="boom" />);
        expect(screen.getByText('boom')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    });

    it('shows the empty message when there is no data and no failure', () => {
        render(<ListState isLoading={false} isEmpty />);
        expect(screen.getByText('No items found.')).toBeInTheDocument();
    });

    it('honours a custom empty and loading message', () => {
        const { rerender } = render(<ListState isLoading={false} isEmpty emptyMessage="No webhooks registered." />);
        expect(screen.getByText('No webhooks registered.')).toBeInTheDocument();

        rerender(<ListState isLoading isEmpty loadingMessage="Loading webhooks…" />);
        expect(screen.getByText('Loading webhooks…')).toBeInTheDocument();
    });

    it('renders nothing once there is data', () => {
        const { container } = render(<ListState isLoading={false} isEmpty={false} />);
        expect(container).toBeEmptyDOMElement();
    });
});

/**
 * The regression these three states exist for: before `ResourceTable` learned
 * them, a 401 and an empty collection both rendered "No items found.".
 */
describe('ResourceTable list states', () => {
    it('shows the failure and a retry instead of "No items found."', () => {
        const onRetry = vi.fn();
        render(<ResourceTable data={[]} error="user_unauthorized_scope" onRetry={onRetry} />);

        expect(screen.getByText('user_unauthorized_scope')).toBeInTheDocument();
        expect(screen.queryByText('No items found.')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('shows progress while the first page is in flight', () => {
        render(<ResourceTable data={[]} isLoading />);
        expect(screen.getByText('Loading…')).toBeInTheDocument();
        expect(screen.queryByText('No items found.')).not.toBeInTheDocument();
    });

    it('is unchanged when no state props are passed', () => {
        render(<ResourceTable data={[]} />);
        expect(screen.getByText('No items found.')).toBeInTheDocument();
    });

    it('renders rows, and no list state, once there is data', () => {
        render(<ResourceTable data={[{ $id: 'row-1', name: 'First' }]} error="stale" />);
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.queryByText('stale')).not.toBeInTheDocument();
    });
});
