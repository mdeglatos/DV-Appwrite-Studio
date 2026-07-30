import React from 'react';
import { LoadingSpinnerIcon, WarningIcon } from '../../Icons';

/**
 * The single owner of "what a resource list renders when it isn't a list".
 *
 * A list is in exactly one of four states — loading, failed, empty, or populated —
 * and before this component every call site decided for itself, which is why a
 * failed fetch and an empty collection both read "No items found.".
 *
 * Branch order is **loading → error → empty → `null`**: a refresh must show
 * progress rather than the stale failure it is retrying.
 *
 * It deliberately emits **no** table markup, no width/layout class and no
 * `children` slot — callers wrap it in `<tr><td colSpan>` where a table needs it.
 * For the *project connection*'s status (a page-level concern, not a list's) use
 * `components/ErrorBanner.tsx` instead.
 */
export interface ListStateProps {
    isLoading: boolean;
    error?: string | null;
    isEmpty: boolean;
    /** Shown when there is no data and no failure. Default: 'No items found.' */
    emptyMessage?: string;
    /** Shown beside the spinner. Default: 'Loading…' */
    loadingMessage?: string;
    /** When given, the failed state offers a Retry button that calls this. */
    onRetry?: () => void;
}

export const ListState: React.FC<ListStateProps> = ({
    isLoading,
    error,
    isEmpty,
    emptyMessage = 'No items found.',
    loadingMessage = 'Loading…',
    onRetry,
}) => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <LoadingSpinnerIcon size={28} className="text-cyan-400 animate-spin" />
                <p className="text-gray-400 text-sm">{loadingMessage}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <WarningIcon size={32} />
                <p className="text-sm text-red-300 leading-relaxed max-w-md">{error}</p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="mt-1 px-5 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-xs font-bold text-gray-300 transition-all active:scale-95"
                    >
                        Retry
                    </button>
                )}
            </div>
        );
    }

    if (isEmpty) {
        return (
            <div className="px-6 py-12 text-center text-gray-500 italic">{emptyMessage}</div>
        );
    }

    return null;
};
