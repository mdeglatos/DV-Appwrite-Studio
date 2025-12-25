
import React, { useState, useEffect } from 'react';
import type { Database, AppwriteProject } from '../../../types';
import type { Models } from 'node-appwrite';
import { ResourceTable } from '../ui/ResourceTable';
import { Breadcrumb } from '../ui/Breadcrumb';
import { CollectionSettings } from '../CollectionSettings';
import { DatabaseIcon, FileIcon, KeyIcon, SettingsIcon, ChevronDownIcon, ExternalLinkIcon } from '../../Icons';
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
    onCreateDocument, onUpdateDocument, onDeleteDocument,
    onCreateAttribute, onUpdateAttribute, onDeleteAttribute,
    onCreateIndex, onDeleteIndex,
    onUpdateCollectionSettings
}) => {
    const [collectionTab, setCollectionTab] = useState<CollectionTab>('documents');
    const [attributeType, setAttributeType] = useState<string>('string');

    // Reset tab when collection changes
    useEffect(() => {
        setCollectionTab('documents');
    }, [selectedCollection?.$id]);

    if (!selectedDb) {
        return (
            <ResourceTable<Database> 
                title="Databases" 
                data={databases} 
                onCreate={onCreateDatabase} 
                onDelete={onDeleteDatabase} 
                onSelect={(item) => onSelectDb(item)} 
                createLabel="New DB" 
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
                        createLabel="Add Document" 
                        renderName={(doc) => <span className="font-mono text-xs text-gray-300">{JSON.stringify(doc).slice(0, 80)}...</span>} 
                        headers={['ID', 'Data Preview', '', 'Actions']}
                    />
                )}

                {collectionTab === 'attributes' && (
                    <ResourceTable<any> 
                        data={attributes} 
                        onDelete={(item) => onDeleteAttribute(item)} 
                        createLabel="Add Attribute"
                        onCreate={() => onCreateAttribute(attributeType)}
                        onEdit={onUpdateAttribute}
                        extraActions={
                            <div className="relative mr-2">
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
                        }
                        renderName={(item) => <span className="font-mono text-cyan-300">{item.key} <span className="text-gray-500">({item.type})</span></span>} 
                        headers={['Key', 'Type', 'Details', 'Actions']}
                        renderExtra={(item) => (
                            <div className="flex gap-2">
                                {item.required && <span className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">Req</span>}
                                {item.array && <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">Array</span>}
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
                        renderName={(item) => <span className="font-mono text-yellow-300">{item.key} <span className="text-gray-500">({item.type})</span></span>} 
                        headers={['Key', 'Type', 'Details', 'Actions']}
                        renderExtra={(item) => <span className="text-xs text-gray-500">{item.attributes.join(', ')}</span>}
                    />
                )}

                {collectionTab === 'settings' && (
                    <CollectionSettings collection={selectedCollection} onUpdate={onUpdateCollectionSettings} onDelete={onDeleteCollection} />
                )}
            </div>
        </div>
    );
};
