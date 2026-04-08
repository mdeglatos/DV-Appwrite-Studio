
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Query, handleFetchError } from '../../../services/appwrite';
import { getSdkDatabases, getSdkStorage, getSdkFunctions, getSdkUsers, getSdkTeams, getSdkSites } from '../../../services/appwrite';
import type { AppwriteProject, Database, Bucket, AppwriteFunction, AppwriteSite, StudioTab } from '../../../types';
import type { Models } from 'node-appwrite';
import { usePaginatedQuery, type PaginatedFetchFn, type PaginatedState } from './usePaginatedQuery';

// ============================================================================
// Helper: Build Appwrite Query array from usePaginatedQuery's raw query strings
// ============================================================================

function buildQueries(rawQueries: string[], searchFields?: string[]): string[] {
    const appwriteQueries: string[] = [];
    let searchTerm = '';

    for (const q of rawQueries) {
        if (q.startsWith('__search__:')) {
            searchTerm = q.slice('__search__:'.length);
        } else if (q.startsWith('limit(')) {
            const n = parseInt(q.match(/\d+/)?.[0] || '25');
            appwriteQueries.push(Query.limit(n));
        } else if (q.startsWith('offset(')) {
            const n = parseInt(q.match(/\d+/)?.[0] || '0');
            appwriteQueries.push(Query.offset(n));
        } else if (q.startsWith('orderDesc(')) {
            const field = q.match(/"([^"]+)"/)?.[1] || '$createdAt';
            appwriteQueries.push(Query.orderDesc(field));
        } else if (q.startsWith('orderAsc(')) {
            const field = q.match(/"([^"]+)"/)?.[1] || '$createdAt';
            appwriteQueries.push(Query.orderAsc(field));
        }
    }

    // Add search — use the first search field for Query.search (requires fulltext index)
    // For resources without fulltext indexes, we use Query.contains or Query.startsWith
    if (searchTerm && searchFields && searchFields.length > 0) {
        // Try search on first field; if that field doesn't have an index it will be caught by the caller
        appwriteQueries.push(Query.search(searchFields[0], searchTerm));
    }

    return appwriteQueries;
}

/**
 * Same as buildQueries but returns search term separately for client-side filtering.
 * Used when Appwrite doesn't support server-side search for a resource (e.g., users, teams).
 */
