
import React from 'react';
import type { Bucket } from '../../../types';
import type { Models } from 'node-appwrite';
import { ResourceTable } from '../ui/ResourceTable';
import { Breadcrumb } from '../ui/Breadcrumb';
import { FileIcon, RiShareForwardLine } from '../../Icons';

interface StorageTabProps {
    buckets: Bucket[];
    selectedBucket: Bucket | null;
    files: Models.File[];
    onCreateBucket: () => void;
    onDeleteBucket: (b: Bucket) => void;
    onSelectBucket: (b: Bucket | null) => void;
    onDeleteFile: (f: Models.File) => void;
    
    // New prop
    onConsolidateBuckets: () => void;
}

export const StorageTab: React.FC<StorageTabProps> = ({
    buckets, selectedBucket, files,
    onCreateBucket, onDeleteBucket, onSelectBucket,
    onDeleteFile,
    onConsolidateBuckets
}) => {
    if (!selectedBucket) {
        return (
            <ResourceTable<Bucket> 
                title="Storage Buckets" 
                data={buckets} 
                onCreate={onCreateBucket} 
                onDelete={onDeleteBucket} 
                onSelect={(item) => onSelectBucket(item)} 
                createLabel="New Bucket" 
                extraActions={
                    <button 
                        onClick={onConsolidateBuckets}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-bold rounded-lg transition-colors mr-2"
                    >
                        <RiShareForwardLine size={14} /> Transfer Files
                    </button>
                }
            />
        );
    }

    return (
        <>
            <Breadcrumb items={[{ label: 'Storage', onClick: () => onSelectBucket(null) }, { label: selectedBucket.name }]} />
            <ResourceTable<Models.File> 
                title={`Files in ${selectedBucket.name}`} 
                data={files} 
                onDelete={onDeleteFile} 
                renderName={(f) => <div className="flex items-center gap-2"><FileIcon size={14}/> {f.name}</div>}
                renderExtra={(f) => <span className="text-xs text-gray-500">{(f.sizeOriginal / 1024).toFixed(1)} KB</span>}
            />
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4 text-center mt-4">
                <p className="text-sm text-gray-400">To upload files, use the Agent chat interface with the file attachment button.</p>
            </div>
        </>
    );
};
