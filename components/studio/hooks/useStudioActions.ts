
import { ID, Query } from '../../../services/appwrite';
import { getSdkDatabases, getSdkStorage, getSdkFunctions, getSdkUsers, getSdkTeams } from '../../../services/appwrite';
import type { AppwriteProject, Database, Bucket, AppwriteFunction } from '../../../types';
import type { Models } from 'node-appwrite';
import type { FormField } from '../types';
import { deployCodeFromString, downloadAndUnpackDeployment } from '../../../tools/functionsTools';
import React from 'react';
import { DocumentEditor } from '../ui/DocumentEditor';

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

    const { confirmAction, openForm, setModalLoading, setModal, openCustomModal, closeModal } = modals;

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
        
        openCustomModal(
            "Edit Document", 
            React.createElement(DocumentEditor, {
                document: doc,
                onCancel: closeModal,
                onSave: async (updatedData: any, permsArray: string[]) => {
                    await getSdkDatabases(activeProject).updateDocument(selectedDb.$id, selectedCollection.$id, doc.$id, updatedData, permsArray);
                    fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
                    closeModal();
                }
            }),
            '3xl'
        );
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
            case 'float':
                openForm("Create Float Attribute", [...baseFields, { name: 'min', label: 'Min', type: 'number' }, { name: 'max', label: 'Max', type: 'number' }], async (d: any) => {
                    await sdk.createFloatAttribute(dbId, collId, d.key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, undefined, d.array);
                    onFinish();
                });
                break;
            case 'email':
                openForm("Create Email Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createEmailAttribute(dbId, collId, d.key, d.required, d.default, d.array);
                    onFinish();
                });
                break;
            case 'url':
                openForm("Create URL Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createUrlAttribute(dbId, collId, d.key, d.required, d.default, d.array);
                    onFinish();
                });
                break;
            case 'ip':
                openForm("Create IP Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createIpAttribute(dbId, collId, d.key, d.required, d.default, d.array);
                    onFinish();
                });
                break;
            case 'datetime':
                openForm("Create Datetime Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createDatetimeAttribute(dbId, collId, d.key, d.required, d.default, d.array);
                    onFinish();
                });
                break;
            case 'enum':
                openForm("Create Enum Attribute", [...baseFields, { name: 'elements', label: 'Elements (Comma Separated)', type: 'textarea', required: true }, { name: 'default', label: 'Default' }], async (d: any) => {
                    const els = d.elements.split(',').map((s: string) => s.trim()).filter(Boolean);
                    await sdk.createEnumAttribute(dbId, collId, d.key, els, d.required, d.default, d.array);
                    onFinish();
                });
                break;
            case 'relationship':
                openForm("Create Relationship", [
                    { name: 'relatedCollectionId', label: 'Related Collection ID', required: true },
                    { name: 'type', label: 'Type', type: 'select', options: [{label: 'One to One', value: 'oneToOne'}, {label: 'One to Many', value: 'oneToMany'}, {label: 'Many to One', value: 'manyToOne'}, {label: 'Many to Many', value: 'manyToMany'}], required: true },
                    { name: 'twoWay', label: 'Two Way', type: 'checkbox', defaultValue: false },
                    { name: 'key', label: 'Key', required: true },
                    { name: 'twoWayKey', label: 'Two Way Key' },
                    { name: 'onDelete', label: 'On Delete', type: 'select', options: [{label: 'Restrict', value: 'restrict'}, {label: 'Cascade', value: 'cascade'}, {label: 'Set Null', value: 'setNull'}] }
                ], async (d: any) => {
                    await sdk.createRelationshipAttribute(dbId, collId, d.relatedCollectionId, d.type, d.twoWay, d.key, d.twoWayKey, d.onDelete);
                    onFinish();
                });
                break;
            default:
                alert(`Attribute type ${type} creation is available in the full Appwrite console.`);
        }
    };

    const handleUpdateAttribute = (attr: any) => {
        if (!selectedDb || !selectedCollection) return;
        const sdk = getSdkDatabases(activeProject);
        const dbId = selectedDb.$id;
        const collId = selectedCollection.$id;
        const key = attr.key;

        const requiredField: FormField = { name: 'required', label: 'Required', type: 'checkbox', defaultValue: attr.required };
        const defaultField: FormField = { name: 'default', label: 'Default Value', defaultValue: attr.default };
        
        const onFinish = () => fetchCollectionDetails(dbId, collId);

        switch (attr.type) {
            case 'string':
                openForm(`Edit String: ${key}`, [requiredField, defaultField], async (d: any) => {
                    await sdk.updateStringAttribute(dbId, collId, key, d.required, d.default || undefined);
                    onFinish();
                }, "Update");
                break;
            case 'integer':
                openForm(`Edit Integer: ${key}`, [
                    requiredField,
                    { name: 'min', label: 'Min', type: 'number', defaultValue: attr.min }, 
                    { name: 'max', label: 'Max', type: 'number', defaultValue: attr.max },
                    { name: 'default', label: 'Default', type: 'number', defaultValue: attr.default }
                ], async (d: any) => {
                    await sdk.updateIntegerAttribute(dbId, collId, key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.default ? Number(d.default) : undefined);
                    onFinish();
                }, "Update");
                break;
            case 'float':
                 openForm(`Edit Float: ${key}`, [
                    requiredField,
                    { name: 'min', label: 'Min', type: 'number', defaultValue: attr.min }, 
                    { name: 'max', label: 'Max', type: 'number', defaultValue: attr.max },
                    { name: 'default', label: 'Default', type: 'number', defaultValue: attr.default }
                ], async (d: any) => {
                    await sdk.updateFloatAttribute(dbId, collId, key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.default ? Number(d.default) : undefined);
                    onFinish();
                }, "Update");
                break;
            case 'boolean':
                openForm(`Edit Boolean: ${key}`, [
                    requiredField,
                    { name: 'default', label: 'Default', type: 'checkbox', defaultValue: attr.default }
                ], async (d: any) => {
                    await sdk.updateBooleanAttribute(dbId, collId, key, d.required, d.default);
                    onFinish();
                }, "Update");
                break;
            case 'email':
                openForm(`Edit Email: ${key}`, [requiredField, defaultField], async (d: any) => {
                    await sdk.updateEmailAttribute(dbId, collId, key, d.required, d.default || undefined);
                    onFinish();
                }, "Update");
                break;
            case 'url':
                openForm(`Edit URL: ${key}`, [requiredField, defaultField], async (d: any) => {
                    await sdk.updateUrlAttribute(dbId, collId, key, d.required, d.default || undefined);
                    onFinish();
                }, "Update");
                break;
            case 'ip':
                openForm(`Edit IP: ${key}`, [requiredField, defaultField], async (d: any) => {
                    await sdk.updateIpAttribute(dbId, collId, key, d.required, d.default || undefined);
                    onFinish();
                }, "Update");
                break;
            case 'datetime':
                openForm(`Edit Datetime: ${key}`, [requiredField, defaultField], async (d: any) => {
                    await sdk.updateDatetimeAttribute(dbId, collId, key, d.required, d.default || undefined);
                    onFinish();
                }, "Update");
                break;
            case 'enum':
                openForm(`Edit Enum: ${key}`, [
                    { name: 'elements', label: 'Elements (Comma Separated)', type: 'textarea', defaultValue: attr.elements?.join(', '), required: true },
                    requiredField,
                    defaultField
                ], async (d: any) => {
                    const els = d.elements.split(',').map((s: string) => s.trim()).filter(Boolean);
                    await sdk.updateEnumAttribute(dbId, collId, key, els, d.required, d.default || undefined);
                    onFinish();
                }, "Update");
                break;
            case 'relationship':
                 openForm(`Edit Relationship: ${key}`, [
                    { name: 'onDelete', label: 'On Delete', type: 'select', defaultValue: attr.onDelete, options: [{label: 'Restrict', value: 'restrict'}, {label: 'Cascade', value: 'cascade'}, {label: 'Set Null', value: 'setNull'}] }
                ], async (d: any) => {
                    await sdk.updateRelationshipAttribute(dbId, collId, key, d.onDelete);
                    onFinish();
                }, "Update");
                break;
            default:
                alert(`Editing for attribute type "${attr.type}" is not fully supported.`);
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
                    // Fix: Cast latestFunc to any to avoid property access errors caused by shadowing of the native Function type or SDK version discrepancies
                    let activeDeploymentId = (latestFunc as any).deployment;

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
        confirmAction("Clear All Execution History", `Delete ALL logs for "${selectedFunction.name}"? This may take some time for large histories.`, async () => {
            const sdk = getSdkFunctions(activeProject);
            const BATCH_SIZE = 100; // Max allowed by API for efficiency
            let totalPurged = 0;
            
            logCallback(`🚀 Turbo Purge: Starting high-speed execution log cleanup for "${selectedFunction.name}"...`);
            setModalLoading(true);

            try {
                while (true) {
                    // 1. Fetch next batch
                    const res = await sdk.listExecutions(selectedFunction.$id, [Query.limit(BATCH_SIZE)]);
                    const executions = res.executions;
                    const serverTotal = res.total;
                    
                    if (executions.length === 0) break;

                    // 2. Update UI with granular progress
                    const progressMsg = `Turbo Purge: Deleted ${totalPurged} of approx. ${serverTotal} logs...`;
                    setModal((prev: any) => ({ ...prev, message: progressMsg, confirmLabel: 'Purging...' }));
                    logCallback(`   - ${progressMsg}`);

                    // 3. Delete concurrently with resilience to 404 race conditions
                    const results = await Promise.allSettled(
                        executions.map(ex => sdk.deleteExecution(selectedFunction.$id, ex.$id))
                    );
                    
                    const batchSuccess = results.filter(r => r.status === 'fulfilled').length;
                    totalPurged += batchSuccess;
                    
                    // Safety: If we listed items but managed to delete 0 of them, stop to avoid infinite loop
                    if (batchSuccess === 0 && executions.length > 0) {
                        logCallback(`   ⚠️ Purge stalled. Likely permission issue or backend state mismatch.`);
                        break;
                    }

                    // If we got fewer than the batch size, we are done
                    if (executions.length < BATCH_SIZE) break;
                    
                    // Immediate next iteration - no throttle for Turbo mode
                }
                
                logCallback(`✅ Purge Complete: Successfully removed ${totalPurged} execution logs.`);
            } catch (e: any) {
                logCallback(`❌ Turbo Purge interrupted after ${totalPurged} items: ${e.message}`);
            } finally {
                setModalLoading(false);
                fetchFunctionDetails(selectedFunction.$id);
            }
        });
    };

    const handleRedeployFunction = (func: AppwriteFunction) => {
        confirmAction(
            "Redeploy Function",
            `Create a new deployment for "${func.name}" using the active/latest source code?`,
            async () => {
                setModalLoading(true);
                const sdk = getSdkFunctions(activeProject);
                
                try {
                    // Logic to get code and deploy
                    let deploymentId = (func as any).deployment;
                    if (!deploymentId) {
                        const deps = await sdk.listDeployments(func.$id, [Query.limit(1), Query.orderDesc('$createdAt')]);
                        if (deps.deployments.length > 0) {
                            deploymentId = deps.deployments[0].$id;
                        }
                    }

                    if (!deploymentId) {
                        throw new Error("No deployments found to redeploy from.");
                    }

                    const files = await downloadAndUnpackDeployment(activeProject, func.$id, deploymentId);
                    if (!files || files.length === 0) {
                        throw new Error("Deployment source empty or unavailable.");
                    }

                    const sanitizedFiles = files.map(f => ({
                        ...f,
                        name: f.name.replace(/^\.\//, '')
                    }));

                    let finalCommands = func.commands;
                    const hasPackageJson = sanitizedFiles.some(f => f.name === 'package.json');
                    const isNode = func.runtime && func.runtime.startsWith('node');
                    
                    if (!finalCommands && isNode && hasPackageJson) {
                        finalCommands = 'npm install';
                    }

                    await deployCodeFromString(
                        activeProject, 
                        func.$id, 
                        sanitizedFiles, 
                        true, // activate
                        func.entrypoint, 
                        finalCommands
                    );
                    
                    logCallback(`Studio: Redeployed "${func.name}" successfully.`);
                    fetchFunctionDetails(func.$id); // Refresh
                } catch (e: any) {
                    logCallback(`Studio Error: ${e.message}`);
                    alert(`Failed to redeploy: ${e.message}`);
                } finally {
                    setModalLoading(false);
                }
            }
        );
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
                        // Fix: Cast func to any to ensure safe access to the deployment property
                        let deploymentId = (func as any).deployment;
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
        handleCreateAttribute, handleUpdateAttribute, handleDeleteAttribute, handleCreateIndex, handleDeleteIndex,
        handleCreateBucket, handleDeleteBucket, handleDeleteFile,
        handleDeleteFunction, handleActivateDeployment, handleBulkDeleteDeployments, handleCleanupOldDeployments, handleDeleteAllExecutions,
        handleRedeployAllFunctions, handleRedeployFunction,
        handleCreateUser, handleDeleteUser,
        handleCreateTeam, handleDeleteTeam, handleCreateMembership, handleDeleteMembership
    };
}
