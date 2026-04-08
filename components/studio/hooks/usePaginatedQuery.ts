
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface PaginationConfig {
    /** Items per page. Default 25. */
    pageSize?: number;
    /** Default sort field. Default '$createdAt'. */
    defaultSort?: string;
    /** Default sort order. Default 'desc'. */
    defaultOrder?: 'asc' | 'desc';
    /** Debounce delay for search in ms. Default 300. */
    searchDebounceMs?: number;
    /** Whether this query is enabled (will fetch). Default true. */
    enabled?: boolean;
}

export interface FetchResult<T> {
    items: T[];
    total: number;
}

/**
 * A fetch function that receives Appwrite-style query strings
 * and returns { items, total }.
 */
export type PaginatedFetchFn<T> = (queries: string[]) => Promise<FetchResult<T>>;

export interface PaginatedState<T> {
    // Data
    items: T[];
    total: number;
    isLoading: boolean;
    error: string | null;

    // Current state
    page: number;
    pageSize: number;
    searchQuery: string;
    sortField: string;
    sortOrder: 'asc' | 'desc';

    // Navigation
    nextPage: () => void;
    prevPage: () => void;
    goToPage: (page: number) => void;
    setPageSize: (size: number) => void;
    setSearch: (query: string) => void;
    setSort: (field: string, order?: 'asc' | 'desc') => void;
    refresh: () => void;
    reset: () => void;

    // Computed
    hasNextPage: boolean;
    hasPrevPage: boolean;
    totalPages: number;
    pageInfo: string;
    rangeStart: number;
    rangeEnd: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Generic offset-based pagination hook for Appwrite resources.
 * 
 * @param fetchFn - Function that builds queries and fetches data. Receives assembled query strings.
 * @param config - Pagination configuration (page size, sort defaults, search debounce).
 * @param deps - Additional dependencies that should trigger a refetch when changed.
 */
export function usePaginatedQuery<T>(
    fetchFn: PaginatedFetchFn<T> | null,
    config: PaginationConfig = {},
    deps: any[] = []
): PaginatedState<T> {
    const {
        pageSize: defaultPageSize = 25,
        defaultSort = '$createdAt',
        defaultOrder = 'desc',
        searchDebounceMs = 300,
        enabled = true,
    } = config;

    // --- State ---
    const [items, setItems] = useState<T[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [page, setPage] = useState(0);
    const [pageSize, setPageSizeState] = useState(defaultPageSize);
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortField, setSortField] = useState(defaultSort);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultOrder);

    // --- Refs ---
    const fetchIdRef = useRef(0); // For race condition prevention
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // --- Search Debounce ---
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
        }, searchDebounceMs);
        return () => clearTimeout(timer);
    }, [searchInput, searchDebounceMs]);

    // Reset page when search/sort/pageSize changes
    useEffect(() => {
        setPage(0);
    }, [debouncedSearch, sortField, sortOrder, pageSize]);

    // --- Core Fetch ---
    const executeFetch = useCallback(async () => {
        if (!fetchFn || !enabled) {
            setItems([]);
            setTotal(0);
            return;
        }

        const currentFetchId = ++fetchIdRef.current;
        setIsLoading(true);
        setError(null);

        try {
            // Build query array
            const queries: string[] = [];

            // Pagination
            queries.push(`limit(${pageSize})`);
            const offset = page * pageSize;
            if (offset > 0) {
                queries.push(`offset(${offset})`);
            }

            // Sort
            if (sortOrder === 'desc') {
                queries.push(`orderDesc("${sortField}")`);
            } else {
                queries.push(`orderAsc("${sortField}")`);
            }

            // Search is handled by the fetchFn itself (it knows the search fields)
            // We pass the debounced search as a special entry the consumer can parse
            if (debouncedSearch.trim()) {
                queries.push(`__search__:${debouncedSearch.trim()}`);
            }

            const result = await fetchFn(queries);

            // Only update if this is still the latest fetch
            if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
                setItems(result.items);
                setTotal(result.total);
            }
        } catch (err: any) {
            if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
                setError(err?.message || 'Fetch failed');
                setItems([]);
                setTotal(0);
            }
        } finally {
            if (currentFetchId === fetchIdRef.current && isMountedRef.current) {
                setIsLoading(false);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchFn, enabled, page, pageSize, sortField, sortOrder, debouncedSearch, ...deps]);

    // Trigger fetch on any dependency change
    useEffect(() => {
        executeFetch();
    }, [executeFetch]);

    // --- Controls ---
    const nextPage = useCallback(() => {
        setPage(p => {
            const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
            return Math.min(p + 1, maxPage);
        });
    }, [total, pageSize]);

    const prevPage = useCallback(() => {
        setPage(p => Math.max(0, p - 1));
    }, []);

    const goToPage = useCallback((targetPage: number) => {
        setPage(Math.max(0, targetPage));
    }, []);

    const setPageSize = useCallback((size: number) => {
        setPageSizeState(size);
    }, []);

    const setSearch = useCallback((query: string) => {
        setSearchInput(query);
    }, []);

    const setSort = useCallback((field: string, order?: 'asc' | 'desc') => {
        setSortField(field);
        if (order) setSortOrder(order);
    }, []);

    const refresh = useCallback(() => {
        executeFetch();
    }, [executeFetch]);

    const reset = useCallback(() => {
        setPage(0);
        setSearchInput('');
        setDebouncedSearch('');
        setSortField(defaultSort);
        setSortOrder(defaultOrder);
        setPageSizeState(defaultPageSize);
    }, [defaultSort, defaultOrder, defaultPageSize]);

    // --- Computed ---
    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
    const hasNextPage = page < totalPages - 1;
    const hasPrevPage = page > 0;
    const rangeStart = total === 0 ? 0 : page * pageSize + 1;
    const rangeEnd = Math.min((page + 1) * pageSize, total);
    const pageInfo = total === 0
        ? 'No items'
        : `${rangeStart}–${rangeEnd} of ${total.toLocaleString()}`;

    return {
        items,
        total,
        isLoading,
        error,
        page,
        pageSize,
        searchQuery: searchInput,
        sortField,
        sortOrder,
        nextPage,
        prevPage,
        goToPage,
        setPageSize,
        setSearch,
        setSort,
        refresh,
        reset,
        hasNextPage,
        hasPrevPage,
        totalPages,
        pageInfo,
        rangeStart,
        rangeEnd,
    };
}

// ============================================================================
// Query Builder Utility
// ============================================================================

/**
 * Parses the query array built by usePaginatedQuery and extracts
 * standard Appwrite queries vs the special __search__ marker.
 * 
 * Use this inside your fetchFn to separate pagination queries from search.
 */
export function parseQueryArray(queries: string[]): { appwriteQueries: string[]; searchTerm: string } {
    const appwriteQueries: string[] = [];
    let searchTerm = '';

    for (const q of queries) {
        if (q.startsWith('__search__:')) {
            searchTerm = q.slice('__search__:'.length);
        } else {
            appwriteQueries.push(q);
        }
    }

    return { appwriteQueries, searchTerm };
}
