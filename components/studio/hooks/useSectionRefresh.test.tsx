import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import {
    SectionRefreshProvider,
    useRegisterSectionRefresh,
    useSectionRefreshRunner,
    useSectionRefreshStore,
} from './useSectionRefresh';

/** A self-loading panel: registers its own re-fetch for as long as it is mounted. */
function Panel({ refresh }: { refresh: () => void }) {
    useRegisterSectionRefresh(React.useCallback(refresh, [refresh]));
    return null;
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('SectionRefreshProvider', () => {
    it('runs a registered refresher when the runner fires', async () => {
        const refresh = vi.fn();
        const store = { current: null as null | (() => Promise<void>) };

        function Runner() {
            store.current = useSectionRefreshRunner();
            return null;
        }

        render(
            <SectionRefreshProvider>
                <Panel refresh={refresh} />
                <Runner />
            </SectionRefreshProvider>
        );

        expect(refresh).not.toHaveBeenCalled();
        await act(async () => { await store.current!(); });
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('stops running a refresher after its panel unmounts', async () => {
        const refresh = vi.fn();
        const store = { current: null as null | (() => Promise<void>) };

        function Runner() {
            store.current = useSectionRefreshRunner();
            return null;
        }

        function Tree({ mounted }: { mounted: boolean }) {
            return (
                <SectionRefreshProvider>
                    {mounted && <Panel refresh={refresh} />}
                    <Runner />
                </SectionRefreshProvider>
            );
        }

        const view = render(<Tree mounted />);
        await act(async () => { await store.current!(); });
        expect(refresh).toHaveBeenCalledTimes(1);

        await act(async () => { view.rerender(<Tree mounted={false} />); });
        await act(async () => { await store.current!(); });
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('runs every registered refresher, and settles even when one rejects', async () => {
        const ok = vi.fn();
        const boom = vi.fn(() => Promise.reject(new Error('nope')));
        const store = { current: null as null | (() => Promise<void>) };

        function Runner() {
            store.current = useSectionRefreshRunner();
            return null;
        }

        render(
            <SectionRefreshProvider>
                <Panel refresh={boom} />
                <Panel refresh={ok} />
                <Runner />
            </SectionRefreshProvider>
        );

        await act(async () => { await expect(store.current!()).resolves.toBeUndefined(); });
        expect(boom).toHaveBeenCalledTimes(1);
        expect(ok).toHaveBeenCalledTimes(1);
    });

    it('lets the renderer supply the store, so it can run the refreshers it provides', async () => {
        const refresh = vi.fn();
        let runAll: (() => Promise<void>) | null = null;

        function Studio() {
            const store = useSectionRefreshStore();
            runAll = store.runAll;
            return (
                <SectionRefreshProvider store={store}>
                    <Panel refresh={refresh} />
                </SectionRefreshProvider>
            );
        }

        render(<Studio />);
        await act(async () => { await runAll!(); });
        expect(refresh).toHaveBeenCalledTimes(1);
    });
});

describe('the section-refresh hooks outside a provider', () => {
    it('throw a named error rather than failing silently', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const OrphanPanel: React.FC = () => { useRegisterSectionRefresh(() => {}); return null; };
        expect(() => render(<OrphanPanel />))
            .toThrow('useRegisterSectionRefresh must be used within a SectionRefreshProvider');

        const OrphanRunner: React.FC = () => { useSectionRefreshRunner(); return null; };
        expect(() => render(<OrphanRunner />))
            .toThrow('useSectionRefreshRunner must be used within a SectionRefreshProvider');
    });
});
