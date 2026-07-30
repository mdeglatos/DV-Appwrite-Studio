import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';

/**
 * The single owner of "refresh the current section".
 *
 * `useStudioData.refreshCurrentView()` only knows the seven sections whose data
 * it loads itself; the sections that fetch their own data used to be unreachable
 * from the Sync button and `Shift+R` — except `BackupsTab`, which had invented a
 * private `onRegisterRefresh` prop for exactly this. That prop is absorbed here.
 *
 * A self-loading panel calls `useRegisterSectionRefresh(itsRefetch)`; `Studio`
 * calls `useSectionRefreshRunner()` and runs every registered refresher.
 */

type Refresher = () => void | Promise<void>;

export interface SectionRefreshStore {
    register: (refresh: Refresher) => () => void;
    /** Runs every registered refresher; resolves when all settle. */
    runAll: () => Promise<void>;
}

const SectionRefreshContext = createContext<SectionRefreshStore | null>(null);

/**
 * Creates a registry. `Studio` uses this directly because it *renders* the
 * provider and so cannot read the context it supplies — it needs `runAll` for
 * the Sync button and the `Shift+R` handler. Panels use the hooks below.
 */
export function useSectionRefreshStore(): SectionRefreshStore {
    const refreshersRef = useRef<Set<Refresher>>(new Set());

    const register = useCallback((refresh: Refresher) => {
        refreshersRef.current.add(refresh);
        return () => { refreshersRef.current.delete(refresh); };
    }, []);

    const runAll = useCallback(async () => {
        await Promise.allSettled([...refreshersRef.current].map(refresh => refresh()));
    }, []);

    // Both members are stable, so the store never changes identity.
    const storeRef = useRef<SectionRefreshStore>({ register, runAll });
    return storeRef.current;
}

export const SectionRefreshProvider: React.FC<{
    children: React.ReactNode;
    /** Supply the store when the renderer also needs `runAll` (see `useSectionRefreshStore`). */
    store?: SectionRefreshStore;
}> = ({ children, store }) => {
    const ownStore = useSectionRefreshStore();

    return (
        <SectionRefreshContext.Provider value={store ?? ownStore}>
            {children}
        </SectionRefreshContext.Provider>
    );
};

function useSectionRefreshContext(hookName: string): SectionRefreshStore {
    const context = useContext(SectionRefreshContext);
    if (!context) {
        throw new Error(`${hookName} must be used within a SectionRefreshProvider`);
    }
    return context;
}

/** Registers `refresh` while the calling component is mounted. Must be stable (useCallback). */
export function useRegisterSectionRefresh(refresh: Refresher): void {
    const { register } = useSectionRefreshContext('useRegisterSectionRefresh');
    useEffect(() => register(refresh), [register, refresh]);
}

/** Runs every registered refresher; resolves when all settle. */
export function useSectionRefreshRunner(): () => Promise<void> {
    return useSectionRefreshContext('useSectionRefreshRunner').runAll;
}
