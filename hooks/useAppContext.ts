
import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppwriteProject, Database, Collection, Bucket, AppwriteFunction } from '../types';
import { getSdkDatabases, getSdkStorage, getSdkFunctions, Query, handleFetchError } from '../services/appwrite';

const CONTEXT_FETCH_LIMIT = 100;

export function useAppContext(activeProject: AppwriteProject | null, logCallback: (log: string) => void) {
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

            logCallback(`Connection successful: Found ${dbResponse.databases.length} Databases.`);
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

    return {
        databases, collections, buckets, functions,
        selectedDatabase, selectedCollection, selectedBucket, selectedFunction,
        setSelectedDatabase, setSelectedCollection, setSelectedBucket, setSelectedFunction,
        isContextLoading, error, setError, refreshContextData,
    };
}
