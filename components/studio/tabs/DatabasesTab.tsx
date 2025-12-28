
import React, { useState, useEffect } from 'react';
import type { Database, AppwriteProject } from '../../../types';
import type { Models } from 'node-appwrite';
import { ResourceTable } from '../ui/ResourceTable';
import { Breadcrumb } from '../ui/Breadcrumb';
import { CollectionSettings } from '../CollectionSettings';
import { DatabaseIcon, FileIcon, KeyIcon, SettingsIcon, ChevronDownIcon, ExternalLinkIcon, EyeIcon, RiLayoutMasonryLine } from '../../Icons';
import { CopyButton } from '../ui/CopyButton';
import { consoleLinks } from '../../../services/appwrite';

type CollectionTab = 'documents' | 'attributes' | 'indexes' | 'settings';

interface DatabasesTabProps {
    activeProject: AppwriteProject;
    databases: Database[];
    selectedDb: Database | null;
    selectedCollection: Models.Collection | null;
    collections: Models.Collection[];
    documents: Models.Document[];
    attributes: any[];
    indexes: any[];
    
    onCreateDatabase: () => void;
    onDeleteDatabase: (db: Database) => void;
    onSelectDb: (db: Database | null) => void;
    
    onCreateCollection: () => void;
    onDeleteCollection: (coll: Models.Collection) => void;
    onSelectCollection: (coll: Models.Collection | null) => void;
    
    onCreateDocument: () => void;
    onUpdateDocument: (doc: Models.Document) => void;
    onDeleteDocument: (doc: Models.Document) => void;
    onViewDocument: (doc: Models.Document) => void;
    
    onCreateAttribute: (type: string) => void;
    onUpdateAttribute: (attr: any) => void;
    onDeleteAttribute: (attr: any) => void;
    
    onCreateIndex: () => void;
    onDeleteIndex: (idx: any) => void;
    
    onUpdateCollectionSettings: (data: any) => Promise<void>;
}

