
import { ID, Query } from '../../../services/appwrite';
import { getSdkDatabases, getSdkStorage, getSdkFunctions, getSdkUsers, getSdkTeams } from '../../../services/appwrite';
import type { AppwriteProject, Database, Bucket, AppwriteFunction } from '../../../types';
import type { Models } from 'node-appwrite';
import type { FormField } from '../types';
import { deployCodeFromString, downloadAndUnpackDeployment } from '../../../tools/functionsTools';
import React from 'react';
import { DocumentEditor } from '../ui/DocumentEditor';
import { DocumentCreateForm } from '../ui/DocumentCreateForm';
import { CodeIcon, CheckIcon, CopyIcon, WarningIcon } from '../../Icons';
import { BACKUP_BUCKET_ID, BackupService } from '../../../services/backupService';

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
        fetchFunctionDetails, fetchUsers, fetchTeams, fetchMemberships,
        attributes // Access current attributes from useStudioData
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

    const handleCopyDatabaseSchema = async (db: Database) => {
        logCallback(`Studio: Generating full schema for database "${db.name}"...`);
        setModalLoading(true);
        const sdk = getSdkDatabases(activeProject);
        
        try {
            const collectionsRes = await sdk.listCollections(db.$id, [Query.limit(100)]);
            const fullSchema: any = {
                databaseId: db.$id,
                name: db.name,
                collections: []
            };

            for (const col of collectionsRes.collections) {
                logCallback(`   - Inspecting collection: ${col.name}`);
                fullSchema.collections.push({
                    $id: col.$id,
                    name: col.name,
                    enabled: col.enabled,
                    documentSecurity: col.documentSecurity,
                    permissions: col.$permissions,
                    attributes: col.attributes.map((a: any) => {
                        const { $createdAt, $updatedAt, ...rest } = a;
                        return rest;
                    }),
                    indexes: col.indexes.map((i: any) => {
                        const { $createdAt, $updatedAt, ...rest } = i;
                        return rest;
                    })
                });
            }

            const jsonSchema = JSON.stringify(fullSchema, null, 2);
            
            openCustomModal(
                "Database Blueprint",
                React.createElement('div', { className: "space-y-4" },
                    React.createElement('p', { className: "text-xs text-gray-400" }, "Copy this JSON to replicate this schema elsewhere or use it as a prompt context for AI."),
                    React.createElement('div', { className: "relative group" },
                        React.createElement('div', { className: "bg-[#0d1117] rounded-xl border border-gray-700 p-4 overflow-hidden shadow-inner" },
                            React.createElement('pre', { className: "text-[11px] font-mono text-cyan-200/70 overflow-y-auto max-h-[50vh] custom-scrollbar leading-relaxed" }, jsonSchema)
                        ),
                        React.createElement('button', {
                            onClick: () => {
                                navigator.clipboard.writeText(jsonSchema);
                                logCallback("Studio: Schema copied to clipboard.");
                            },
                            className: "absolute top-3 right-3 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold border border-gray-600 flex items-center gap-2 transition-all shadow-xl"
                        }, 
                            React.createElement(CopyIcon, { size: 14 }),
                            " Copy JSON"
                        )
                    )
                ),
                '3xl'
            );
        } catch (e: any) {
            logCallback(`❌ Failed to generate schema: ${e.message}`);
        } finally {
            setModalLoading(false);
        }
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
        confirmAction("Delete Collection", `Delete collection "${coll.name}"? This is permanent and deletes all contained documents.`, async () => {
            await getSdkDatabases(activeProject).deleteCollection(selectedDb.$id, coll.$id);
            fetchCollections(selectedDb.$id);
            setSelectedCollection(null);
        });
    };

    // -- Documents --
    const handleCreateDocument = () => {
        if (!selectedDb || !selectedCollection) return;

        openCustomModal(
            `Add to ${selectedCollection.name}`,
            React.createElement(DocumentCreateForm, {
                attributes: attributes, // From useStudioData
                onCancel: closeModal,
                onSave: async (docId: string, docData: any, permsArray: string[]) => {
                    const id = docId === 'unique()' ? ID.unique() : docId;
                    await getSdkDatabases(activeProject).createDocument(
                        selectedDb.$id, 
                        selectedCollection.$id, 
                        id, 
                        docData, 
                        permsArray.length > 0 ? permsArray : undefined
                    );
                    fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
                    closeModal();
                    logCallback(`Studio: Document ${id} created in ${selectedCollection.name}.`);
                }
            }),
            '3xl'
        );
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
                    await sdk.createStringAttribute(dbId, collId, d.key, Number(d.size), d.required, d.default || null, d.array);
                    onFinish();
                });
                break;
            case 'integer':
                openForm("Create Integer Attribute", [...baseFields, { name: 'min', label: 'Min', type: 'number' }, { name: 'max', label: 'Max', type: 'number' }, { name: 'default', label: 'Default', type: 'number' }], async (d: any) => {
                    await sdk.createIntegerAttribute(dbId, collId, d.key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.default !== "" ? Number(d.default) : undefined, d.array);
                    onFinish();
                });
                break;
            case 'boolean':
                openForm("Create Boolean Attribute", [...baseFields, { name: 'default', label: 'Default', type: 'checkbox', defaultValue: false }], async (d: any) => {
                    await sdk.createBooleanAttribute(dbId, collId, d.key, d.required, d.default, d.array);
                    onFinish();
                });
                break;
            case 'float':
                openForm("Create Float Attribute", [...baseFields, { name: 'min', label: 'Min', type: 'number' }, { name: 'max', label: 'Max', type: 'number' }, { name: 'default', label: 'Default', type: 'number' }], async (d: any) => {
                    await sdk.createFloatAttribute(dbId, collId, d.key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.default !== "" ? Number(d.default) : undefined, d.array);
                    onFinish();
                });
                break;
            case 'email':
                openForm("Create Email Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createEmailAttribute(dbId, collId, d.key, d.required, d.default || null, d.array);
                    onFinish();
                });
                break;
            case 'url':
                openForm("Create URL Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createUrlAttribute(dbId, collId, d.key, d.required, d.default || null, d.array);
                    onFinish();
                });
                break;
            case 'ip':
                openForm("Create IP Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createIpAttribute(dbId, collId, d.key, d.required, d.default || null, d.array);
                    onFinish();
                });
                break;
            case 'datetime':
                openForm("Create Datetime Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createDatetimeAttribute(dbId, collId, d.key, d.required, d.default || null, d.array);
                    onFinish();
                });
                break;
            case 'enum':
                openForm("Create Enum Attribute", [...baseFields, { name: 'elements', label: 'Elements (Comma Separated)', type: 'textarea', required: true }, { name: 'default', label: 'Default' }], async (d: any) => {
                    const els = d.elements.split(',').map((s: string) => s.trim()).filter(Boolean);
                    await sdk.createEnumAttribute(dbId, collId, d.key, els, d.required, d.default || null, d.array);
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
        }
    };

    const handleUpdateAttribute = (attr: any) => {
        if (!selectedDb || !selectedCollection) return;
        const sdk = getSdkDatabases(activeProject);
        const dbId = selectedDb.$id;
        const collId = selectedCollection.$id;
        const oldKey = attr.key || attr.$id;
        const onFinish = () => fetchCollectionDetails(dbId, collId);
        
        // Robust type detection: prefer format (specialized string) over generic type
        const type = attr.format || attr.type || 'string';

        const fields: FormField[] = [
            { name: 'key', label: 'Attribute Key', defaultValue: oldKey, required: true, description: 'Modifying this requires a delete-and-recreate cycle.' },
            { name: 'required', label: 'Required', type: 'checkbox', defaultValue: attr.required },
            { name: 'array', label: 'Array', type: 'checkbox', defaultValue: attr.array, description: 'Modifying this requires a delete-and-recreate cycle.' },
            { name: 'default', label: 'Default Value', defaultValue: attr.default }
        ];

        if (type === 'string') {
            fields.splice(1, 0, { name: 'size', label: 'Size', type: 'number', defaultValue: attr.size || 255, description: 'Increasing size requires a delete-and-recreate cycle.' });
        } else if (type === 'integer' || type === 'float') {
            fields.push({ name: 'min', label: 'Min', type: 'number', defaultValue: attr.min }, { name: 'max', label: 'Max', type: 'number', defaultValue: attr.max });
        } else if (type === 'enum') {
            fields.push({ name: 'elements', label: 'Elements (Comma Separated)', type: 'textarea', defaultValue: attr.elements?.join(', '), required: true });
        } else if (type === 'relationship') {
            openForm(`Edit Relationship: ${oldKey}`, [
                { name: 'onDelete', label: 'On Delete', type: 'select', defaultValue: attr.onDelete, options: [{label: 'Restrict', value: 'restrict'}, {label: 'Cascade', value: 'cascade'}, {label: 'Set Null', value: 'setNull'}] }
            ], async (d: any) => {
                await sdk.updateRelationshipAttribute(dbId, collId, oldKey, d.onDelete);
                onFinish();
            }, "Update");
            return;
        }

        openForm(`Edit Attribute: ${oldKey}`, fields, async (d: any) => {
            const needsRecreate = d.key !== oldKey || (type === 'string' && Number(d.size) !== attr.size) || !!d.array !== !!attr.array;

            const performUpdate = async () => {
                if (needsRecreate) {
                    logCallback(`Studio: Deleting attribute "${oldKey}" from ${collId}...`);
                    await sdk.deleteAttribute(dbId, collId, oldKey);
                    
                    // Add a safety delay for eventually consistent metadata updates
                    logCallback(`Studio: Waiting for metadata sync...`);
                    await new Promise(r => setTimeout(r, 1000));
                    
                    logCallback(`Studio: Recreating attribute "${d.key}"...`);
                    switch (type) {
                        case 'string': await sdk.createStringAttribute(dbId, collId, d.key, Number(d.size), d.required, d.default || null, d.array); break;
                        case 'integer': await sdk.createIntegerAttribute(dbId, collId, d.key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.default !== "" ? Number(d.default) : undefined, d.array); break;
                        case 'float': await sdk.createFloatAttribute(dbId, collId, d.key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.default !== "" ? Number(d.default) : undefined, d.array); break;
                        case 'boolean': await sdk.createBooleanAttribute(dbId, collId, d.key, d.required, !!d.default, d.array); break;
                        case 'email': await sdk.createEmailAttribute(dbId, collId, d.key, d.required, d.default || null, d.array); break;
                        case 'url': await sdk.createUrlAttribute(dbId, collId, d.key, d.required, d.default || null, d.array); break;
                        case 'ip': await sdk.createIpAttribute(dbId, collId, d.key, d.required, d.default || null, d.array); break;
                        case 'datetime': await sdk.createDatetimeAttribute(dbId, collId, d.key, d.required, d.default || null, d.array); break;
                        case 'enum': 
                            const els = d.elements.split(',').map((s: string) => s.trim()).filter(Boolean);
                            await sdk.createEnumAttribute(dbId, collId, d.key, els, d.required, d.default || null, d.array); 
                            break;
                    }
                } else {
                    switch (type) {
                        case 'string': await sdk.updateStringAttribute(dbId, collId, oldKey, d.required, d.default || null); break;
                        case 'integer': await sdk.updateIntegerAttribute(dbId, collId, oldKey, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.default !== "" ? Number(d.default) : undefined); break;
                        case 'float': await sdk.updateFloatAttribute(dbId, collId, oldKey, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.default !== "" ? Number(d.default) : undefined); break;
                        case 'boolean': await sdk.updateBooleanAttribute(dbId, collId, oldKey, d.required, !!d.default); break;
                        case 'email': await sdk.updateEmailAttribute(dbId, collId, oldKey, d.required, d.default || null); break;
                        case 'url': await sdk.updateUrlAttribute(dbId, collId, oldKey, d.required, d.default || null); break;
                        case 'ip': await sdk.updateIpAttribute(dbId, collId, oldKey, d.required, d.default || null); break;
                        case 'datetime': await sdk.updateDatetimeAttribute(dbId, collId, oldKey, d.required, d.default || null); break;
                        case 'enum': 
                            const els = d.elements.split(',').map((s: string) => s.trim()).filter(Boolean);
                            await sdk.updateEnumAttribute(dbId, collId, oldKey, els, d.required, d.default || null); 
                            break;
                    }
                }
                onFinish();
            };

            if (needsRecreate) {
                confirmAction(
                    "Data Loss Warning", 
                    `You have changed an immutable field. Attribute "${oldKey}" must be DELETED and RECREATED in collection "${collId}". This will permanently CLEAR all data for this attribute in your documents. Proceed?`, 
                    performUpdate
                );
                return true; // Return true to signal Studio to NOT auto-close the modal state
            } else {
                await performUpdate();
            }
        }, "Update Attribute");
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

    const handleUpdateIndex = (idx: any) => {
        if (!selectedDb || !selectedCollection) return;
        openForm(`Recreate Index: ${idx.key}`, [
            { name: 'type', label: 'Type', type: 'select', required: true, defaultValue: idx.type, options: [{label: 'Key', value: 'key'}, {label: 'Unique', value: 'unique'}, {label: 'Fulltext', value: 'fulltext'}] },
            { name: 'attributes', label: 'Attributes (Comma Separated)', required: true, defaultValue: idx.attributes.join(', ') }
        ], async (d: any) => {
            confirmAction("Recreate Index", `Recreating index "${idx.key}" will delete the old version first. Continue?`, async () => {
                const sdk = getSdkDatabases(activeProject);
                const attrs = d.attributes.split(',').map((s: string) => s.trim()).filter(Boolean);
                await sdk.deleteIndex(selectedDb.$id, selectedCollection.$id, idx.key);
                await sdk.createIndex(selectedDb.$id, selectedCollection.$id, idx.key, d.type, attrs);
                fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
            });
            return true; // Signal to not close modal system
        }, "Stage Recreate");
    };

    const handleDeleteAttribute = (attr: any) => {
        if (!selectedDb || !selectedCollection) return;
        confirmAction("Delete Attribute", `Delete attribute "${attr.key || attr.$id}"? This clears this attribute's data from all documents.`, async () => {
            await getSdkDatabases(activeProject).deleteAttribute(selectedDb.$id, selectedCollection.$id, attr.key || attr.$id);
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
            { name: 'name', label: 'Bucket Name', required: true }
        ], async (formData: any) => {
            const id = formData.bucketId === 'unique()' ? ID.unique() : formData.bucketId;
            await getSdkStorage(activeProject).createBucket(id, formData.name);
            refreshData();
        });
    };

    const handleDeleteBucket = (bucket: Bucket) => {
        confirmAction("Delete Bucket", `Delete bucket "${bucket.name}" and all files?`, async () => {
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
            await (sdk as any).updateDeployment(selectedFunction.$id, depId);
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

    // -- Backups --
    const handleDeleteBackup = (file: Models.File) => {
        confirmAction("Delete Snapshot", `Delete snapshot "${file.name}"?`, async () => {
            const storage = getSdkStorage(activeProject);
            await storage.deleteFile(BACKUP_BUCKET_ID, file.$id);
            refreshData();
        });
    };

    const handleRestoreBackup = (file: Models.File) => {
        confirmAction("Restore Snapshot", `Restore project state from "${file.name}"? This will attempt to recreate infrastructure exactly.`, async () => {
            const service = new BackupService(activeProject, logCallback);
            await service.runRestore(file.$id);
            refreshData();
        });
    };

    return {
        handleCreateDatabase, handleDeleteDatabase, handleCopyDatabaseSchema,
        handleCreateCollection, handleUpdateCollectionSettings, handleDeleteCollection,
        handleCreateDocument, handleUpdateDocument, handleDeleteDocument,
        handleCreateAttribute, handleUpdateAttribute, handleDeleteAttribute, handleCreateIndex, handleUpdateIndex, handleDeleteIndex,
        handleCreateBucket, handleDeleteBucket, handleDeleteFile,
        handleDeleteFunction, handleActivateDeployment, handleBulkDeleteDeployments,
        handleDeleteBackup, handleRestoreBackup
    };
}
