
import { ID, Query } from '../../../services/appwrite';
import { getSdkDatabases, getSdkStorage, getSdkFunctions, getSdkUsers, getSdkTeams } from '../../../services/appwrite';
import type { AppwriteProject, Database, Bucket, AppwriteFunction } from '../../../types';
import type { Models } from 'node-appwrite';
import type { FormField } from '../types';
import { deployCodeFromString, downloadAndUnpackDeployment } from '../../../tools/functionsTools';

export function useStudioActions(
    activeProject: AppwriteProject,
    data: any, // Result of useStudioData
    modals: any, // Result of useStudioModals
    refreshData: () => void,
    logCallback: (msg: string) => void
) {
    const { 
        selectedDb, setSelectedDb, selectedCollection, setSelectedCollection,
        selectedBucket, setSelectedBucket, selectedFunction, setSelectedFunction, selectedTeam,
        fetchCollections, fetchCollectionDetails, fetchFiles, 
        fetchFunctionDetails, fetchUsers, fetchTeams, fetchMemberships 
    } = data;

    const { confirmAction, openForm, setModalLoading } = modals;

    // -- Database --
    const handleCreateDatabase = () => {
        openForm("Create Database", [
            { name: 'databaseId', label: 'Database ID', defaultValue: 'unique()', required: true, placeholder: 'unique() or custom_id', description: 'Enter "unique()" to auto-generate.' },
            { name: 'name', label: 'Database Name', required: true }
        ], async (formData: any) => {
            const id = formData.databaseId === 'unique()' ? ID.unique() : formData.databaseId;
            await getSdkDatabases(activeProject).create(id, formData.name);
            refreshData();
        });
    };

    const handleDeleteDatabase = (db: Database) => {
        confirmAction("Delete Database", `Are you sure you want to delete "${db.name}"? This cannot be undone.`, async () => {
            await getSdkDatabases(activeProject).delete(db.$id);
            refreshData();
        });
    };

    // -- Collection --
    const handleCreateCollection = () => {
        if (!selectedDb) return;
        openForm("Create Collection", [
            { name: 'collectionId', label: 'Collection ID', defaultValue: 'unique()', required: true, placeholder: 'unique() or custom_id' },
            { name: 'name', label: 'Collection Name', required: true },
            { name: 'permissions', label: 'Permissions (Comma Separated)', placeholder: 'e.g. read("any")' },
            { name: 'documentSecurity', label: 'Document Security', type: 'checkbox', defaultValue: false },
            { name: 'enabled', label: 'Enabled', type: 'checkbox', defaultValue: true }
        ], async (formData: any) => {
            const id = formData.collectionId === 'unique()' ? ID.unique() : formData.collectionId;
            const permsArray = formData.permissions ? formData.permissions.split(',').map((p: string) => p.trim()).filter(Boolean) : undefined;
            await getSdkDatabases(activeProject).createCollection(selectedDb.$id, id, formData.name, permsArray, formData.documentSecurity, formData.enabled);
            fetchCollections(selectedDb.$id);
        });
    };

    const handleUpdateCollectionSettings = async (formData: any) => {
        if (!selectedDb || !selectedCollection) return;
        const permsArray = formData.permissions ? formData.permissions.split(',').map((p: string) => p.trim()).filter(Boolean) : [];
        const sdk = getSdkDatabases(activeProject);
        const updated = await sdk.updateCollection(selectedDb.$id, selectedCollection.$id, formData.name, permsArray, formData.documentSecurity, formData.enabled);
        setSelectedCollection(updated);
    };

    const handleDeleteCollection = (coll: Models.Collection) => {
        if (!selectedDb) return;
        confirmAction("Delete Collection", `Delete collection "${coll.name}"?`, async () => {
            await getSdkDatabases(activeProject).deleteCollection(selectedDb.$id, coll.$id);
            fetchCollections(selectedDb.$id);
            setSelectedCollection(null);
        });
    };

    // -- Documents --
    const handleCreateDocument = () => {
        if (!selectedDb || !selectedCollection) return;
        openForm("Create Document", [
            { name: 'documentId', label: 'Document ID', defaultValue: 'unique()', required: true },
            { name: 'data', label: 'JSON Data', type: 'textarea', placeholder: '{"key": "value"}', required: true },
            { name: 'permissions', label: 'Permissions (Comma Separated)', placeholder: 'e.g. read("any")' }
        ], async (formData: any) => {
            const id = formData.documentId === 'unique()' ? ID.unique() : formData.documentId;
            const docData = JSON.parse(formData.data);
            const permsArray = formData.permissions ? formData.permissions.split(',').map((p: string) => p.trim()).filter(Boolean) : undefined;
            await getSdkDatabases(activeProject).createDocument(selectedDb.$id, selectedCollection.$id, id, docData, permsArray);
            fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
        });
    };

    const handleUpdateDocument = (doc: Models.Document) => {
        if (!selectedDb || !selectedCollection) return;
        const { $id, $collectionId, $databaseId, $createdAt, $updatedAt, $permissions, ...dataFields } = doc;
        openForm("Edit Document", [
            { name: 'data', label: 'JSON Data', type: 'textarea', defaultValue: JSON.stringify(dataFields, null, 2), required: true },
            { name: 'permissions', label: 'Permissions', defaultValue: $permissions.join(', ') }
        ], async (formData: any) => {
            const updatedData = JSON.parse(formData.data);
            const permsArray = formData.permissions ? formData.permissions.split(',').map((p: string) => p.trim()).filter(Boolean) : undefined;
            await getSdkDatabases(activeProject).updateDocument(selectedDb.$id, selectedCollection.$id, doc.$id, updatedData, permsArray);
            fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
        }, "Save Changes");
    };

    const handleDeleteDocument = (doc: Models.Document) => {
        if (!selectedDb || !selectedCollection) return;
        confirmAction("Delete Document", `Delete document ${doc.$id}?`, async () => {
            await getSdkDatabases(activeProject).deleteDocument(selectedDb.$id, selectedCollection.$id, doc.$id);
            fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
        });
    };

    // -- Attributes & Indexes --
    const handleCreateAttribute = (type: string) => {
        if (!selectedDb || !selectedCollection) return;
        const sdk = getSdkDatabases(activeProject);
        const dbId = selectedDb.$id;
        const collId = selectedCollection.$id;
        const baseFields: FormField[] = [
            { name: 'key', label: 'Key', required: true },
            { name: 'required', label: 'Required', type: 'checkbox', defaultValue: false },
            { name: 'array', label: 'Array', type: 'checkbox', defaultValue: false },
        ];
        const onFinish = () => fetchCollectionDetails(dbId, collId);

        switch (type) {
            case 'string':
                openForm("Create String Attribute", [...baseFields, { name: 'size', label: 'Size', type: 'number', defaultValue: 255, required: true }, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createStringAttribute(dbId, collId, d.key, Number(d.size), d.required, d.default, d.array);
                    onFinish();
                });
                break;
            case 'integer':
                openForm("Create Integer Attribute", [...baseFields, { name: 'min', label: 'Min', type: 'number' }, { name: 'max', label: 'Max', type: 'number' }], async (d: any) => {
                    await sdk.createIntegerAttribute(dbId, collId, d.key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, undefined, d.array);
                    onFinish();
                });
                break;
            case 'boolean':
                openForm("Create Boolean Attribute", baseFields, async (d: any) => {
                    await sdk.createBooleanAttribute(dbId, collId, d.key, d.required, undefined, d.array);
                    onFinish();
                });
                break;
            // Additional types handled similarly...
            default:
                alert(`Attribute type ${type} creation is available in the full Appwrite console.`);
        }
    };

    const handleCreateIndex = () => {
        if (!selectedDb || !selectedCollection) return;
        openForm("Create Index", [
            { name: 'key', label: 'Key', required: true },
            { name: 'type', label: 'Type', type: 'select', required: true, options: [{label: 'Key', value: 'key'}, {label: 'Unique', value: 'unique'}, {label: 'Fulltext', value: 'fulltext'}] },
            { name: 'attributes', label: 'Attributes (Comma Separated)', required: true }
        ], async (d: any) => {
            const attrs = d.attributes.split(',').map((s: string) => s.trim()).filter(Boolean);
            await getSdkDatabases(activeProject).createIndex(selectedDb.$id, selectedCollection.$id, d.key, d.type, attrs);
            fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
        });
    };

    const handleDeleteAttribute = (attr: any) => {
        if (!selectedDb || !selectedCollection) return;
        confirmAction("Delete Attribute", `Delete attribute "${attr.key}"?`, async () => {
            await getSdkDatabases(activeProject).deleteAttribute(selectedDb.$id, selectedCollection.$id, attr.key);
            fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
        });
    };

    const handleDeleteIndex = (idx: any) => {
        if (!selectedDb || !selectedCollection) return;
        confirmAction("Delete Index", `Delete index "${idx.key}"?`, async () => {
            await getSdkDatabases(activeProject).deleteIndex(selectedDb.$id, selectedCollection.$id, idx.key);
            fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
        });
    };

    // -- Storage --
    const handleCreateBucket = () => {
        openForm("Create Bucket", [
            { name: 'bucketId', label: 'Bucket ID', defaultValue: 'unique()', required: true },
            { name: 'name', label: 'Bucket Name', required: true },
            { name: 'enabled', label: 'Enabled', type: 'checkbox', defaultValue: true },
            { name: 'fileSecurity', label: 'File Security', type: 'checkbox', defaultValue: false }
        ], async (formData: any) => {
            const id = formData.bucketId === 'unique()' ? ID.unique() : formData.bucketId;
            await getSdkStorage(activeProject).createBucket(id, formData.name, undefined, formData.fileSecurity, formData.enabled);
            refreshData();
        });
    };

    const handleDeleteBucket = (bucket: Bucket) => {
        confirmAction("Delete Bucket", `Delete bucket "${bucket.name}"?`, async () => {
            await getSdkStorage(activeProject).deleteBucket(bucket.$id);
            refreshData();
        });
    };

    const handleDeleteFile = (file: Models.File) => {
        if (!selectedBucket) return;
        confirmAction("Delete File", `Delete file "${file.name}"?`, async () => {
            await getSdkStorage(activeProject).deleteFile(selectedBucket.$id, file.$id);
            fetchFiles(selectedBucket.$id);
        });
    };

    // -- Functions --
    const handleDeleteFunction = (func: AppwriteFunction) => {
        confirmAction("Delete Function", `Delete function "${func.name}"?`, async () => {
            await getSdkFunctions(activeProject).delete(func.$id);
            refreshData();
        });
    };

    const handleActivateDeployment = (depId: string) => {
        if (!selectedFunction) return;
        confirmAction("Activate Deployment", "Activate this deployment?", async () => {
            const sdk = getSdkFunctions(activeProject);
            // 1. Perform activation
            await (sdk as any).updateDeployment(selectedFunction.$id, depId);
            
            // 2. CRITICAL REFRESH: Re-fetch function object to update 'deployment' ID in UI state immediately
            try {
                const updatedFunc = await sdk.get(selectedFunction.$id);
                setSelectedFunction(updatedFunc as unknown as AppwriteFunction);
                logCallback(`Studio: Deployment ${depId} activated for "${selectedFunction.name}".`);
            } catch (e) {
                console.error("Failed to refresh function object after activation", e);
            }
            
            // 3. Refresh list details (deployments/executions)
            fetchFunctionDetails(selectedFunction.$id);
        });
    };

    const handleBulkDeleteDeployments = (deploymentIds: string[]) => {
        if (!selectedFunction) return;
        confirmAction("Delete Deployments", `Delete ${deploymentIds.length} deployments?`, async () => {
            const sdk = getSdkFunctions(activeProject);
            await Promise.all(deploymentIds.map(id => sdk.deleteDeployment(selectedFunction.$id, id)));
            fetchFunctionDetails(selectedFunction.$id);
        });
    };

    const handleCleanupOldDeployments = () => {
        if (!selectedFunction) return;
        
        confirmAction(
            "Cleanup Old Deployments", 
            `This will delete ALL deployments for "${selectedFunction.name}" EXCEPT the currently active or latest one. Do you want to proceed?`, 
            async () => {
                logCallback(`🧹 Cleanup: Identifying old deployments for "${selectedFunction.name}"...`);
                setModalLoading(true);
                const sdk = getSdkFunctions(activeProject);
                
                try {
                    // 1. Fetch latest function data to get accurate deployment pointer
                    const latestFunc = await sdk.get(selectedFunction.$id);
                    let activeDeploymentId = latestFunc.deployment;

                    // 2. Fetch all deployments
                    const res = await sdk.listDeployments(selectedFunction.$id, [Query.limit(100), Query.orderDesc('$createdAt')]);
                    
                    // 3. Fallback: if no active pointer, use the top of the list (latest)
                    if (!activeDeploymentId && res.deployments.length > 0) {
                        activeDeploymentId = res.deployments[0].$id;
                        logCallback(`   ℹ️ No active pointer. Preserving latest deployment instead: ${activeDeploymentId}`);
                    }

                    if (!activeDeploymentId) {
                        logCallback("   - No deployments found to cleanup.");
                        return;
                    }

                    // 4. Filter to delete everything except the identified one
                    const toDelete = res.deployments.filter(d => d.$id !== activeDeploymentId);
                    
                    if (toDelete.length === 0) {
                        logCallback(`   - Only one deployment exists (${activeDeploymentId}). Nothing to cleanup.`);
                    } else {
                        logCallback(`   - Preserving active/latest: ${activeDeploymentId}`);
                        logCallback(`   - Deleting ${toDelete.length} stale deployment(s)...`);
                        
                        // Execute deletions
                        await Promise.all(toDelete.map(d => sdk.deleteDeployment(selectedFunction.$id, d.$id)));
                        logCallback(`   ✅ Cleanup finished.`);
                    }
                } catch (e: any) {
                    logCallback(`   ❌ Cleanup failed: ${e.message}`);
                } finally {
                    setModalLoading(false);
                    fetchFunctionDetails(selectedFunction.$id);
                }
            }
        );
    };

    const handleDeleteAllExecutions = () => {
        if (!selectedFunction) return;
        confirmAction("Clear All Execution History", `Delete ALL logs for "${selectedFunction.name}"?`, async () => {
            const sdk = getSdkFunctions(activeProject);
            while (true) {
                const res = await sdk.listExecutions(selectedFunction.$id, [Query.limit(100)]);
                if (res.executions.length === 0) break;
                await Promise.all(res.executions.map(ex => sdk.deleteExecution(selectedFunction.$id, ex.$id)));
                if (res.executions.length < 100) break;
            }
            fetchFunctionDetails(selectedFunction.$id);
        });
    };

    const handleRedeployAllFunctions = (allFunctions: AppwriteFunction[]) => {
        if (allFunctions.length === 0) return;
        confirmAction(
            "Redeploy All Functions", 
            `This will create a new deployment for all ${allFunctions.length} functions using their current source code. This is useful for picking up changes to Global Variables. Do you want to proceed?`, 
            async () => {
                logCallback(`🚀 Bulk Redeploy: Starting for ${allFunctions.length} functions...`);
                setModalLoading(true);
                
                let successCount = 0;
                let failCount = 0;

                const sdk = getSdkFunctions(activeProject);

                for (const func of allFunctions) {
                    logCallback(`   - Processing "${func.name}"...`);
                    try {
                        // 1. Find deployment ID (Active pointer or fallback to latest)
                        let deploymentId = func.deployment;
                        if (!deploymentId) {
                            try {
                                const deps = await sdk.listDeployments(func.$id, [Query.limit(1), Query.orderDesc('$createdAt')]);
                                if (deps.deployments.length > 0) {
                                    deploymentId = deps.deployments[0].$id;
                                    logCallback(`     ℹ️ No active deployment pointer. Using latest: ${deploymentId}`);
                                }
                            } catch (err) { /* silent fail */ }
                        }

                        if (!deploymentId) {
                            logCallback(`     ⚠️ Skipped: No deployments found for this function.`);
                            failCount++;
                            continue;
                        }

                        // 2. Download and unpack latest code
                        const files = await downloadAndUnpackDeployment(activeProject, func.$id, deploymentId);
                        if (!files || files.length === 0) {
                            logCallback(`     ⚠️ Skipped: Deployment ${deploymentId} appears empty or could not be unpacked.`);
                            failCount++;
                            continue;
                        }

                        // 3. Sanitize and prepare build commands (Migration Logic)
                        const sanitizedFiles = files.map(f => ({
                            ...f,
                            name: f.name.replace(/^\.\//, '')
                        }));

                        let finalCommands = func.commands;
                        const hasPackageJson = sanitizedFiles.some(f => f.name === 'package.json');
                        const isNode = func.runtime && func.runtime.startsWith('node');
                        
                        if (!finalCommands && isNode && hasPackageJson) {
                            finalCommands = 'npm install';
                            logCallback(`     ℹ️ Auto-detect: forcing build command 'npm install'`);
                        }

                        // 4. Deploy again
                        await deployCodeFromString(
                            activeProject, 
                            func.$id, 
                            sanitizedFiles, 
                            true, // activate
                            func.entrypoint, 
                            finalCommands
                        );
                        logCallback(`     ✅ Deployment triggered successfully.`);
                        successCount++;
                    } catch (e: any) {
                        logCallback(`     ❌ Failed: ${e.message}`);
                        failCount++;
                    }
                }

                logCallback(`🏁 Bulk Redeploy Finished. Success: ${successCount}, Failures: ${failCount}.`);
                setModalLoading(false);
                refreshData();
            }
        );
    };

    // -- Users & Teams --
    const handleCreateUser = () => {
        openForm("Create User", [
            { name: 'userId', label: 'User ID', defaultValue: 'unique()', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'password', label: 'Password', type: 'password', required: true },
            { name: 'name', label: 'Name' }
        ], async (formData: any) => {
            const id = formData.userId === 'unique()' ? ID.unique() : formData.userId;
            await getSdkUsers(activeProject).create(id, formData.email, undefined, formData.password, formData.name || undefined);
            fetchUsers();
        });
    };

    const handleDeleteUser = (u: Models.User<any>) => {
        confirmAction("Delete User", `Delete user "${u.email}"?`, async () => {
            await getSdkUsers(activeProject).delete(u.$id);
            fetchUsers();
        });
    };

    const handleCreateTeam = () => {
        openForm("Create Team", [
            { name: 'teamId', label: 'Team ID', defaultValue: 'unique()', required: true },
            { name: 'name', label: 'Team Name', required: true }
        ], async (formData: any) => {
            const id = formData.teamId === 'unique()' ? ID.unique() : formData.teamId;
            await getSdkTeams(activeProject).create(id, formData.name);
            fetchTeams();
        });
    };

    const handleDeleteTeam = (t: Models.Team<any>) => {
        confirmAction("Delete Team", `Delete team "${t.name}"?`, async () => {
            await getSdkTeams(activeProject).delete(t.$id);
            fetchTeams();
        });
    };

    const handleCreateMembership = () => {
        if (!selectedTeam) return;
        openForm("Invite Member", [
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'name', label: 'Name' },
            { name: 'url', label: 'Redirect URL', defaultValue: 'http://localhost' },
            { name: 'roles', label: 'Roles', placeholder: 'owner' }
        ], async (formData: any) => {
            const roles = formData.roles ? formData.roles.split(',').map((r: string) => r.trim()) : [];
            await getSdkTeams(activeProject).createMembership(selectedTeam.$id, roles, formData.url, formData.email, formData.name);
            fetchMemberships(selectedTeam.$id);
        }, "Invite");
    };

    const handleDeleteMembership = (m: Models.Membership) => {
        if (!selectedTeam) return;
        confirmAction("Remove Member", `Remove ${m.userEmail} from team?`, async () => {
            await getSdkTeams(activeProject).deleteMembership(selectedTeam.$id, m.$id);
            fetchMemberships(selectedTeam.$id);
        });
    };

    return {
        handleCreateDatabase, handleDeleteDatabase,
        handleCreateCollection, handleUpdateCollectionSettings, handleDeleteCollection,
        handleCreateDocument, handleUpdateDocument, handleDeleteDocument,
        handleCreateAttribute, handleDeleteAttribute, handleCreateIndex, handleDeleteIndex,
        handleCreateBucket, handleDeleteBucket, handleDeleteFile,
        handleDeleteFunction, handleActivateDeployment, handleBulkDeleteDeployments, handleCleanupOldDeployments, handleDeleteAllExecutions,
        handleRedeployAllFunctions,
        handleCreateUser, handleDeleteUser,
        handleCreateTeam, handleDeleteTeam, handleCreateMembership, handleDeleteMembership
    };
}
