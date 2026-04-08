
import { useState, useEffect, useCallback, useRef } from 'react';
import { Query, handleFetchError } from '../../../services/appwrite';
import { getSdkDatabases, getSdkStorage, getSdkFunctions, getSdkUsers, getSdkTeams } from '../../../services/appwrite';
import type { AppwriteProject, Database, Bucket, AppwriteFunction, StudioTab } from '../../../types';
import type { Models } from 'node-appwrite';

export function useStudioData(activeProject: AppwriteProject, activeTab: StudioTab, logCallback: (msg: string) => void) {
    const [isLoading, setIsLoading] = useState(false);
    
    // -- Data States --
    const [users, setUsers] = useState<Models.User<any>[]>([]);
    const [teams, setTeams] = useState<Models.Team<any>[]>([]);
    
    // -- Drill Down States --
    const [selectedDb, setSelectedDb] = useState<Database | null>(null);
    const [selectedCollection, setSelectedCollection] = useState<Models.Collection | null>(null);
    const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
    const [selectedFunction, setSelectedFunction] = useState<AppwriteFunction | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<Models.Team<any> | null>(null);

    // -- Sub-resource Data States --
    const [collections, setCollections] = useState<Models.Collection[]>([]);
    const [documents, setDocuments] = useState<Models.Document[]>([]);
    const [attributes, setAttributes] = useState<any[]>([]);
    const [indexes, setIndexes] = useState<any[]>([]);
    const [files, setFiles] = useState<Models.File[]>([]);
    const [deployments, setDeployments] = useState<Models.Deployment[]>([]);
    const [executions, setExecutions] = useState<Models.Execution[]>([]);
    const [memberships, setMemberships] = useState<Models.Membership[]>([]);
    const [variables, setVariables] = useState<Models.Variable[]>([]);

    // -- Document Pagination State --
    const [documentPage, setDocumentPage] = useState(0);
    const [documentCursors, setDocumentCursors] = useState<(string | undefined)[]>([undefined]);
    const [documentsTotal, setDocumentsTotal] = useState(0);
    const [documentSearchQuery, setDocumentSearchQuery] = useState('');

    // -- Execution Pagination State --
    const [viewAllExecutions, setViewAllExecutions] = useState(false);
    const [executionPage, setExecutionPage] = useState(0);
    const [executionCursors, setExecutionCursors] = useState<(string | undefined)[]>([undefined]);
    const [executionsTotal, setExecutionsTotal] = useState(0);

    const lastProjectIdRef = useRef<string | null>(null);

    useEffect(() => {
        const projectId = activeProject?.$id;
        if (projectId !== lastProjectIdRef.current) {
            setUsers([]);
            setTeams([]);
            setSelectedDb(null);
            setSelectedCollection(null);
            setSelectedBucket(null);
            setSelectedFunction(null);
            setSelectedTeam(null);
            setCollections([]);
            setDocuments([]);
            setAttributes([]);
            setIndexes([]);
            setFiles([]);
            setDeployments([]);
            setExecutions([]);
            setMemberships([]);
            setVariables([]);
            
            // Reset pagination
            setDocumentPage(0);
            setDocumentCursors([undefined]);
            setDocumentsTotal(0);
            setDocumentSearchQuery('');
            setViewAllExecutions(false);
            setExecutionPage(0);
            setExecutionCursors([undefined]);
            setExecutionsTotal(0);

            lastProjectIdRef.current = projectId;
        }
    }, [activeProject?.$id]);

    const fetchUsers = useCallback(async () => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        setIsLoading(true);
        try {
            const sdk = getSdkUsers(activeProject);
            const res = await sdk.list([Query.limit(100), Query.orderDesc('$createdAt')]);
            if (currentPid === lastProjectIdRef.current) setUsers(res.users);
        } catch (e) { 
            logCallback(`Studio Error: ${handleFetchError(e)}`);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    const fetchTeams = useCallback(async () => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        setIsLoading(true);
        try {
            const sdk = getSdkTeams(activeProject);
            const res = await sdk.list([Query.limit(100), Query.orderDesc('$createdAt')]);
            if (currentPid === lastProjectIdRef.current) setTeams(res.teams);
        } catch (e) { 
            logCallback(`Studio Error: ${handleFetchError(e)}`);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    const fetchCollections = useCallback(async (dbId: string) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        setIsLoading(true);
        try {
            const sdk = getSdkDatabases(activeProject);
            const res = await sdk.listCollections(dbId, [Query.limit(100)]);
            if (currentPid === lastProjectIdRef.current) setCollections(res.collections);
        } catch (e) { 
            logCallback(`Studio Error: ${handleFetchError(e)}`);
            if (currentPid === lastProjectIdRef.current) setCollections([]);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    const fetchCollectionDetails = useCallback(async (dbId: string, collId: string) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        setIsLoading(true);
        try {
            const sdk = getSdkDatabases(activeProject);
            
            // Build document query with pagination + search
            const docQueries = [Query.limit(25), Query.orderDesc('$createdAt')];
            const currentCursor = documentCursors[documentPage];
            if (currentCursor) {
                docQueries.push(Query.cursorAfter(currentCursor));
            }
            if (documentSearchQuery.trim()) {
                docQueries.push(Query.search('$id', documentSearchQuery.trim()));
            }

            const [docs, coll] = await Promise.all([
                sdk.listDocuments(dbId, collId, docQueries),
                sdk.getCollection(dbId, collId)
            ]);
            if (currentPid === lastProjectIdRef.current) {
                setDocuments(docs.documents);
                setDocumentsTotal(docs.total);
                setAttributes((coll.attributes || []).map((a: any) => ({ ...a, $id: a.key })));
                setIndexes((coll.indexes || []).map((i: any) => ({ ...i, $id: i.key })));
            }
        } catch (e) { 
            logCallback(`Studio Error: ${handleFetchError(e)}`);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback, documentCursors, documentPage, documentSearchQuery]);

    // Document pagination controls
    const nextDocumentPage = useCallback(() => {
        if (documents.length === 0) return;
        const lastId = documents[documents.length - 1].$id;
        setDocumentCursors(prev => {
            const next = [...prev];
            if (next.length === documentPage + 1) {
                next.push(lastId);
            }
            return next;
        });
        setDocumentPage(p => p + 1);
    }, [documents, documentPage]);

    const prevDocumentPage = useCallback(() => {
        setDocumentPage(p => Math.max(0, p - 1));
    }, []);

    const resetDocumentPagination = useCallback(() => {
        setDocumentPage(0);
        setDocumentCursors([undefined]);
    }, []);

    const updateDocumentSearch = useCallback((query: string) => {
        setDocumentSearchQuery(query);
        setDocumentPage(0);
        setDocumentCursors([undefined]);
    }, []);

    const fetchFiles = useCallback(async (bucketId: string) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        setIsLoading(true);
        try {
            const sdk = getSdkStorage(activeProject);
            const res = await sdk.listFiles(bucketId, [Query.limit(100), Query.orderDesc('$createdAt')]);
            if (currentPid === lastProjectIdRef.current) setFiles(res.files);
        } catch (e) { 
            logCallback(`Studio Error: ${handleFetchError(e)}`);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    const fetchFunctionDetails = useCallback(async (funcId: string, silent: boolean = false) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        if (!silent) setIsLoading(true);
        try {
            const sdk = getSdkFunctions(activeProject);
            
            // Build execution query with pagination
            const execLimit = viewAllExecutions ? 25 : 20;
            const execQueries = [Query.limit(execLimit), Query.orderDesc('$createdAt')];
            const currentCursor = viewAllExecutions ? executionCursors[executionPage] : undefined;
            if (currentCursor) {
                execQueries.push(Query.cursorAfter(currentCursor));
            }

            const [deps, execs, vars] = await Promise.all([
                sdk.listDeployments(funcId, [Query.limit(50), Query.orderDesc('$createdAt')]),
                sdk.listExecutions(funcId, execQueries),
                sdk.listVariables(funcId),
            ]);
            if (currentPid === lastProjectIdRef.current) {
                setDeployments(deps.deployments);
                setExecutions(execs.executions);
                setExecutionsTotal(execs.total);
                setVariables(vars.variables);
            }
        } catch (e) { 
            if (!silent) logCallback(`Studio Error: ${handleFetchError(e)}`);
        } finally { 
            if (!silent && currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback, viewAllExecutions, executionCursors, executionPage]);

    // Pagination Controls
    const toggleViewAllExecutions = useCallback(() => {
        setViewAllExecutions(prev => !prev);
        setExecutionPage(0);
        setExecutionCursors([undefined]);
    }, []);

    const nextExecutionPage = useCallback(() => {
        if (executions.length === 0) return;
        const lastId = executions[executions.length - 1].$id;
        
        setExecutionCursors(prev => {
            const next = [...prev];
            // Only add if not already there to prevent dupes in weird race cases
            if (next.length === executionPage + 1) {
                next.push(lastId);
            }
            return next;
        });
        setExecutionPage(p => p + 1);
    }, [executions, executionPage]);

    const prevExecutionPage = useCallback(() => {
        setExecutionPage(p => Math.max(0, p - 1));
    }, []);

    const fetchMemberships = useCallback(async (teamId: string) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        setIsLoading(true);
        try {
            const sdk = getSdkTeams(activeProject);
            const res = await sdk.listMemberships(teamId);
            if (currentPid === lastProjectIdRef.current) setMemberships(res.memberships);
        } catch (e) { 
            logCallback(`Studio Error: ${handleFetchError(e)}`);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    /**
     * Intelligently refreshes the current active view.
     */
    const refreshCurrentView = useCallback(async () => {
        if (!activeProject) return;
        
        logCallback(`Studio: Refreshing ${activeTab} view...`);

        switch (activeTab) {
            case 'overview':
                await Promise.all([fetchUsers(), fetchTeams()]);
                break;
            case 'database':
                if (selectedCollection && selectedDb) {
                    await fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
                } else if (selectedDb) {
                    await fetchCollections(selectedDb.$id);
                }
                break;
            case 'storage':
                if (selectedBucket) {
                    await fetchFiles(selectedBucket.$id);
                }
                break;
            case 'functions':
                if (selectedFunction) {
                    await fetchFunctionDetails(selectedFunction.$id);
                }
                break;
            case 'users':
                await fetchUsers();
                break;
            case 'teams':
                if (selectedTeam) {
                    await fetchMemberships(selectedTeam.$id);
                } else {
                    await fetchTeams();
                }
                break;
            case 'backups':
                break;
        }
    }, [activeProject, activeTab, selectedDb, selectedCollection, selectedBucket, selectedFunction, selectedTeam, fetchUsers, fetchTeams, fetchCollections, fetchCollectionDetails, fetchFiles, fetchFunctionDetails, fetchMemberships, logCallback]);

    useEffect(() => {
        setSelectedDb(null);
        setSelectedCollection(null);
        setSelectedBucket(null);
        setSelectedFunction(null);
        setSelectedTeam(null);
        // Reset all pagination on tab change
        setViewAllExecutions(false);
        setExecutionPage(0);
        setExecutionCursors([undefined]);
        setDocumentPage(0);
        setDocumentCursors([undefined]);
        setDocumentsTotal(0);
        setDocumentSearchQuery('');
    }, [activeTab]);

    useEffect(() => { 
        if (activeProject && (activeTab === 'users' || activeTab === 'overview')) fetchUsers(); 
    }, [activeTab, activeProject?.$id, fetchUsers]);

    useEffect(() => { 
        if (activeProject && (activeTab === 'teams' || activeTab === 'overview')) fetchTeams(); 
    }, [activeTab, activeProject?.$id, fetchTeams]);

    useEffect(() => { 
        if (selectedDb && activeProject?.$id === lastProjectIdRef.current) fetchCollections(selectedDb.$id); 
    }, [selectedDb?.$id, fetchCollections, activeProject?.$id]);

    useEffect(() => { 
        if (selectedCollection && selectedDb && activeProject?.$id === lastProjectIdRef.current) fetchCollectionDetails(selectedDb.$id, selectedCollection.$id); 
    }, [selectedCollection?.$id, selectedDb?.$id, fetchCollectionDetails, activeProject?.$id, documentPage, documentSearchQuery]);

    useEffect(() => { 
        if (selectedBucket && activeProject?.$id === lastProjectIdRef.current) fetchFiles(selectedBucket.$id); 
    }, [selectedBucket?.$id, fetchFiles, activeProject?.$id]);

    useEffect(() => { 
        if (selectedFunction && activeProject?.$id === lastProjectIdRef.current) fetchFunctionDetails(selectedFunction.$id); 
    }, [selectedFunction?.$id, fetchFunctionDetails, activeProject?.$id, executionPage, viewAllExecutions]);

    useEffect(() => { 
        if (selectedTeam && activeProject?.$id === lastProjectIdRef.current) fetchMemberships(selectedTeam.$id); 
    }, [selectedTeam?.$id, fetchMemberships, activeProject?.$id]);

    // Polling for function executions
    useEffect(() => {
        let interval: any;
        if (activeTab === 'functions' && selectedFunction && activeProject && !viewAllExecutions) {
            // Only poll if NOT in pagination mode
            interval = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    fetchFunctionDetails(selectedFunction.$id, true);
                }
            }, 2000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeTab, selectedFunction, activeProject, fetchFunctionDetails, viewAllExecutions]);

    return {
        isLoading,
        users, teams,
        selectedDb, setSelectedDb,
        selectedCollection, setSelectedCollection,
        selectedBucket, setSelectedBucket,
        selectedFunction, setSelectedFunction,
        selectedTeam, setSelectedTeam,
        collections, documents, attributes, indexes, files, deployments, executions, memberships, variables,
        fetchUsers, fetchTeams, fetchCollections, fetchCollectionDetails, fetchFiles, fetchFunctionDetails, fetchMemberships,
        refreshCurrentView,
        // Document pagination
        documentPage, nextDocumentPage, prevDocumentPage, documentsTotal, documentSearchQuery, updateDocumentSearch, resetDocumentPagination,
        // Execution pagination
        viewAllExecutions, toggleViewAllExecutions,
        executionPage, nextExecutionPage, prevExecutionPage, executionsTotal
    };
}
