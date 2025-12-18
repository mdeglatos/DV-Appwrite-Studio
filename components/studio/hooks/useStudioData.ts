
import { useState, useEffect, useCallback } from 'react';
import { Query } from '../../../services/appwrite';
import { getSdkDatabases, getSdkStorage, getSdkFunctions, getSdkUsers, getSdkTeams } from '../../../services/appwrite';
import type { AppwriteProject, Database, Bucket, AppwriteFunction, StudioTab } from '../../../types';
import type { Models } from 'node-appwrite';

export function useStudioData(activeProject: AppwriteProject, activeTab: StudioTab) {
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

    // -- Fetchers --
    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const sdk = getSdkUsers(activeProject);
            const res = await sdk.list([Query.limit(100), Query.orderDesc('$createdAt')]);
            setUsers(res.users);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }, [activeProject]);

    const fetchTeams = useCallback(async () => {
        setIsLoading(true);
        try {
            const sdk = getSdkTeams(activeProject);
            const res = await sdk.list([Query.limit(100), Query.orderDesc('$createdAt')]);
            setTeams(res.teams);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }, [activeProject]);

    const fetchCollections = useCallback(async (dbId: string) => {
        setIsLoading(true);
        try {
            const sdk = getSdkDatabases(activeProject);
            const res = await sdk.listCollections(dbId, [Query.limit(100)]);
            setCollections(res.collections);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }, [activeProject]);

    const fetchCollectionDetails = useCallback(async (dbId: string, collId: string) => {
        setIsLoading(true);
        try {
            const sdk = getSdkDatabases(activeProject);
            const [docs, coll] = await Promise.all([
                sdk.listDocuments(dbId, collId, [Query.limit(100), Query.orderDesc('$createdAt')]),
                sdk.getCollection(dbId, collId)
            ]);
            setDocuments(docs.documents);
            setAttributes((coll.attributes || []).map((a: any) => ({ ...a, $id: a.key })));
            setIndexes((coll.indexes || []).map((i: any) => ({ ...i, $id: i.key })));
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }, [activeProject]);

    const fetchFiles = useCallback(async (bucketId: string) => {
        setIsLoading(true);
        try {
            const sdk = getSdkStorage(activeProject);
            const res = await sdk.listFiles(bucketId, [Query.limit(100), Query.orderDesc('$createdAt')]);
            setFiles(res.files);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }, [activeProject]);

    const fetchFunctionDetails = useCallback(async (funcId: string) => {
        setIsLoading(true);
        try {
            const sdk = getSdkFunctions(activeProject);
            const [deps, execs] = await Promise.all([
                sdk.listDeployments(funcId, [Query.limit(50), Query.orderDesc('$createdAt')]),
                sdk.listExecutions(funcId, [Query.limit(20), Query.orderDesc('$createdAt')]),
            ]);
            setDeployments(deps.deployments);
            setExecutions(execs.executions);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }, [activeProject]);

    const fetchFunctionExecutionsOnly = useCallback(async (funcId: string) => {
        try {
            const sdk = getSdkFunctions(activeProject);
            const execs = await sdk.listExecutions(funcId, [Query.limit(20), Query.orderDesc('$createdAt')]);
            setExecutions(execs.executions);
        } catch (e) { console.error(e); }
    }, [activeProject]);

    const fetchMemberships = useCallback(async (teamId: string) => {
        setIsLoading(true);
        try {
            const sdk = getSdkTeams(activeProject);
            const res = await sdk.listMemberships(teamId);
            setMemberships(res.memberships);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }, [activeProject]);

    // -- Tab Switching Reset --
    useEffect(() => {
        setSelectedDb(null);
        setSelectedCollection(null);
        setSelectedBucket(null);
        setSelectedFunction(null);
        setSelectedTeam(null);
    }, [activeTab]);

    // -- Global and Tab-specific Loaders --
    useEffect(() => { if (activeTab === 'users' || activeTab === 'overview') fetchUsers(); }, [activeTab, fetchUsers]);
    useEffect(() => { if (activeTab === 'teams' || activeTab === 'overview') fetchTeams(); }, [activeTab, fetchTeams]);
    useEffect(() => { if (selectedDb) fetchCollections(selectedDb.$id); }, [selectedDb, fetchCollections]);
    useEffect(() => { if (selectedCollection && selectedDb) fetchCollectionDetails(selectedDb.$id, selectedCollection.$id); }, [selectedCollection?.$id, selectedDb?.$id, fetchCollectionDetails]);
    useEffect(() => { if (selectedBucket) fetchFiles(selectedBucket.$id); }, [selectedBucket, fetchFiles]);
    useEffect(() => { if (selectedFunction) fetchFunctionDetails(selectedFunction.$id); }, [selectedFunction, fetchFunctionDetails]);
    useEffect(() => { if (selectedTeam) fetchMemberships(selectedTeam.$id); }, [selectedTeam, fetchMemberships]);

    // -- Execution Polling --
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (selectedFunction && activeTab === 'functions') {
            fetchFunctionExecutionsOnly(selectedFunction.$id);
            interval = setInterval(() => fetchFunctionExecutionsOnly(selectedFunction.$id), 3000);
        }
        return () => clearInterval(interval);
    }, [selectedFunction, activeTab, fetchFunctionExecutionsOnly]);

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
