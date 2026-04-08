
import { ID, Query } from '../../../services/appwrite';
import { getSdkDatabases, getSdkStorage, getSdkFunctions, getSdkUsers, getSdkTeams, normalizeEndpoint } from '../../../services/appwrite';
import type { AppwriteProject, Database, Bucket, AppwriteFunction } from '../../../types';
import type { Models } from 'node-appwrite';
import type { FormField } from '../types';
import { deployCodeFromString, downloadAndUnpackDeployment } from '../../../tools/functionsTools';
import React from 'react';
import { DocumentEditor } from '../ui/DocumentEditor';
import { DocumentCreateForm } from '../ui/DocumentCreateForm';
import { BulkEditDocumentModal } from '../ui/BulkEditDocumentModal';
import { CodeIcon, CheckIcon, CopyIcon, WarningIcon } from '../../Icons';
import { BACKUP_BUCKET_ID, BackupService } from '../../../services/backupService';
import type { ToastActions } from '../../../hooks/useToast';

export function useStudioActions(
    activeProject: AppwriteProject,
    data: any, // Result of useStudioData
    modals: any, // Result of useStudioModals
    refreshData: () => void,
    logCallback: (msg: string) => void,
    toast?: ToastActions
) {
    const { 
        selectedDb, setSelectedDb, selectedCollection, setSelectedCollection,
        selectedBucket, setSelectedBucket, selectedFunction, setSelectedFunction, selectedTeam,
        attributes,
        usersPagination, teamsPagination, collectionsPagination, documentsPagination,
        filesPagination, deploymentsPagination, executionsPagination, membershipsPagination,
        fetchCollectionMeta, fetchVariables,
    } = data;

    // Compatibility wrappers — translate old fetchX(id) calls into pagination .refresh() calls.
    // This avoids rewriting 40+ call sites. The pagination hooks auto-fetch based on selection state.
    const fetchUsers = () => usersPagination.refresh();
    const fetchTeams = () => teamsPagination.refresh();
    const fetchCollections = (_dbId?: string) => collectionsPagination.refresh();
    const fetchCollectionDetails = (_dbId?: string, _collId?: string) => {
        documentsPagination.refresh();
        if (selectedDb && selectedCollection) fetchCollectionMeta(selectedDb.$id, selectedCollection.$id);
    };
    const fetchFiles = (_bucketId?: string) => filesPagination.refresh();
    const fetchFunctionDetails = (_funcId?: string) => {
        deploymentsPagination.refresh();
        executionsPagination.refresh();
        if (selectedFunction) fetchVariables(selectedFunction.$id);
    };
    const fetchMemberships = (_teamId?: string) => membershipsPagination.refresh();
    
    // Current items from pagination (for code that reads the current page)
    const executions = executionsPagination.items;

    const { confirmAction, openForm, setModalLoading, setModal, openCustomModal, closeModal } = modals;

    // Helper to show feedback
    const notify = {
        success: (msg: string) => { toast?.success(msg); logCallback(`Studio: ${msg}`); },
        error: (msg: string) => { toast?.error(msg); logCallback(`❌ ${msg}`); },
        info: (msg: string) => { toast?.info(msg); logCallback(`Studio: ${msg}`); },
        warning: (msg: string) => { toast?.warning(msg); logCallback(`⚠️ ${msg}`); },
    };

    // ============================================================================
    // DATABASE ACTIONS
    // ============================================================================

    const handleCreateDatabase = () => {
        openForm("Create Database", [
            { name: 'databaseId', label: 'Database ID', defaultValue: 'unique()', required: true, placeholder: 'unique() or custom_id', description: 'Enter "unique()" to auto-generate.' },
            { name: 'name', label: 'Database Name', required: true }
        ], async (formData: any) => {
            const id = formData.databaseId === 'unique()' ? ID.unique() : formData.databaseId;
            await getSdkDatabases(activeProject).create(id, formData.name);
            refreshData();
            notify.success(`Database "${formData.name}" created.`);
        });
    };

    const handleDeleteDatabase = (db: Database) => {
        confirmAction("Delete Database", `Are you sure you want to delete "${db.name}"? This cannot be undone.`, async () => {
            await getSdkDatabases(activeProject).delete(db.$id);
            refreshData();
            notify.success(`Database "${db.name}" deleted.`);
        });
    };

    const handleRenameDatabase = (db: Database) => {
        openForm("Rename Database", [
            { name: 'name', label: 'New Name', defaultValue: db.name, required: true }
        ], async (formData: any) => {
            await getSdkDatabases(activeProject).update(db.$id, formData.name);
            refreshData();
            notify.success(`Database renamed to "${formData.name}".`);
        }, "Rename");
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
                                notify.success("Schema copied to clipboard.");
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
            notify.error(`Failed to generate schema: ${e.message}`);
        } finally {
            setModalLoading(false);
        }
    };

    // ============================================================================
    // COLLECTION ACTIONS
    // ============================================================================

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
            notify.success(`Collection "${formData.name}" created.`);
        });
    };

    const handleUpdateCollectionSettings = async (formData: any) => {
        if (!selectedDb || !selectedCollection) return;
        const permsArray = formData.permissions ? formData.permissions.split(',').map((p: string) => p.trim()).filter(Boolean) : [];
        const sdk = getSdkDatabases(activeProject);
        const updated = await sdk.updateCollection(selectedDb.$id, selectedCollection.$id, formData.name, permsArray, formData.documentSecurity, formData.enabled);
        setSelectedCollection(updated);
        notify.success(`Collection settings updated.`);
    };

    const handleDeleteCollection = (coll: Models.Collection) => {
        if (!selectedDb) return;
        confirmAction("Delete Collection", `Delete collection "${coll.name}"? This is permanent and deletes all contained documents.`, async () => {
            await getSdkDatabases(activeProject).deleteCollection(selectedDb.$id, coll.$id);
            fetchCollections(selectedDb.$id);
            setSelectedCollection(null);
            notify.success(`Collection "${coll.name}" deleted.`);
        });
    };

    // ============================================================================
    // DOCUMENT ACTIONS
    // ============================================================================

    const handleCreateDocument = () => {
        if (!selectedDb || !selectedCollection) return;

        openCustomModal(
            `Add to ${selectedCollection.name}`,
            React.createElement(DocumentCreateForm, {
                attributes: attributes,
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
                    notify.success(`Document created in ${selectedCollection.name}.`);
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
                    notify.success(`Document ${doc.$id} updated.`);
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
            notify.success(`Document deleted.`);
        });
    };

    const handleBulkUpdateDocuments = (documentIds: string[]) => {
        if (!selectedDb || !selectedCollection || documentIds.length === 0) return;

        openCustomModal(
            `Bulk Edit: ${documentIds.length} Documents`,
            React.createElement(BulkEditDocumentModal, {
                attributes: attributes,
                count: documentIds.length,
                onCancel: closeModal,
                onSave: async (patchData: any) => {
                    notify.info(`Starting bulk update on ${documentIds.length} documents...`);
                    const sdk = getSdkDatabases(activeProject);
                    let successCount = 0;
                    let errorCount = 0;

                    const updatePromises = documentIds.map(async (id) => {
                        try {
                            await sdk.updateDocument(selectedDb.$id, selectedCollection.$id, id, patchData);
                            successCount++;
                        } catch (e: any) {
                            errorCount++;
                            console.error(`Failed to update ${id}`, e);
                        }
                    });

                    await Promise.all(updatePromises);
                    
                    notify.success(`Bulk update: ${successCount} updated, ${errorCount} failed.`);
                    fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
                    closeModal();
                }
            }),
            '2xl'
        );
    };

    const handleBulkDeleteDocuments = (documentIds: string[]) => {
        if (!selectedDb || !selectedCollection || documentIds.length === 0) return;

        confirmAction("Delete Documents", `Are you sure you want to delete ${documentIds.length} documents? This action cannot be undone.`, async () => {
            const sdk = getSdkDatabases(activeProject);
            notify.info(`Deleting ${documentIds.length} documents...`);
            
            let deletedCount = 0;
            let errorCount = 0;

            const promises = documentIds.map(async (id) => {
                try {
                    await sdk.deleteDocument(selectedDb.$id, selectedCollection.$id, id);
                    deletedCount++;
                } catch (e) {
                    errorCount++;
                    console.error(`Failed to delete document ${id}`, e);
                }
            });

            await Promise.all(promises);
            notify.success(`Bulk delete: ${deletedCount} deleted, ${errorCount} failed.`);
            fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
        });
    };

    // ============================================================================
    // ATTRIBUTE & INDEX ACTIONS
    // ============================================================================

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
        const onFinish = () => { fetchCollectionDetails(dbId, collId); notify.success(`Attribute created.`); };
        const getSafeDefault = (d: any) => d.required ? null : (d.default || null);

        switch (type) {
            case 'string':
                openForm("Create String Attribute", [...baseFields, { name: 'size', label: 'Size', type: 'number', defaultValue: 255, required: true }, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createStringAttribute(dbId, collId, d.key, Number(d.size), d.required, getSafeDefault(d), d.array);
                    onFinish();
                });
                break;
            case 'integer':
                openForm("Create Integer Attribute", [...baseFields, { name: 'min', label: 'Min', type: 'number' }, { name: 'max', label: 'Max', type: 'number' }, { name: 'default', label: 'Default', type: 'number' }], async (d: any) => {
                    const def = d.default !== "" ? Number(d.default) : undefined;
                    const safeDef = d.required ? null : def;
                    await sdk.createIntegerAttribute(dbId, collId, d.key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, safeDef, d.array);
                    onFinish();
                });
                break;
            case 'boolean':
                openForm("Create Boolean Attribute", [...baseFields, { name: 'default', label: 'Default', type: 'checkbox', defaultValue: false }], async (d: any) => {
                    const safeDef = d.required ? null : d.default;
                    await sdk.createBooleanAttribute(dbId, collId, d.key, d.required, safeDef, d.array);
                    onFinish();
                });
                break;
            case 'float':
                openForm("Create Float Attribute", [...baseFields, { name: 'min', label: 'Min', type: 'number' }, { name: 'max', label: 'Max', type: 'number' }, { name: 'default', label: 'Default', type: 'number' }], async (d: any) => {
                    const def = d.default !== "" ? Number(d.default) : undefined;
                    const safeDef = d.required ? null : def;
                    await sdk.createFloatAttribute(dbId, collId, d.key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, safeDef, d.array);
                    onFinish();
                });
                break;
            case 'email':
                openForm("Create Email Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createEmailAttribute(dbId, collId, d.key, d.required, getSafeDefault(d), d.array);
                    onFinish();
                });
                break;
            case 'url':
                openForm("Create URL Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createUrlAttribute(dbId, collId, d.key, d.required, getSafeDefault(d), d.array);
                    onFinish();
                });
                break;
            case 'ip':
                openForm("Create IP Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createIpAttribute(dbId, collId, d.key, d.required, getSafeDefault(d), d.array);
                    onFinish();
                });
                break;
            case 'datetime':
                openForm("Create Datetime Attribute", [...baseFields, { name: 'default', label: 'Default' }], async (d: any) => {
                    await sdk.createDatetimeAttribute(dbId, collId, d.key, d.required, getSafeDefault(d), d.array);
                    onFinish();
                });
                break;
            case 'enum':
                openForm("Create Enum Attribute", [...baseFields, { name: 'elements', label: 'Elements (Comma Separated)', type: 'textarea', required: true }, { name: 'default', label: 'Default' }], async (d: any) => {
                    const els = d.elements.split(',').map((s: string) => s.trim()).filter(Boolean);
                    await sdk.createEnumAttribute(dbId, collId, d.key, els, d.required, getSafeDefault(d), d.array);
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
        const onFinish = () => { fetchCollectionDetails(dbId, collId); notify.success(`Attribute "${oldKey}" updated.`); };
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
            const getSafeDefault = (val: any) => d.required ? null : (val || null);

            const performUpdate = async () => {
                if (needsRecreate) {
                    logCallback(`Studio: Deleting attribute "${oldKey}" from ${collId}...`);
                    await sdk.deleteAttribute(dbId, collId, oldKey);
                    logCallback(`Studio: Waiting for metadata sync...`);
                    await new Promise(r => setTimeout(r, 1000));
                    logCallback(`Studio: Recreating attribute "${d.key}"...`);
                    switch (type) {
                        case 'string': await sdk.createStringAttribute(dbId, collId, d.key, Number(d.size), d.required, getSafeDefault(d.default), d.array); break;
                        case 'integer': {
                            const intDef = d.default !== "" ? Number(d.default) : undefined;
                            await sdk.createIntegerAttribute(dbId, collId, d.key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.required ? null : intDef, d.array); 
                            break;
                        }
                        case 'float': {
                            const floatDef = d.default !== "" ? Number(d.default) : undefined;
                            await sdk.createFloatAttribute(dbId, collId, d.key, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.required ? null : floatDef, d.array); 
                            break;
                        }
                        case 'boolean': await sdk.createBooleanAttribute(dbId, collId, d.key, d.required, d.required ? null : !!d.default, d.array); break;
                        case 'email': await sdk.createEmailAttribute(dbId, collId, d.key, d.required, getSafeDefault(d.default), d.array); break;
                        case 'url': await sdk.createUrlAttribute(dbId, collId, d.key, d.required, getSafeDefault(d.default), d.array); break;
                        case 'ip': await sdk.createIpAttribute(dbId, collId, d.key, d.required, getSafeDefault(d.default), d.array); break;
                        case 'datetime': await sdk.createDatetimeAttribute(dbId, collId, d.key, d.required, getSafeDefault(d.default), d.array); break;
                        case 'enum': {
                            const els = d.elements.split(',').map((s: string) => s.trim()).filter(Boolean);
                            await sdk.createEnumAttribute(dbId, collId, d.key, els, d.required, getSafeDefault(d.default), d.array); 
                            break;
                        }
                    }
                } else {
                    switch (type) {
                        case 'string': await sdk.updateStringAttribute(dbId, collId, oldKey, d.required, getSafeDefault(d.default)); break;
                        case 'integer': {
                            const intDef = d.default !== "" ? Number(d.default) : undefined;
                            await sdk.updateIntegerAttribute(dbId, collId, oldKey, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.required ? null : intDef); 
                            break;
                        }
                        case 'float': {
                            const floatDef = d.default !== "" ? Number(d.default) : undefined;
                            await sdk.updateFloatAttribute(dbId, collId, oldKey, d.required, d.min ? Number(d.min) : undefined, d.max ? Number(d.max) : undefined, d.required ? null : floatDef); 
                            break;
                        }
                        case 'boolean': await sdk.updateBooleanAttribute(dbId, collId, oldKey, d.required, d.required ? null : !!d.default); break;
                        case 'email': await sdk.updateEmailAttribute(dbId, collId, oldKey, d.required, getSafeDefault(d.default)); break;
                        case 'url': await sdk.updateUrlAttribute(dbId, collId, oldKey, d.required, getSafeDefault(d.default)); break;
                        case 'ip': await sdk.updateIpAttribute(dbId, collId, oldKey, d.required, getSafeDefault(d.default)); break;
                        case 'datetime': await sdk.updateDatetimeAttribute(dbId, collId, oldKey, d.required, getSafeDefault(d.default)); break;
                        case 'enum': {
                            const els = d.elements.split(',').map((s: string) => s.trim()).filter(Boolean);
                            await sdk.updateEnumAttribute(dbId, collId, oldKey, els, d.required, getSafeDefault(d.default)); 
                            break;
                        }
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
                return true;
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
            notify.success(`Index "${d.key}" created.`);
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
                notify.success(`Index "${idx.key}" recreated.`);
            });
            return true;
        }, "Stage Recreate");
    };

    const handleDeleteAttribute = (attr: any) => {
        if (!selectedDb || !selectedCollection) return;
        confirmAction("Delete Attribute", `Delete attribute "${attr.key || attr.$id}"? This clears this attribute's data from all documents.`, async () => {
            await getSdkDatabases(activeProject).deleteAttribute(selectedDb.$id, selectedCollection.$id, attr.key || attr.$id);
            fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
            notify.success(`Attribute deleted.`);
        });
    };

    const handleDeleteIndex = (idx: any) => {
        if (!selectedDb || !selectedCollection) return;
        confirmAction("Delete Index", `Delete index "${idx.key}"?`, async () => {
            await getSdkDatabases(activeProject).deleteIndex(selectedDb.$id, selectedCollection.$id, idx.key);
            fetchCollectionDetails(selectedDb.$id, selectedCollection.$id);
            notify.success(`Index deleted.`);
        });
    };

    // ============================================================================
    // STORAGE ACTIONS
    // ============================================================================

    const handleCreateBucket = () => {
        openForm("Create Bucket", [
            { name: 'bucketId', label: 'Bucket ID', defaultValue: 'unique()', required: true },
            { name: 'name', label: 'Bucket Name', required: true }
        ], async (formData: any) => {
            const id = formData.bucketId === 'unique()' ? ID.unique() : formData.bucketId;
            await getSdkStorage(activeProject).createBucket(id, formData.name);
            refreshData();
            notify.success(`Bucket "${formData.name}" created.`);
        });
    };

    const handleDeleteBucket = (bucket: Bucket) => {
        confirmAction("Delete Bucket", `Delete bucket "${bucket.name}" and all files?`, async () => {
            await getSdkStorage(activeProject).deleteBucket(bucket.$id);
            refreshData();
            notify.success(`Bucket "${bucket.name}" deleted.`);
        });
    };

    const handleUpdateBucket = (bucket: Bucket) => {
        openForm("Bucket Settings", [
            { name: 'name', label: 'Bucket Name', defaultValue: bucket.name, required: true },
            { name: 'permissions', label: 'Permissions (Comma Separated)', defaultValue: bucket.$permissions?.join(', ') || '' },
            { name: 'maximumFileSize', label: 'Max File Size (bytes)', type: 'number', defaultValue: bucket.maximumFileSize },
            { name: 'allowedFileExtensions', label: 'Allowed Extensions (Comma Separated)', defaultValue: bucket.allowedFileExtensions?.join(', ') || '' },
            { name: 'fileSecurity', label: 'File Security', type: 'checkbox', defaultValue: bucket.fileSecurity },
            { name: 'enabled', label: 'Enabled', type: 'checkbox', defaultValue: bucket.enabled },
            { name: 'encryption', label: 'Encryption', type: 'checkbox', defaultValue: bucket.encryption },
            { name: 'antivirus', label: 'Antivirus', type: 'checkbox', defaultValue: bucket.antivirus },
        ], async (d: any) => {
            const perms = d.permissions ? d.permissions.split(',').map((p: string) => p.trim()).filter(Boolean) : [];
            const exts = d.allowedFileExtensions ? d.allowedFileExtensions.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
            await getSdkStorage(activeProject).updateBucket(
                bucket.$id, d.name, perms, d.fileSecurity, d.enabled, 
                d.maximumFileSize ? Number(d.maximumFileSize) : undefined, exts, 
                undefined, d.encryption, d.antivirus
            );
            refreshData();
            if (selectedBucket) fetchFiles(selectedBucket.$id);
            notify.success(`Bucket settings updated.`);
        }, "Save Settings");
    };

    const handleUploadFile = async (fileList: FileList) => {
        if (!selectedBucket) return;
        const sdk = getSdkStorage(activeProject);
        const bucketId = selectedBucket.$id;
        let successCount = 0;
        let errorCount = 0;
        
        notify.info(`Uploading ${fileList.length} file(s)...`);
        
        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            try {
                // Use the raw REST API since node-appwrite createFile doesn't handle browser File objects well
                const endpoint = normalizeEndpoint(activeProject.endpoint);
                const formData = new FormData();
                formData.append('fileId', ID.unique());
                formData.append('file', file);
                
                const res = await fetch(`${endpoint}/storage/buckets/${bucketId}/files`, {
                    method: 'POST',
                    headers: {
                        'X-Appwrite-Project': activeProject.projectId,
                        'X-Appwrite-Key': activeProject.apiKey,
                    },
                    body: formData,
                });
                
                if (!res.ok) {
                    const errBody = await res.text();
                    throw new Error(`Upload failed (${res.status}): ${errBody}`);
                }
                successCount++;
            } catch (e: any) {
                errorCount++;
                console.error(`Failed to upload ${file.name}`, e);
            }
        }
        
        notify.success(`Upload complete: ${successCount} succeeded, ${errorCount} failed.`);
        fetchFiles(bucketId);
    };

    const handleDownloadFile = async (file: Models.File) => {
        if (!selectedBucket) return;
        try {
            const endpoint = normalizeEndpoint(activeProject.endpoint);
            const url = `${endpoint}/storage/buckets/${selectedBucket.$id}/files/${file.$id}/download?project=${activeProject.projectId}`;
            const res = await fetch(url, {
                headers: {
                    'X-Appwrite-Project': activeProject.projectId,
                    'X-Appwrite-Key': activeProject.apiKey,
                }
            });
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        } catch (e: any) {
            notify.error(`Download failed: ${e.message}`);
        }
    };

    const handlePreviewFile = (file: Models.File) => {
        if (!selectedBucket) return;
        const endpoint = normalizeEndpoint(activeProject.endpoint);
        // For images, use preview endpoint; for others, use view
        const isImage = file.mimeType?.startsWith('image/');
        const url = isImage 
            ? `${endpoint}/storage/buckets/${selectedBucket.$id}/files/${file.$id}/preview?project=${activeProject.projectId}&width=800&height=600`
            : `${endpoint}/storage/buckets/${selectedBucket.$id}/files/${file.$id}/view?project=${activeProject.projectId}`;
        
        openCustomModal(
            file.name,
            React.createElement('div', { className: "space-y-4" },
                React.createElement('div', { className: "flex items-center gap-4 text-xs text-gray-400" },
                    React.createElement('span', null, `Type: ${file.mimeType}`),
                    React.createElement('span', null, `Size: ${(file.sizeOriginal / 1024).toFixed(1)} KB`),
                    React.createElement('span', null, `ID: ${file.$id}`)
                ),
                isImage 
                    ? React.createElement('img', { 
                        src: url, 
                        alt: file.name,
                        className: "max-w-full max-h-[60vh] rounded-lg border border-gray-700 mx-auto",
                        crossOrigin: "anonymous"
                    })
                    : React.createElement('div', { className: "bg-gray-900 rounded-lg border border-gray-700 p-8 text-center" },
                        React.createElement('p', { className: "text-gray-400 mb-4" }, `Preview not available for ${file.mimeType}`),
                        React.createElement('a', { 
                            href: url, 
                            target: '_blank', 
                            rel: 'noopener noreferrer',
                            className: "px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold"
                        }, "Open in New Tab")
                    )
            ),
            '3xl'
        );
    };

    const handleBulkDeleteBuckets = (bucketIds: string[]) => {
        confirmAction("Delete Buckets", `Are you sure you want to delete ${bucketIds.length} buckets? This will permanently delete all files contained within them.`, async () => {
            const sdk = getSdkStorage(activeProject);
            notify.info(`Deleting ${bucketIds.length} buckets...`);
            let deletedCount = 0;
            await Promise.all(bucketIds.map(async (id) => {
                try {
                    await sdk.deleteBucket(id);
                    deletedCount++;
                } catch (e) {
                    console.error(`Failed to delete bucket ${id}`, e);
                }
            }));
            notify.success(`Deleted ${deletedCount} buckets.`);
            refreshData();
        });
    };

    const handleDeleteFile = (file: Models.File) => {
        if (!selectedBucket) return;
        confirmAction("Delete File", `Delete file "${file.name}"?`, async () => {
            await getSdkStorage(activeProject).deleteFile(selectedBucket.$id, file.$id);
            fetchFiles(selectedBucket.$id);
            notify.success(`File "${file.name}" deleted.`);
        });
    };

    const handleBulkDeleteFiles = (fileIds: string[]) => {
        if (!selectedBucket) return;
        confirmAction("Delete Files", `Are you sure you want to delete ${fileIds.length} files?`, async () => {
            const sdk = getSdkStorage(activeProject);
            notify.info(`Deleting ${fileIds.length} files...`);
            let deletedCount = 0;
            await Promise.all(fileIds.map(async (id) => {
                try {
                    await sdk.deleteFile(selectedBucket.$id, id);
                    deletedCount++;
                } catch (e) {
                    console.error(`Failed to delete file ${id}`, e);
                }
            }));
            notify.success(`Deleted ${deletedCount} files.`);
            fetchFiles(selectedBucket.$id);
        });
    };

    // ============================================================================
    // FUNCTIONS ACTIONS
    // ============================================================================

    const handleDeleteFunction = (func: AppwriteFunction) => {
        confirmAction("Delete Function", `Delete function "${func.name}"?`, async () => {
            await getSdkFunctions(activeProject).delete(func.$id);
            refreshData();
            notify.success(`Function "${func.name}" deleted.`);
        });
    };

    const handleActivateDeployment = (depId: string) => {
        if (!selectedFunction) return;
        confirmAction("Activate Deployment", "Activate this deployment?", async () => {
            const sdk = getSdkFunctions(activeProject);
            await sdk.updateFunctionDeployment(selectedFunction.$id, depId);
            // Re-fetch the function object so selectedFunction.deploymentId reflects the new active deployment
            const updatedFunc = await sdk.get(selectedFunction.$id);
            setSelectedFunction(updatedFunc as unknown as AppwriteFunction);
            fetchFunctionDetails(selectedFunction.$id);
            notify.success(`Deployment activated.`);
        });
    };

    const handleBulkDeleteDeployments = (deploymentIds: string[]) => {
        if (!selectedFunction) return;
        confirmAction("Delete Deployments", `Delete ${deploymentIds.length} deployments?`, async () => {
            const sdk = getSdkFunctions(activeProject);
            await Promise.all(deploymentIds.map(id => sdk.deleteDeployment(selectedFunction.$id, id)));
            fetchFunctionDetails(selectedFunction.$id);
            notify.success(`${deploymentIds.length} deployments deleted.`);
        });
    };

    const handleCreateVariable = () => {
        if (!selectedFunction) return;
        openForm("Create Variable", [
            { name: 'key', label: 'Key', required: true },
            { name: 'value', label: 'Value', required: true }
        ], async (d: any) => {
            await getSdkFunctions(activeProject).createVariable(selectedFunction.$id, d.key, d.value);
            fetchFunctionDetails(selectedFunction.$id);
            notify.success(`Variable "${d.key}" created.`);
        });
    };

    const handleUpdateVariable = (variable: Models.Variable) => {
        if (!selectedFunction) return;
        openForm(`Edit Variable: ${variable.key}`, [
            { name: 'key', label: 'Key', defaultValue: variable.key, required: true },
            { name: 'value', label: 'Value', defaultValue: variable.value, required: true }
        ], async (d: any) => {
            await getSdkFunctions(activeProject).updateVariable(selectedFunction.$id, variable.$id, d.key, d.value);
            fetchFunctionDetails(selectedFunction.$id);
            notify.success(`Variable "${d.key}" updated.`);
        }, "Update");
    };

    const handleDeleteVariable = (variable: Models.Variable) => {
        if (!selectedFunction) return;
        confirmAction("Delete Variable", `Delete variable "${variable.key}"?`, async () => {
            await getSdkFunctions(activeProject).deleteVariable(selectedFunction.$id, variable.$id);
            fetchFunctionDetails(selectedFunction.$id);
            notify.success(`Variable deleted.`);
        });
    };

    const handleExecuteFunction = () => {
        if (!selectedFunction) return;
        openForm("Execute Function", [
            { name: 'body', label: 'Request Body (JSON)', type: 'textarea', defaultValue: '{}' },
            { name: 'path', label: 'Path', defaultValue: '/' },
            { name: 'method', label: 'Method', type: 'select', defaultValue: 'POST', options: [
                {label: 'GET', value: 'GET'}, {label: 'POST', value: 'POST'}, {label: 'PUT', value: 'PUT'}, 
                {label: 'PATCH', value: 'PATCH'}, {label: 'DELETE', value: 'DELETE'}
            ]},
            { name: 'async', label: 'Async Execution', type: 'checkbox', defaultValue: false }
        ], async (d: any) => {
            notify.info(`Executing function "${selectedFunction.name}"...`);
            const sdk = getSdkFunctions(activeProject);
            const execution = await sdk.createExecution(
                selectedFunction.$id, 
                d.body || '', 
                d.async,
                d.path || '/',
                d.method || 'POST'
            );
            fetchFunctionDetails(selectedFunction.$id);
            if (d.async) {
                notify.success(`Async execution started (${execution.$id}).`);
            } else {
                const status = execution.status === 'completed' ? 'success' : 'error';
                if (status === 'success') {
                    notify.success(`Execution completed in ${execution.duration.toFixed(3)}s.`);
                } else {
                    notify.error(`Execution failed: ${execution.responseBody?.substring(0, 200) || 'Unknown error'}`);
                }
            }
        }, "Execute");
    };

    const handleUpdateFunction = (func: AppwriteFunction) => {
        openForm(`Edit Function: ${func.name}`, [
            { name: 'name', label: 'Name', defaultValue: func.name, required: true },
            { name: 'enabled', label: 'Enabled', type: 'checkbox', defaultValue: func.enabled },
            { name: 'timeout', label: 'Timeout (seconds)', type: 'number', defaultValue: func.timeout },
            { name: 'entrypoint', label: 'Entrypoint', defaultValue: func.entrypoint },
            { name: 'commands', label: 'Build Commands', defaultValue: func.commands },
            { name: 'schedule', label: 'CRON Schedule', defaultValue: func.schedule, description: 'Leave empty for no scheduled execution.' },
        ], async (d: any) => {
            await getSdkFunctions(activeProject).update(
                func.$id, d.name, undefined, undefined, undefined, 
                d.schedule || undefined, d.timeout ? Number(d.timeout) : undefined, d.enabled, undefined,
                d.entrypoint || undefined, d.commands || undefined
            );
            refreshData();
            if (selectedFunction) fetchFunctionDetails(selectedFunction.$id);
            notify.success(`Function "${d.name}" updated.`);
        }, "Update");
    };

    // ============================================================================
    // USER ACTIONS
    // ============================================================================

    const handleCreateUser = () => {
        openForm("Create User", [
            { name: 'userId', label: 'User ID', defaultValue: 'unique()', required: true },
            { name: 'email', label: 'Email', required: true },
            { name: 'password', label: 'Password', type: 'password', required: true, description: 'Minimum 8 characters.' },
            { name: 'name', label: 'Name' },
            { name: 'phone', label: 'Phone', description: 'International format, e.g. +1234567890' }
        ], async (d: any) => {
            const id = d.userId === 'unique()' ? ID.unique() : d.userId;
            await getSdkUsers(activeProject).create(id, d.email, d.phone || undefined, d.password, d.name || undefined);
            fetchUsers();
            notify.success(`User "${d.email}" created.`);
        });
    };

    const handleDeleteUser = (user: Models.User<any>) => {
        confirmAction("Delete User", `Permanently delete user "${user.name || user.email}"? This cannot be undone.`, async () => {
            await getSdkUsers(activeProject).delete(user.$id);
            fetchUsers();
            notify.success(`User deleted.`);
        });
    };

    const handleUpdateUserStatus = (user: Models.User<any>) => {
        const newStatus = !user.status;
        confirmAction(
            newStatus ? "Activate User" : "Block User",
            `${newStatus ? 'Activate' : 'Block'} user "${user.name || user.email}"?`,
            async () => {
                await getSdkUsers(activeProject).updateStatus(user.$id, newStatus);
                fetchUsers();
                notify.success(`User ${newStatus ? 'activated' : 'blocked'}.`);
            }
        );
    };

    const handleUpdateUserLabels = (user: Models.User<any>) => {
        openForm(`Edit Labels: ${user.name || user.email}`, [
            { name: 'labels', label: 'Labels (Comma Separated)', defaultValue: user.labels?.join(', ') || '', description: 'e.g. admin, premium, beta' }
        ], async (d: any) => {
            const labels = d.labels ? d.labels.split(',').map((l: string) => l.trim()).filter(Boolean) : [];
            await getSdkUsers(activeProject).updateLabels(user.$id, labels);
            fetchUsers();
            notify.success(`Labels updated.`);
        }, "Update Labels");
    };

    const handleUpdateUserName = (user: Models.User<any>) => {
        openForm(`Rename User`, [
            { name: 'name', label: 'Name', defaultValue: user.name || '', required: true }
        ], async (d: any) => {
            await getSdkUsers(activeProject).updateName(user.$id, d.name);
            fetchUsers();
            notify.success(`User name updated.`);
        }, "Update");
    };

    const handleUpdateUserEmail = (user: Models.User<any>) => {
        openForm(`Update Email`, [
            { name: 'email', label: 'Email', defaultValue: user.email || '', required: true }
        ], async (d: any) => {
            await getSdkUsers(activeProject).updateEmail(user.$id, d.email);
            fetchUsers();
            notify.success(`User email updated.`);
        }, "Update");
    };

    const handleVerifyUserEmail = (user: Models.User<any>) => {
        const newState = !user.emailVerification;
        confirmAction(
            newState ? "Verify Email" : "Unverify Email",
            `Set email verification to ${newState ? 'verified' : 'unverified'} for "${user.email}"?`,
            async () => {
                await getSdkUsers(activeProject).updateEmailVerification(user.$id, newState);
                fetchUsers();
                notify.success(`Email verification ${newState ? 'enabled' : 'disabled'}.`);
            }
        );
    };

    // ============================================================================
    // TEAM ACTIONS
    // ============================================================================

    const handleCreateTeam = () => {
        openForm("Create Team", [
            { name: 'teamId', label: 'Team ID', defaultValue: 'unique()', required: true },
            { name: 'name', label: 'Team Name', required: true }
        ], async (d: any) => {
            const id = d.teamId === 'unique()' ? ID.unique() : d.teamId;
            await getSdkTeams(activeProject).create(id, d.name);
            fetchTeams();
            notify.success(`Team "${d.name}" created.`);
        });
    };

    const handleDeleteTeam = (team: Models.Team<any>) => {
        confirmAction("Delete Team", `Delete team "${team.name}" and all memberships?`, async () => {
            await getSdkTeams(activeProject).delete(team.$id);
            fetchTeams();
            notify.success(`Team "${team.name}" deleted.`);
        });
    };

    const handleCreateMembership = () => {
        if (!selectedTeam) return;
        openForm("Add Member", [
            { name: 'email', label: 'Email', required: true },
            { name: 'roles', label: 'Roles (Comma Separated)', defaultValue: 'member', required: true },
            { name: 'name', label: 'Name' }
        ], async (d: any) => {
            const roles = d.roles.split(',').map((r: string) => r.trim()).filter(Boolean);
            await getSdkTeams(activeProject).createMembership(selectedTeam.$id, roles, 'http://localhost', d.email, undefined, undefined,  d.name || undefined);
            fetchMemberships(selectedTeam.$id);
            notify.success(`Membership invitation sent to ${d.email}.`);
        });
    };

    const handleDeleteMembership = (membership: Models.Membership) => {
        if (!selectedTeam) return;
        confirmAction("Remove Member", `Remove "${membership.userName || membership.userEmail}" from team?`, async () => {
            await getSdkTeams(activeProject).deleteMembership(selectedTeam.$id, membership.$id);
            fetchMemberships(selectedTeam.$id);
            notify.success(`Member removed.`);
        });
    };

    const handleRenameTeam = (team: Models.Team<any>) => {
        openForm("Rename Team", [
            { name: 'name', label: 'Team Name', defaultValue: team.name, required: true }
        ], async (d: any) => {
            await getSdkTeams(activeProject).updateName(team.$id, d.name);
            fetchTeams();
            notify.success(`Team renamed to "${d.name}".`);
        }, "Rename");
    };

    // ============================================================================
    // BACKUP ACTIONS
    // ============================================================================

    const handleDeleteBackup = (file: Models.File) => {
        confirmAction("Delete Snapshot", `Delete snapshot "${file.name}"?`, async () => {
            const storage = getSdkStorage(activeProject);
            await storage.deleteFile(BACKUP_BUCKET_ID, file.$id);
            refreshData();
            notify.success(`Snapshot deleted.`);
        });
    };

    const handleRestoreBackup = (file: Models.File) => {
        confirmAction("Restore Snapshot", `Restore project state from "${file.name}"? This will attempt to recreate infrastructure exactly.`, async () => {
            const service = new BackupService(activeProject, logCallback);
            await service.runRestore(file.$id);
            refreshData();
            notify.success(`Restore complete.`);
        });
    };

    return {
        // Database
        handleCreateDatabase, handleDeleteDatabase, handleRenameDatabase, handleCopyDatabaseSchema,
        // Collection
        handleCreateCollection, handleUpdateCollectionSettings, handleDeleteCollection,
        // Documents
        handleCreateDocument, handleUpdateDocument, handleDeleteDocument, handleBulkUpdateDocuments, handleBulkDeleteDocuments,
        // Attributes & Indexes
        handleCreateAttribute, handleUpdateAttribute, handleDeleteAttribute, handleCreateIndex, handleUpdateIndex, handleDeleteIndex,
        // Storage
        handleCreateBucket, handleDeleteBucket, handleUpdateBucket, handleBulkDeleteBuckets, 
        handleDeleteFile, handleBulkDeleteFiles, handleUploadFile, handleDownloadFile, handlePreviewFile,
        // Functions
        handleDeleteFunction, handleActivateDeployment, handleBulkDeleteDeployments,
        handleCreateVariable, handleUpdateVariable, handleDeleteVariable, handleExecuteFunction, handleUpdateFunction,
        // Users
        handleCreateUser, handleDeleteUser, handleUpdateUserStatus, handleUpdateUserLabels, 
        handleUpdateUserName, handleUpdateUserEmail, handleVerifyUserEmail,
        // Teams
        handleCreateTeam, handleDeleteTeam, handleCreateMembership, handleDeleteMembership, handleRenameTeam,
        // Backups
        handleDeleteBackup, handleRestoreBackup
    };
}