export const DatabasesTab: React.FC<DatabasesTabProps> = ({
    activeProject, databases, selectedDb, selectedCollection, collections,
    documents, attributes, indexes,
    onCreateDatabase, onDeleteDatabase, onSelectDb,
    onCreateCollection, onDeleteCollection, onSelectCollection,
    onCreateDocument, onUpdateDocument, onDeleteDocument, onViewDocument,
    onCreateAttribute, onUpdateAttribute, onDeleteAttribute,
    onCreateIndex, onDeleteIndex,
    onUpdateCollectionSettings
}) => {
    const [collectionTab, setCollectionTab] = useState<CollectionTab>('documents');
    const [attributeType, setAttributeType] = useState<string>('string');
    const [allowWrap, setAllowWrap] = useState(false);

    // Reset tab when collection changes
    useEffect(() => {
        setCollectionTab('documents');
    }, [selectedCollection?.$id]);

    const wrapToggle = (
        <button 
            onClick={() => setAllowWrap(!allowWrap)}
            title={allowWrap ? "Switch to Compact View" : "Switch to Full wrapping View"}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${allowWrap ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300'}`}
        >
            <RiLayoutMasonryLine size={14} /> {allowWrap ? 'Full View' : 'Compact'}
        </button>
    );

    if (!selectedDb) {
        return (
            <ResourceTable<Database> 
                title="Databases" 
                data={databases} 
                onCreate={onCreateDatabase} 
                onDelete={onDeleteDatabase} 
                onSelect={(item) => onSelectDb(item)} 
                createLabel="New DB" 
                headers={['Actions', 'Database ID', 'Name', 'Status']}
                extraActions={
                    <a 
                        href={consoleLinks.databases(activeProject)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all mr-2"
                    >
                        <ExternalLinkIcon size={14} /> Open in Console
                    </a>
                }
                renderExtra={(db) => (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${db.enabled ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                        {db.enabled ? 'Active' : 'Disabled'}
                    </span>
                )}
            />
        );
    }

    if (!selectedCollection) {
        return (
            <>
                <div className="flex justify-between items-start">
                    <Breadcrumb items={[{ label: 'Databases', onClick: () => onSelectDb(null) }, { label: selectedDb.name }]} />
                    <a 
                        href={consoleLinks.database(activeProject, selectedDb.$id)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                    >
                        <ExternalLinkIcon size={14} /> View Database in Console
                    </a>
                </div>
                <ResourceTable<Models.Collection> 
                    title={`Collections in ${selectedDb.name}`} 
                    data={collections} 
                    onCreate={onCreateCollection} 
                    onDelete={onDeleteCollection} 
                    onSelect={onSelectCollection} 
                    createLabel="New Collection" 
                    headers={['Actions', 'Collection ID', 'Name', 'Status']}
                    renderExtra={(c) => (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${c.enabled ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                            {c.enabled ? 'Active' : 'Disabled'}
                        </span>
                    )}
                />
            </>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="mb-6">
                <div className="flex justify-between items-start">
                    <Breadcrumb items={[{ label: 'Databases', onClick: () => onSelectDb(null) }, { label: selectedDb.name, onClick: () => onSelectCollection(null) }, { label: selectedCollection.name }]} />
                    <a 
                        href={consoleLinks.collection(activeProject, selectedDb.$id, selectedCollection.$id)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                    >
                        <ExternalLinkIcon size={14} /> View Collection in Console
                    </a>
                </div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-900/30 rounded-lg text-cyan-400"><DatabaseIcon size={24} /></div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-100">{selectedCollection.name}</h1>
                            <div className="flex items-center gap-2 text-xs font-mono text-gray-500 group">
                                {selectedCollection.$id}
                                <CopyButton text={selectedCollection.$id} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                        {!selectedCollection.enabled && <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-red-900/30 text-red-400 border border-red-900/50 uppercase font-bold">Disabled</span>}
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b border-gray-800">
                    {[
                        { id: 'documents', label: 'Documents', icon: <FileIcon size={14} /> },
                        { id: 'attributes', label: 'Attributes', icon: <DatabaseIcon size={14} /> },
                        { id: 'indexes', label: 'Indexes', icon: <KeyIcon size={14} /> },
                        { id: 'settings', label: 'Settings', icon: <SettingsIcon size={14} /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setCollectionTab(tab.id as CollectionTab)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${collectionTab === tab.id ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1">
                {collectionTab === 'documents' && (
                    <ResourceTable<Models.Document> 
                        data={documents} 
                        onCreate={onCreateDocument} 
                        onDelete={onDeleteDocument} 
                        onEdit={onUpdateDocument}
                        onSelect={onViewDocument} 
                        createLabel="Add Document" 
                        allowWrap={allowWrap}
                        headers={['Actions', 'Document ID', 'Data Payload', 'Created At']}
                        extraActions={wrapToggle}
                        renderName={(doc) => {
                             const { $id, $collectionId, $databaseId, $createdAt, $updatedAt, $permissions, ...rest } = doc;
                             return <span className="font-mono text-xs text-gray-400 block">{JSON.stringify(rest)}</span>;
                        }} 
                        renderExtra={(doc) => (
                             <span className="text-[10px] text-gray-600 font-mono">
                                {new Date(doc.$createdAt).toLocaleString()}
                             </span>
                        )}
                        renderExtraActions={(doc) => (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onViewDocument(doc); }}
                                className="p-1.5 text-gray-500 hover:text-cyan-400 hover:bg-gray-800 rounded transition-colors"
                                title="Quick Preview"
                            >
                                <EyeIcon size={16} />
                            </button>
                        )}
                    />
                )}

                {collectionTab === 'attributes' && (
                    <ResourceTable<any> 
                        data={attributes} 
                        onDelete={(item) => onDeleteAttribute(item)} 
                        onEdit={onUpdateAttribute}
                        onCreate={() => onCreateAttribute(attributeType)}
                        createLabel="Add Attribute"
                        allowWrap={allowWrap}
                        headers={['Actions', 'Key', 'Data Type', 'Config & Status']}
                        extraActions={
                            <div className="flex items-center gap-2 mr-2">
                                {wrapToggle}
                                <div className="relative">
                                    <select 
                                        value={attributeType} 
                                        onChange={e => setAttributeType(e.target.value)}
                                        className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-cyan-500 appearance-none pr-8 cursor-pointer"
                                    >
                                        <option value="string">String</option>
                                        <option value="integer">Integer</option>
                                        <option value="float">Float</option>
                                        <option value="boolean">Boolean</option>
                                        <option value="email">Email</option>
                                        <option value="url">URL</option>
                                        <option value="ip">IP</option>
                                        <option value="enum">Enum</option>
                                        <option value="datetime">Datetime</option>
                                        <option value="relationship">Relationship</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-gray-500">
                                        <ChevronDownIcon size={12} />
                                    </div>
                                </div>
                            </div>
                        }
                        renderName={(item) => (
                            <span className="px-2 py-0.5 bg-gray-900 border border-gray-700 rounded text-[11px] font-mono text-cyan-300 uppercase tracking-tight">
                                {item.type}
                            </span>
                        )} 
                        renderExtra={(item) => (
                            <div className="flex flex-wrap gap-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${item.required ? 'bg-red-900/30 text-red-400 border border-red-900/20' : 'bg-gray-800 text-gray-500'}`}>
                                    {item.required ? 'Required' : 'Optional'}
                                </span>
                                {item.array && (
                                    <span className="text-[10px] bg-blue-900/30 text-blue-400 border border-blue-900/20 px-1.5 py-0.5 rounded font-bold uppercase">
                                        Array
                                    </span>
                                )}
                                {item.default !== undefined && item.default !== null && (
                                    <span className="text-[10px] text-gray-600 italic">Def: {String(item.default)}</span>
                                )}
                            </div>
                        )}
                    />
                )}

                {collectionTab === 'indexes' && (
                    <ResourceTable<any> 
                        data={indexes} 
                        onDelete={(item) => onDeleteIndex(item)} 
                        onCreate={onCreateIndex} 
                        createLabel="Add Index"
                        allowWrap={allowWrap}
                        headers={['Actions', 'Index Key', 'Type', 'Attributes (IDs)']}
                        extraActions={wrapToggle}
                        renderName={(item) => (
                            <span className="px-2 py-0.5 bg-gray-900 border border-gray-700 rounded text-[11px] font-mono text-yellow-300 uppercase tracking-tight">
                                {item.type}
                            </span>
                        )} 
                        renderExtra={(item) => (
                            <div className="flex flex-wrap gap-1">
                                {item.attributes.map((attrId: string) => (
                                    <span key={attrId} className="px-1.5 py-0.5 bg-gray-900 border border-gray-700 rounded text-[10px] font-mono text-gray-400">
                                        {attrId}
                                    </span>
                                ))}
                            </div>
                        )}
                    />
                )}

                {collectionTab === 'settings' && (
                    <CollectionSettings collection={selectedCollection} onUpdate={onUpdateCollectionSettings} onDelete={onDeleteCollection} />
                )}
            </div>
        </div>
    );
};