function buildQueriesWithClientSearch(rawQueries: string[]): { queries: string[]; searchTerm: string } {
    const queries: string[] = [];
    let searchTerm = '';

    for (const q of rawQueries) {
        if (q.startsWith('__search__:')) {
            searchTerm = q.slice('__search__:'.length);
        } else if (q.startsWith('limit(')) {
            const n = parseInt(q.match(/\d+/)?.[0] || '25');
            queries.push(Query.limit(n));
        } else if (q.startsWith('offset(')) {
            const n = parseInt(q.match(/\d+/)?.[0] || '0');
            queries.push(Query.offset(n));
        } else if (q.startsWith('orderDesc(')) {
            const field = q.match(/"([^"]+)"/)?.[1] || '$createdAt';
            queries.push(Query.orderDesc(field));
        } else if (q.startsWith('orderAsc(')) {
            const field = q.match(/"([^"]+)"/)?.[1] || '$createdAt';
            queries.push(Query.orderAsc(field));
        }
    }

    return { queries, searchTerm };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useStudioData(activeProject: AppwriteProject, activeTab: StudioTab, logCallback: (msg: string) => void) {
    // -- Drill-down selection states --
    const [selectedDb, setSelectedDb] = useState<Database | null>(null);
    const [selectedCollection, setSelectedCollection] = useState<Models.Collection | null>(null);
    const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
    const [selectedFunction, setSelectedFunction] = useState<AppwriteFunction | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<Models.Team<any> | null>(null);
    const [selectedSite, setSelectedSite] = useState<AppwriteSite | null>(null);

    // -- Non-paginated sub-resource states (loaded in full) --
    const [attributes, setAttributes] = useState<any[]>([]);
    const [indexes, setIndexes] = useState<any[]>([]);
    const [variables, setVariables] = useState<Models.Variable[]>([]);
    const [siteVariables, setSiteVariables] = useState<Models.Variable[]>([]);

    const lastProjectIdRef = useRef<string | null>(null);

    // ========================================================================
    // PAGINATED FETCH FUNCTIONS
    // Each returns a stable fetchFn or null when disabled.
    // ========================================================================

    const usersFetchFn = useMemo<PaginatedFetchFn<Models.User<any>> | null>(() => {
        if (!activeProject || (activeTab !== 'users' && activeTab !== 'overview')) return null;
        return async (rawQueries) => {
            const { queries, searchTerm } = buildQueriesWithClientSearch(rawQueries);
            const sdk = getSdkUsers(activeProject);
            // Users API: search is done server-side via Query.search on 'name' or 'email'
            if (searchTerm) {
                // Appwrite users.list supports search param directly
                queries.push(Query.search('name', searchTerm));
            }
            const res = await sdk.list(queries);
            return { items: res.users, total: res.total };
        };
    }, [activeProject, activeTab]);

    const teamsFetchFn = useMemo<PaginatedFetchFn<Models.Team<any>> | null>(() => {
        if (!activeProject || (activeTab !== 'teams' && activeTab !== 'overview')) return null;
        return async (rawQueries) => {
            const { queries, searchTerm } = buildQueriesWithClientSearch(rawQueries);
            const sdk = getSdkTeams(activeProject);
            if (searchTerm) {
                queries.push(Query.search('name', searchTerm));
            }
            const res = await sdk.list(queries);
            return { items: res.teams, total: res.total };
        };
    }, [activeProject, activeTab]);

    const collectionsFetchFn = useMemo<PaginatedFetchFn<Models.Collection> | null>(() => {
        if (!activeProject || !selectedDb || activeTab !== 'database') return null;
        const dbId = selectedDb.$id;
        return async (rawQueries) => {
            const { queries, searchTerm } = buildQueriesWithClientSearch(rawQueries);
            const sdk = getSdkDatabases(activeProject);
            if (searchTerm) {
                queries.push(Query.search('name', searchTerm));
            }
            const res = await sdk.listCollections(dbId, queries);
            return { items: res.collections, total: res.total };
        };
    }, [activeProject, selectedDb, activeTab]);

    const documentsFetchFn = useMemo<PaginatedFetchFn<Models.Document> | null>(() => {
        if (!activeProject || !selectedDb || !selectedCollection || activeTab !== 'database') return null;
        const dbId = selectedDb.$id;
        const collId = selectedCollection.$id;
        return async (rawQueries) => {
            const queries = buildQueries(rawQueries);
            const sdk = getSdkDatabases(activeProject);
            const res = await sdk.listDocuments(dbId, collId, queries);
            return { items: res.documents, total: res.total };
        };
    }, [activeProject, selectedDb, selectedCollection, activeTab]);

    const filesFetchFn = useMemo<PaginatedFetchFn<Models.File> | null>(() => {
        if (!activeProject || !selectedBucket || activeTab !== 'storage') return null;
        const bucketId = selectedBucket.$id;
        return async (rawQueries) => {
            const { queries, searchTerm } = buildQueriesWithClientSearch(rawQueries);
            const sdk = getSdkStorage(activeProject);
            if (searchTerm) {
                queries.push(Query.search('name', searchTerm));
            }
            const res = await sdk.listFiles(bucketId, queries);
            return { items: res.files, total: res.total };
        };
    }, [activeProject, selectedBucket, activeTab]);

    const deploymentsFetchFn = useMemo<PaginatedFetchFn<Models.Deployment> | null>(() => {
        if (!activeProject || !selectedFunction || activeTab !== 'functions') return null;
        const funcId = selectedFunction.$id;
        return async (rawQueries) => {
            const queries = buildQueries(rawQueries);
            const sdk = getSdkFunctions(activeProject);
            const res = await sdk.listDeployments(funcId, queries);
            return { items: res.deployments, total: res.total };
        };
    }, [activeProject, selectedFunction, activeTab]);

    const executionsFetchFn = useMemo<PaginatedFetchFn<Models.Execution> | null>(() => {
        if (!activeProject || !selectedFunction || activeTab !== 'functions') return null;
        const funcId = selectedFunction.$id;
        return async (rawQueries) => {
            const queries = buildQueries(rawQueries);
            const sdk = getSdkFunctions(activeProject);
            const res = await sdk.listExecutions(funcId, queries);
            return { items: res.executions, total: res.total };
        };
    }, [activeProject, selectedFunction, activeTab]);

    const membershipsFetchFn = useMemo<PaginatedFetchFn<Models.Membership> | null>(() => {
        if (!activeProject || !selectedTeam || activeTab !== 'teams') return null;
        const teamId = selectedTeam.$id;
        return async (rawQueries) => {
            const { queries, searchTerm } = buildQueriesWithClientSearch(rawQueries);
            const sdk = getSdkTeams(activeProject);
            if (searchTerm) {
                queries.push(Query.search('userName', searchTerm));
            }
            const res = await sdk.listMemberships(teamId, queries);
            return { items: res.memberships, total: res.total };
        };
    }, [activeProject, selectedTeam, activeTab]);

    // -- Sites --
    const sitesFetchFn = useMemo<PaginatedFetchFn<AppwriteSite> | null>(() => {
        if (!activeProject || (activeTab !== 'sites' && activeTab !== 'overview')) return null;
        return async (rawQueries) => {
            const { queries, searchTerm } = buildQueriesWithClientSearch(rawQueries);
            const sdk = getSdkSites(activeProject);
            const res = await sdk.list(queries, searchTerm || undefined);
            return { items: res.sites as unknown as AppwriteSite[], total: res.total };
        };
    }, [activeProject, activeTab]);

    const siteDeploymentsFetchFn = useMemo<PaginatedFetchFn<Models.Deployment> | null>(() => {
        if (!activeProject || !selectedSite || activeTab !== 'sites') return null;
        const siteId = selectedSite.$id;
        return async (rawQueries) => {
            const queries = buildQueries(rawQueries);
            const sdk = getSdkSites(activeProject);
            const res = await sdk.listDeployments(siteId, queries);
            return { items: res.deployments, total: res.total };
        };
    }, [activeProject, selectedSite, activeTab]);

    const siteLogsFetchFn = useMemo<PaginatedFetchFn<Models.Execution> | null>(() => {
        if (!activeProject || !selectedSite || activeTab !== 'sites') return null;
        const siteId = selectedSite.$id;
        return async (rawQueries) => {
            const queries = buildQueries(rawQueries);
            const sdk = getSdkSites(activeProject);
            const res = await sdk.listLogs(siteId, queries);
            return { items: (res as any).logs ?? (res as any).executions ?? [], total: res.total };
        };
    }, [activeProject, selectedSite, activeTab]);

    // ========================================================================
    // PAGINATED QUERY INSTANCES
    // ========================================================================

    const usersPagination = usePaginatedQuery(usersFetchFn, { pageSize: 25 });
    const teamsPagination = usePaginatedQuery(teamsFetchFn, { pageSize: 25 });
    const collectionsPagination = usePaginatedQuery(collectionsFetchFn, { pageSize: 25 });
    const documentsPagination = usePaginatedQuery(documentsFetchFn, { pageSize: 25 });
    const filesPagination = usePaginatedQuery(filesFetchFn, { pageSize: 25 });
    const deploymentsPagination = usePaginatedQuery(deploymentsFetchFn, { pageSize: 25 });
    const executionsPagination = usePaginatedQuery(executionsFetchFn, { pageSize: 25 });
    const membershipsPagination = usePaginatedQuery(membershipsFetchFn, { pageSize: 25 });
    const sitesPagination = usePaginatedQuery(sitesFetchFn, { pageSize: 25 });
    const siteDeploymentsPagination = usePaginatedQuery(siteDeploymentsFetchFn, { pageSize: 25 });
    const siteLogsPagination = usePaginatedQuery(siteLogsFetchFn, { pageSize: 25 });

    // ========================================================================
    // COLLECTION DETAILS (attributes + indexes — not paginated)
    // ========================================================================

    const fetchCollectionMeta = useCallback(async (dbId: string, collId: string) => {
        if (!activeProject) return;
        try {
            const sdk = getSdkDatabases(activeProject);
            const coll = await sdk.getCollection(dbId, collId);
            setAttributes((coll.attributes || []).map((a: any) => ({ ...a, $id: a.key })));
            setIndexes((coll.indexes || []).map((i: any) => ({ ...i, $id: i.key })));
        } catch (e) {
            logCallback(`Studio Error: ${handleFetchError(e)}`);
        }
    }, [activeProject, logCallback]);

    // Fetch collection meta when collection is selected
    useEffect(() => {
        if (selectedCollection && selectedDb) {
            fetchCollectionMeta(selectedDb.$id, selectedCollection.$id);
        } else {
            setAttributes([]);
            setIndexes([]);
        }
    }, [selectedCollection?.$id, selectedDb?.$id, fetchCollectionMeta]);

    // ========================================================================
    // VARIABLES (per-function — not paginated, loaded in full)
    // ========================================================================

    const fetchVariables = useCallback(async (funcId: string) => {
        if (!activeProject) return;
        try {
            const sdk = getSdkFunctions(activeProject);
            const res = await sdk.listVariables(funcId);
            setVariables(res.variables);
        } catch (e) {
            logCallback(`Studio Error: ${handleFetchError(e)}`);
        }
    }, [activeProject, logCallback]);

    useEffect(() => {
        if (selectedFunction && activeTab === 'functions') {
            fetchVariables(selectedFunction.$id);
        } else {
            setVariables([]);
        }
    }, [selectedFunction?.$id, activeTab, fetchVariables]);

    // ========================================================================
    // SITE VARIABLES (per-site — not paginated, loaded in full)
    // ========================================================================

    const fetchSiteVariables = useCallback(async (siteId: string) => {
        if (!activeProject) return;
        try {
            const sdk = getSdkSites(activeProject);
            const res = await sdk.listVariables(siteId);
            setSiteVariables(res.variables);
        } catch (e) {
            logCallback(`Studio Error: ${handleFetchError(e)}`);
        }
    }, [activeProject, logCallback]);

    useEffect(() => {
        if (selectedSite && activeTab === 'sites') {
            fetchSiteVariables(selectedSite.$id);
        } else {
            setSiteVariables([]);
        }
    }, [selectedSite?.$id, activeTab, fetchSiteVariables]);

    // ========================================================================
    // RESET ON TAB CHANGE
    // ========================================================================

    useEffect(() => {
        setSelectedDb(null);
        setSelectedCollection(null);
        setSelectedBucket(null);
        setSelectedFunction(null);
        setSelectedTeam(null);
        setSelectedSite(null);
        setAttributes([]);
        setIndexes([]);
        setVariables([]);
        setSiteVariables([]);
    }, [activeTab]);

    // ========================================================================
    // RESET ON PROJECT CHANGE
    // ========================================================================

    useEffect(() => {
        const projectId = activeProject?.$id;
        if (projectId !== lastProjectIdRef.current) {
            setSelectedDb(null);
            setSelectedCollection(null);
            setSelectedBucket(null);
            setSelectedFunction(null);
            setSelectedTeam(null);
            setSelectedSite(null);
            setAttributes([]);
            setIndexes([]);
            setVariables([]);
            setSiteVariables([]);
            lastProjectIdRef.current = projectId;
        }
    }, [activeProject?.$id]);

    // ========================================================================
    // EXECUTION POLLING (live feed when function is selected)
    // ========================================================================

    useEffect(() => {
        let interval: any;
        if (activeTab === 'functions' && selectedFunction && activeProject) {
            interval = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    executionsPagination.refresh();
                }
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab, selectedFunction, activeProject, executionsPagination.refresh]);

    // ========================================================================
    // REFRESH CURRENT VIEW
    // ========================================================================

    const refreshCurrentView = useCallback(async () => {
        logCallback(`Studio: Refreshing ${activeTab} view...`);

        switch (activeTab) {
            case 'overview':
                usersPagination.refresh();
                teamsPagination.refresh();
                break;
            case 'database':
                if (selectedCollection && selectedDb) {
                    documentsPagination.refresh();
                    fetchCollectionMeta(selectedDb.$id, selectedCollection.$id);
                } else if (selectedDb) {
                    collectionsPagination.refresh();
                }
                break;
            case 'storage':
                if (selectedBucket) {
                    filesPagination.refresh();
                }
                break;
            case 'functions':
                if (selectedFunction) {
                    deploymentsPagination.refresh();
                    executionsPagination.refresh();
                    fetchVariables(selectedFunction.$id);
                }
                break;
            case 'users':
                usersPagination.refresh();
                break;
            case 'teams':
                if (selectedTeam) {
                    membershipsPagination.refresh();
                } else {
                    teamsPagination.refresh();
                }
                break;
            case 'sites':
                if (selectedSite) {
                    siteDeploymentsPagination.refresh();
                    siteLogsPagination.refresh();
                    fetchSiteVariables(selectedSite.$id);
                } else {
                    sitesPagination.refresh();
                }
                break;
        }
    }, [activeTab, selectedDb, selectedCollection, selectedBucket, selectedFunction, selectedTeam, selectedSite,
        usersPagination, teamsPagination, collectionsPagination, documentsPagination,
        filesPagination, deploymentsPagination, executionsPagination, membershipsPagination,
        sitesPagination, siteDeploymentsPagination, siteLogsPagination,
        fetchCollectionMeta, fetchVariables, fetchSiteVariables, logCallback]);

    // ========================================================================
    // COMBINED LOADING STATE
    // ========================================================================

    const isLoading = usersPagination.isLoading || teamsPagination.isLoading ||
        collectionsPagination.isLoading || documentsPagination.isLoading ||
        filesPagination.isLoading || deploymentsPagination.isLoading ||
        executionsPagination.isLoading || membershipsPagination.isLoading ||
        sitesPagination.isLoading || siteDeploymentsPagination.isLoading || siteLogsPagination.isLoading;

    // ========================================================================
    // RETURN
    // ========================================================================

    return {
        isLoading,

        // Selection
        selectedDb, setSelectedDb,
        selectedCollection, setSelectedCollection,
        selectedBucket, setSelectedBucket,
        selectedFunction, setSelectedFunction,
        selectedTeam, setSelectedTeam,
        selectedSite, setSelectedSite,

        // Non-paginated sub-resources
        attributes, indexes, variables, siteVariables,
        fetchCollectionMeta, fetchVariables, fetchSiteVariables,

        // Paginated resources
        usersPagination,
        teamsPagination,
        collectionsPagination,
        documentsPagination,
        filesPagination,
        deploymentsPagination,
        executionsPagination,
        membershipsPagination,
        sitesPagination,
        siteDeploymentsPagination,
        siteLogsPagination,

        // Refresh
        refreshCurrentView,
    };
}
