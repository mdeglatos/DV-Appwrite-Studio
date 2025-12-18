
import { useState, useEffect, useCallback, useRef } from 'react';
import { Query, handleFetchError } from '../services/appwrite';
import { getSdkDatabases, getSdkStorage, getSdkFunctions, getSdkUsers, getSdkTeams } from '../services/appwrite';
import type { AppwriteProject, Database, Bucket, AppwriteFunction, StudioTab } from '../types';
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
            const [docs, coll] = await Promise.all([
                sdk.listDocuments(dbId, collId, [Query.limit(100), Query.orderDesc('$createdAt')]),
                sdk.getCollection(dbId, collId)
            ]);
            if (currentPid === lastProjectIdRef.current) {
                setDocuments(docs.documents);
                setAttributes((coll.attributes || []).map((a: any) => ({ ...a, $id: a.key })));
                setIndexes((coll.indexes || []).map((i: any) => ({ ...i, $id: i.key })));
            }
        } catch (e) { 
            logCallback(`Studio Error: ${handleFetchError(e)}`);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

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

    const fetchFunctionDetails = useCallback(async (funcId: string) => {
        if (!activeProject) return;
        const currentPid = activeProject.$id;
        setIsLoading(true);
        try {
            const sdk = getSdkFunctions(activeProject);
            const [deps, execs] = await Promise.all([
                sdk.listDeployments(funcId, [Query.limit(50), Query.orderDesc('$createdAt')]),
                sdk.listExecutions(funcId, [Query.limit(20), Query.orderDesc('$createdAt')]),
            ]);
            if (currentPid === lastProjectIdRef.current) {
                setDeployments(deps.deployments);
                setExecutions(execs.executions);
            }
        } catch (e) { 
            logCallback(`Studio Error: ${handleFetchError(e)}`);
        } finally { 
            if (currentPid === lastProjectIdRef.current) setIsLoading(false); 
        }
    }, [activeProject, logCallback]);

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

    useEffect(() => {
        setSelectedDb(null);
        setSelectedCollection(null);
        setSelectedBucket(null);
        setSelectedFunction(null);
        setSelectedTeam(null);
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
    }, [selectedCollection?.$id, selectedDb?.$id, fetchCollectionDetails, activeProject?.$id]);

    useEffect(() => { 
        if (selectedBucket && activeProject?.$id === lastProjectIdRef.current) fetchFiles(selectedBucket.$id); 
    }, [selectedBucket?.$id, fetchFiles, activeProject?.$id]);

    useEffect(() => { 
        if (selectedFunction && activeProject?.$id === lastProjectIdRef.current) fetchFunctionDetails(selectedFunction.$id); 
    }, [selectedFunction?.$id, fetchFunctionDetails, activeProject?.$id]);

    useEffect(() => { 
        if (selectedTeam && activeProject?.$id === lastProjectIdRef.current) fetchMemberships(selectedTeam.$id); 
    }, [selectedTeam?.$id, fetchMemberships, activeProject?.$id]);

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
