
import React, { useState, useEffect } from 'react';
import type { Bucket, AppwriteProject } from '../../../types';
import type { Models } from 'node-appwrite';
import { ResourceTable } from '../ui/ResourceTable';
import { Breadcrumb } from '../ui/Breadcrumb';
import { FileIcon, RiShareForwardLine, ExternalLinkIcon, DeleteIcon } from '../../Icons';
import { consoleLinks } from '../../../services/appwrite';

interface StorageTabProps {
    activeProject: AppwriteProject;
    buckets: Bucket[];
    selectedBucket: Bucket | null;
    files: Models.File[];
    onCreateBucket: () => void;
    onDeleteBucket: (b: Bucket) => void;
    onSelectBucket: (b: Bucket | null) => void;
    onDeleteFile: (f: Models.File) => void;
    
    // New props
    onConsolidateBuckets: () => void;
    onBulkDeleteBuckets?: (bucketIds: string[]) => void;
    onBulkDeleteFiles?: (fileIds: string[]) => void;
}

export const StorageTab: React.FC<StorageTabProps> = ({
    activeProject, buckets, selectedBucket, files,
    onCreateBucket, onDeleteBucket, onSelectBucket,
    onDeleteFile,
    onConsolidateBuckets,
    onBulkDeleteBuckets,
    onBulkDeleteFiles
}) => {
    const [selectedBucketIds, setSelectedBucketIds] = useState<string[]>([]);
    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

    useEffect(() => {
        setSelectedFileIds([]);
    }, [selectedBucket?.$id]);

    if (!selectedBucket) {
        return (
            <ResourceTable<Bucket> 
                title="Storage Buckets" 
                data={buckets} 
                onCreate={onCreateBucket} 
                onDelete={onDeleteBucket} 
                onSelect={(item) => onSelectBucket(item)} 
                createLabel="New Bucket" 
                selection={{
                    selectedIds: selectedBucketIds,
                    onSelectionChange: setSelectedBucketIds
                }}
                extraActions={
                    <div className="flex items-center gap-2 mr-2">
                        {selectedBucketIds.length > 0 && onBulkDeleteBuckets && (
                            <button
                                onClick={() => {
                                    onBulkDeleteBuckets(selectedBucketIds);
                                    setSelectedBucketIds([]);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-xs font-bold rounded-lg transition-colors"
                            >
                                <DeleteIcon size={14} /> Delete ({selectedBucketIds.length})
                            </button>
                        )}
                        <a 
                            href={consoleLinks.storage(activeProject)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                        >
                            <ExternalLinkIcon size={14} /> Open in Console
                        </a>
                        <button 
                            onClick={onConsolidateBuckets}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-bold rounded-lg transition-colors"
                        >
                            <RiShareForwardLine size={14} /> Transfer Files
                        </button>
                    </div>
                }
            />
        );
    }

    return (
        <>
            <div className="flex justify-between items-start">
                <Breadcrumb items={[{ label: 'Storage', onClick: () => onSelectBucket(null) }, { label: selectedBucket.name }]} />
                <a 
                    href={consoleLinks.bucket(activeProject, selectedBucket.$id)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                >
                    <ExternalLinkIcon size={14} /> View Bucket in Console
                </a>
            </div>
            <ResourceTable<Models.File> 
                title={`Files in ${selectedBucket.name}`} 
                data={files} 
                onDelete={onDeleteFile} 
                selection={{
                    selectedIds: selectedFileIds,
                    onSelectionChange: setSelectedFileIds
                }}
                extraActions={
                    selectedFileIds.length > 0 && onBulkDeleteFiles && (
                        <button
                            onClick={() => {
                                onBulkDeleteFiles(selectedFileIds);
                                setSelectedFileIds([]);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-xs font-bold rounded-lg transition-colors mr-2"
                        >
                            <DeleteIcon size={14} /> Delete ({selectedFileIds.length})
                        </button>
                    )
                }
                renderName={(f) => <div className="flex items-center gap-2"><FileIcon size={14}/> {f.name}</div>}
                renderExtra={(f) => <span className="text-xs text-gray-500">{(f.sizeOriginal / 1024).toFixed(1)} KB</span>}
            />
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4 text-center mt-4">
                <p className="text-sm text-gray-400">To upload files, use the Agent chat interface with the file attachment button.</p>
            </div>
        </>
    );
};
