
import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppwriteProject, Database, Collection, Bucket, AppwriteFunction } from '../types';
import { getSdkDatabases, getSdkStorage, getSdkFunctions, Query, handleFetchError } from '../services/appwrite';
import {
    type RealtimeEvent,
    type RealtimeConnectionStatus,
    matchesEvent,
} from '../services/realtimeService';

const CONTEXT_FETCH_LIMIT = 100;
const CONTEXT_POLL_INTERVAL_MS = 10_000; // 10 seconds

export function useAppContext(
    activeProject: AppwriteProject | null,
    logCallback: (log: string) => void,
    onRealtimeEvent?: (event: RealtimeEvent) => void,
) {
    const [databases, setDatabases] = useState<Database[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [buckets, setBuckets] = useState<Bucket[]>([]);
    const [functions, setFunctions] = useState<AppwriteFunction[]>([]);
    const [selectedDatabase, setSelectedDatabase] = useState<Database | null>(null);
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
    const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
    const [selectedFunction, setSelectedFunction] = useState<AppwriteFunction | null>(null);
    const [isContextLoading, setIsContextLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentProjectIdRef = useRef<string | null>(null);

    const resetContext = useCallback(() => {
        setDatabases([]);
        setCollections([]);
        setBuckets([]);
        setFunctions([]);
        setSelectedDatabase(null);
        setSelectedCollection(null);
        setSelectedBucket(null);
        setSelectedFunction(null);
        setError(null);
    }, []);

    useEffect(() => {
        if (activeProject?.$id !== currentProjectIdRef.current) {
            logCallback(`--- CONTEXT RESET: Project switched to ${activeProject?.name || 'None'} ---`);
            resetContext();
            currentProjectIdRef.current = activeProject?.$id || null;
        }
    }, [activeProject?.$id, resetContext, logCallback]);

    const refreshContextData = useCallback(async () => {
        if (!activeProject) {
            resetContext();
            return;
        }

        const currentPid = activeProject.$id;
        logCallback(`Connecting to Appwrite: ${activeProject.endpoint}...`);
        setIsContextLoading(true);
        setError(null);
        
        // Note: We do NOT clear setDatabases/setBuckets here anymore.
        // Clearing is handled by the useEffect above when the project ID changes.
        // Keeping data during a refresh (same project) prevents UI flashing.

        try {
            const projectDatabases = getSdkDatabases(activeProject);
            const projectStorage = getSdkStorage(activeProject);
            const projectFunctions = getSdkFunctions(activeProject);

            const [dbResponse, bucketResponse, funcResponse] = await Promise.all([
                projectDatabases.list([Query.limit(CONTEXT_FETCH_LIMIT)]),
                projectStorage.listBuckets([Query.limit(CONTEXT_FETCH_LIMIT)]),
                projectFunctions.list([Query.limit(CONTEXT_FETCH_LIMIT)])
            ]);

            if (currentPid !== currentProjectIdRef.current) return;

            setDatabases(dbResponse.databases);
            setBuckets(bucketResponse.buckets);
            setFunctions(funcResponse.functions as unknown as AppwriteFunction[]);

            logCallback(`Connection successful: Found ${dbResponse.databases.length} Databases, ${bucketResponse.buckets.length} Buckets.`);
        } catch (e) {
            const errorMessage = handleFetchError(e);
            if (currentPid === currentProjectIdRef.current) {
                setError(errorMessage);
                logCallback(`CONNECTION ERROR: ${errorMessage}`);
            }
        } finally {
            if (currentPid === currentProjectIdRef.current) {
                setIsContextLoading(false);
            }
        }
    }, [activeProject, logCallback, resetContext]);

    // Silent refresh — same as refreshContextData but doesn't set loading state or log
    // Used for polling and realtime-triggered refreshes to avoid UI flicker
    const silentRefreshContextData = useCallback(async () => {
        if (!activeProject) return;

        const currentPid = activeProject.$id;
        try {
            const projectDatabases = getSdkDatabases(activeProject);
            const projectStorage = getSdkStorage(activeProject);
            const projectFunctions = getSdkFunctions(activeProject);

            const [dbResponse, bucketResponse, funcResponse] = await Promise.all([
                projectDatabases.list([Query.limit(CONTEXT_FETCH_LIMIT)]),
                projectStorage.listBuckets([Query.limit(CONTEXT_FETCH_LIMIT)]),
                projectFunctions.list([Query.limit(CONTEXT_FETCH_LIMIT)])
            ]);

            if (currentPid !== currentProjectIdRef.current) return;

            setDatabases(dbResponse.databases);
            setBuckets(bucketResponse.buckets);
            setFunctions(funcResponse.functions as unknown as AppwriteFunction[]);
        } catch {
            // Silent — polling failures are expected (transient network issues)
        }
    }, [activeProject]);

    useEffect(() => {
        if (activeProject) {
            refreshContextData();
        }
    }, [activeProject?.$id, refreshContextData]);

    useEffect(() => {
        if (!selectedDatabase || !activeProject || activeProject.$id !== currentProjectIdRef.current) {
            setCollections([]);
            setSelectedCollection(null);
            return;
        }

        const currentPid = activeProject.$id;
        const currentDbId = selectedDatabase.$id;

        const fetchCollections = async () => {
            setIsContextLoading(true);
            try {
                const projectDatabases = getSdkDatabases(activeProject);
                const response = await projectDatabases.listCollections(currentDbId, [Query.limit(CONTEXT_FETCH_LIMIT)]);
                
                if (currentPid === currentProjectIdRef.current && currentDbId === selectedDatabase.$id) {
                    setCollections(response.collections);
                }
            } catch (e) {
                const errorMessage = handleFetchError(e);
                if (currentPid === currentProjectIdRef.current) {
                    logCallback(`ERROR fetching collections: ${errorMessage}`);
                    setCollections([]);
                }
            } finally {
                if (currentPid === currentProjectIdRef.current) {
                    setIsContextLoading(false);
                }
            }
        };

        fetchCollections();
    }, [selectedDatabase?.$id, activeProject?.$id, logCallback]);

    // ====================================================================
    // SMART POLLING — Periodically refresh context data in the background
    // ====================================================================

    useEffect(() => {
        if (!activeProject) return;

        const tick = () => {
            if (document.visibilityState === 'visible') {
                silentRefreshContextData();
            }
        };

        const timer = setInterval(tick, CONTEXT_POLL_INTERVAL_MS);

        // Also refresh when tab regains visibility
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                silentRefreshContextData();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [activeProject, silentRefreshContextData]);

    // ====================================================================
    // REALTIME EVENT HANDLING — Trigger immediate refresh on relevant events
    // ====================================================================

    // This is registered as a listener from the parent via useRealtime's event system.
    // We expose a handler that the parent can wire up.
    const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
        if (!activeProject) return;

        // Any database-level event (create/delete DB, create/delete collection)
        if (matchesEvent(event, 'databases')) {
            silentRefreshContextData();
        }

        // Any bucket-level event (create/delete bucket)
        if (matchesEvent(event, 'buckets')) {
            silentRefreshContextData();
        }

        // Forward the event to the parent if they want to handle it further
        onRealtimeEvent?.(event);
    }, [activeProject, silentRefreshContextData, onRealtimeEvent]);

    return {
        databases, collections, buckets, functions,
        selectedDatabase, selectedCollection, selectedBucket, selectedFunction,
        setSelectedDatabase, setSelectedCollection, setSelectedBucket, setSelectedFunction,
        isContextLoading, error, setError, refreshContextData,
        handleRealtimeEvent,
    };
}
