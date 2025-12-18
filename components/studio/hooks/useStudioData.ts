
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

    // Tracker for latest project ID to prevent race conditions and stale ID fetches
    const lastProjectIdRef = useRef<string | null>(null);

    // -- Global Project Reset (Triggered on Project Switch) --
    useEffect(() => {
        const projectId = activeProject?.$id;
        if (projectId !== lastProjectIdRef.current) {
            logCallback(`Studio: Project switched. Clearing context for "${activeProject?.name || 'Unknown'}"`);
            
            // Atomic reset of ALL states
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
            
            lastProjectIdRef.current = projectId;
        }
    }, [activeProject?.$id, logCallback]);

    // -- Fetchers --
    const fetchUsers = useCallback(async () => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        logCallback(`Studio: Fetching users for "${activeProject.name}"...`);
        setIsLoading(true);
        try {
            const sdk = getSdkUsers(activeProject);
            const res = await sdk.list([Query.limit(100), Query.orderDesc('$createdAt')]);
            if (currentPid === lastProjectIdRef.current) {
                setUsers(res.users);
                logCallback(`Studio: Found ${res.users.length} users.`);
            }
        } catch (e: any) { 
            logCallback(`ERROR Studio Users: ${e.message}`);
            console.error('Studio User Fetch Error:', e); 
            if (currentPid === lastProjectIdRef.current) setUsers([]);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    const fetchTeams = useCallback(async () => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        logCallback(`Studio: Fetching teams for "${activeProject.name}"...`);
        setIsLoading(true);
        try {
            const sdk = getSdkTeams(activeProject);
            const res = await sdk.list([Query.limit(100), Query.orderDesc('$createdAt')]);
            if (currentPid === lastProjectIdRef.current) {
                setTeams(res.teams);
                logCallback(`Studio: Found ${res.teams.length} teams.`);
            }
        } catch (e: any) { 
            logCallback(`ERROR Studio Teams: ${e.message}`);
            console.error('Studio Team Fetch Error:', e); 
            if (currentPid === lastProjectIdRef.current) setTeams([]);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    const fetchCollections = useCallback(async (dbId: string) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        logCallback(`Studio: Fetching collections for DB ${dbId}...`);
        setIsLoading(true);
        try {
            const sdk = getSdkDatabases(activeProject);
            const res = await sdk.listCollections(dbId, [Query.limit(100)]);
            if (currentPid === lastProjectIdRef.current) {
                setCollections(res.collections);
                logCallback(`Studio: Found ${res.collections.length} collections in DB.`);
            }
        } catch (e: any) { 
            logCallback(`ERROR Studio Collections: ${e.message}`);
            if (currentPid === lastProjectIdRef.current) setCollections([]);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    const fetchCollectionDetails = useCallback(async (dbId: string, collId: string) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        logCallback(`Studio: Fetching details for Collection ${collId}...`);
        setIsLoading(true);
        try {
            const sdk = getSdkDatabases(activeProject);
            const [docs, coll] = await Promise.all([
                sdk.listDocuments(dbId, collId, [Query.limit(100), Query.orderDesc('$createdAt')]),
                sdk.getCollection(dbId, collId)
            ]);
            if (currentPid === lastProjectIdRef.current) {
                setDocuments(docs.documents);
                setAttributes((coll.attributes || []).map((a: any) => ({ ...a, $id: a.key })));
                setIndexes((coll.indexes || []).map((i: any) => ({ ...i, $id: i.key })));
                logCallback(`Studio: Loaded ${docs.documents.length} documents.`);
            }
        } catch (e: any) { 
            logCallback(`ERROR Studio Collection Details: ${e.message}`);
            if (currentPid === lastProjectIdRef.current) {
                setDocuments([]);
                setAttributes([]);
                setIndexes([]);
            }
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    const fetchFiles = useCallback(async (bucketId: string) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        logCallback(`Studio: Fetching files for Bucket ${bucketId}...`);
        setIsLoading(true);
        try {
            const sdk = getSdkStorage(activeProject);
            const res = await sdk.listFiles(bucketId, [Query.limit(100), Query.orderDesc('$createdAt')]);
            if (currentPid === lastProjectIdRef.current) {
                setFiles(res.files);
                logCallback(`Studio: Found ${res.files.length} files.`);
            }
        } catch (e: any) { 
            logCallback(`ERROR Studio Storage: ${e.message}`);
            if (currentPid === lastProjectIdRef.current) setFiles([]);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    const fetchFunctionDetails = useCallback(async (funcId: string) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        logCallback(`Studio: Fetching deployments for Function ${funcId}...`);
        setIsLoading(true);
        try {
            const sdk = getSdkFunctions(activeProject);
            // Fetch Function + Deployments + Executions in parallel
            const [func, deps, execs] = await Promise.all([
                sdk.get(funcId),
                sdk.listDeployments(funcId, [Query.limit(50), Query.orderDesc('$createdAt')]),
                sdk.listExecutions(funcId, [Query.limit(20), Query.orderDesc('$createdAt')]),
            ]);
            
            if (currentPid === lastProjectIdRef.current) {
                // Ensure selectedFunction has latest active deployment ID
                setSelectedFunction(func as unknown as AppwriteFunction);
                setDeployments(deps.deployments);
                setExecutions(execs.executions);
                logCallback(`Studio: Loaded ${deps.deployments.length} deployments.`);
            }
        } catch (e: any) { 
            logCallback(`ERROR Studio Function Details: ${e.message}`);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    const fetchFunctionExecutionsOnly = useCallback(async (funcId: string) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        try {
            const sdk = getSdkFunctions(activeProject);
            const execs = await sdk.listExecutions(funcId, [Query.limit(20), Query.orderDesc('$createdAt')]);
            if (currentPid === lastProjectIdRef.current) {
                setExecutions(execs.executions);
            }
        } catch (e) { /* polling fail silent */ }
    }, [activeProject]);

    const fetchMemberships = useCallback(async (teamId: string) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        logCallback(`Studio: Fetching memberships for Team ${teamId}...`);
        setIsLoading(true);
        try {
            const sdk = getSdkTeams(activeProject);
            const res = await sdk.listMemberships(teamId);
            if (currentPid === lastProjectIdRef.current) {
                setMemberships(res.memberships);
                logCallback(`Studio: Loaded ${res.memberships.length} members.`);
            }
        } catch (e: any) { 
            logCallback(`ERROR Studio Memberships: ${e.message}`);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

    // -- Tab Switching Reset --
    useEffect(() => {
        setSelectedDb(null);
        setSelectedCollection(null);
        setSelectedBucket(null);
        setSelectedFunction(null);
        setSelectedTeam(null);
    }, [activeTab]);

    // -- Loaders with Project-ID Guarding --
    useEffect(() => { 
        if (activeProject && (activeTab === 'users' || activeTab === 'overview')) {
            fetchUsers(); 
        }
    }, [activeTab, activeProject?.$id, fetchUsers]);

    useEffect(() => { 
        if (activeProject && (activeTab === 'teams' || activeTab === 'overview')) {
            fetchTeams(); 
        }
    }, [activeTab, activeProject?.$id, fetchTeams]);

    useEffect(() => { 
        if (selectedDb && activeProject?.$id === lastProjectIdRef.current) {
            fetchCollections(selectedDb.$id); 
        }
    }, [selectedDb?.$id, fetchCollections, activeProject?.$id]);

    useEffect(() => { 
        if (selectedCollection && selectedDb && activeProject?.$id === lastProjectIdRef.current) {
            fetchCollectionDetails(selectedDb.$id, selectedCollection.$id); 
        }
    }, [selectedCollection?.$id, selectedDb?.$id, fetchCollectionDetails, activeProject?.$id]);

    useEffect(() => { 
        if (selectedBucket && activeProject?.$id === lastProjectIdRef.current) {
            fetchFiles(selectedBucket.$id); 
        }
    }, [selectedBucket?.$id, fetchFiles, activeProject?.$id]);

    useEffect(() => { 
        if (selectedFunction && activeProject?.$id === lastProjectIdRef.current) {
            fetchFunctionDetails(selectedFunction.$id); 
        }
    }, [selectedFunction?.$id, fetchFunctionDetails, activeProject?.$id]);

    useEffect(() => { 
        if (selectedTeam && activeProject?.$id === lastProjectIdRef.current) {
            fetchMemberships(selectedTeam.$id); 
        }
    }, [selectedTeam?.$id, fetchMemberships, activeProject?.$id]);

    // -- Execution Polling --
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (selectedFunction && activeTab === 'functions' && activeProject?.$id === lastProjectIdRef.current) {
            fetchFunctionExecutionsOnly(selectedFunction.$id);
            interval = setInterval(() => fetchFunctionExecutionsOnly(selectedFunction.$id), 3000);
        }
        return () => clearInterval(interval);
    }, [selectedFunction?.$id, activeTab, fetchFunctionExecutionsOnly, activeProject?.$id]);

    return {
        isLoading,
        users, teams,
        selectedDb, setSelectedDb,
        selectedCollection, setSelectedCollection,
        selectedBucket, setSelectedBucket,
        selectedFunction, setSelectedFunction,
        selectedTeam, setSelectedTeam,
        collections, documents, attributes, indexes, files, deployments, executions, memberships,
        fetchUsers, fetchTeams, fetchCollections, fetchCollectionDetails, fetchFiles, fetchFunctionDetails, fetchMemberships
    };
}
