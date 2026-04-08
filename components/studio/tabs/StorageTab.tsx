
import React, { useState, useEffect, useRef } from 'react';
import type { Bucket, AppwriteProject } from '../../../types';
import type { Models } from 'node-appwrite';
import { ResourceTable } from '../ui/ResourceTable';
import { Breadcrumb } from '../ui/Breadcrumb';
import { FileIcon, RiShareForwardLine, ExternalLinkIcon, DeleteIcon, UploadIcon, DownloadIcon, EyeIcon, SettingsIcon, ImageIcon } from '../../Icons';
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
    onConsolidateBuckets: () => void;
    onBulkDeleteBuckets?: (bucketIds: string[]) => void;
    onBulkDeleteFiles?: (fileIds: string[]) => void;
    onUploadFile?: (files: FileList) => void;
    onDownloadFile?: (f: Models.File) => void;
    onPreviewFile?: (f: Models.File) => void;
    onUpdateBucket?: (b: Bucket) => void;
}

export const StorageTab: React.FC<StorageTabProps> = ({
    activeProject, buckets, selectedBucket, files,
    onCreateBucket, onDeleteBucket, onSelectBucket,
    onDeleteFile,
    onConsolidateBuckets,
    onBulkDeleteBuckets,
    onBulkDeleteFiles,
    onUploadFile,
    onDownloadFile,
    onPreviewFile,
    onUpdateBucket
}) => {
    const [selectedBucketIds, setSelectedBucketIds] = useState<string[]>([]);
    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);

    useEffect(() => {
        setSelectedFileIds([]);
    }, [selectedBucket?.$id]);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer?.items?.length) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounterRef.current = 0;
        if (e.dataTransfer?.files?.length && onUploadFile) {
            onUploadFile(e.dataTransfer.files);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length && onUploadFile) {
            onUploadFile(e.target.files);
            e.target.value = ''; // Reset
        }
    };

    const isImageFile = (f: Models.File) => f.mimeType?.startsWith('image/');
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

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
                renderExtraActions={(b) => (
                    onUpdateBucket ? (
                        <button onClick={() => onUpdateBucket(b)} className="text-gray-500 hover:text-cyan-400 p-1 rounded hover:bg-gray-800 transition-colors" title="Bucket Settings">
                            <SettingsIcon size={14} />
                        </button>
                    ) : null
                )}
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
                renderExtra={(b) => (
                    <div className="flex flex-col gap-1">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border w-fit ${
                            b.enabled 
                                ? 'bg-green-900/20 text-green-400 border-green-900/50' 
                                : 'bg-red-900/20 text-red-400 border-red-900/50'
                        }`}>
                            {b.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        {b.maximumFileSize > 0 && (
                            <span className="text-[10px] text-gray-600">Max: {formatSize(b.maximumFileSize)}</span>
                        )}
                    </div>
                )}
            />
        );
    }

    return (
        <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="relative"
        >
            {/* Drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-cyan-500/10 border-2 border-dashed border-cyan-500 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                        <UploadIcon size={48} className="text-cyan-400 animate-bounce" />
                        <p className="text-lg font-bold text-cyan-300">Drop files to upload</p>
                        <p className="text-sm text-cyan-400/70">to {selectedBucket.name}</p>
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
            />

            <div className="flex justify-between items-start">
                <Breadcrumb items={[{ label: 'Storage', onClick: () => onSelectBucket(null) }, { label: selectedBucket.name }]} />
                <div className="flex gap-2">
                    {onUploadFile && (
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-cyan-900/20"
                        >
                            <UploadIcon size={14} /> Upload Files
                        </button>
                    )}
                    {onUpdateBucket && (
                        <button 
                            onClick={() => onUpdateBucket(selectedBucket)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                        >
                            <SettingsIcon size={14} /> Settings
                        </button>
                    )}
                    <a 
                        href={consoleLinks.bucket(activeProject, selectedBucket.$id)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-bold text-gray-300 transition-all"
                    >
                        <ExternalLinkIcon size={14} /> Console
                    </a>
                </div>
            </div>

            <ResourceTable<Models.File> 
                title={`Files in ${selectedBucket.name}`} 
                data={files} 
                onDelete={onDeleteFile} 
                selection={{
                    selectedIds: selectedFileIds,
                    onSelectionChange: setSelectedFileIds
                }}
                headers={['Actions', 'ID', 'File', 'Details']}
                renderExtraActions={(f) => (
                    <div className="flex items-center gap-1">
                        {onPreviewFile && (
                            <button onClick={() => onPreviewFile(f)} className="text-gray-500 hover:text-cyan-400 p-1 rounded hover:bg-gray-800 transition-colors" title="Preview">
                                <EyeIcon size={14} />
                            </button>
                        )}
                        {onDownloadFile && (
                            <button onClick={() => onDownloadFile(f)} className="text-gray-500 hover:text-green-400 p-1 rounded hover:bg-gray-800 transition-colors" title="Download">
                                <DownloadIcon size={14} />
                            </button>
                        )}
                    </div>
                )}
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
                renderName={(f) => (
                    <div className="flex items-center gap-2">
                        {isImageFile(f) ? <ImageIcon size={14} className="text-purple-400" /> : <FileIcon size={14}/>}
                        <span className="truncate">{f.name}</span>
                    </div>
                )}
                renderExtra={(f) => (
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 font-mono">{formatSize(f.sizeOriginal)}</span>
                        <span className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{f.mimeType}</span>
                    </div>
                )}
            />

            {/* Upload zone when empty */}
            {files.length === 0 && onUploadFile && (
                <div 
                    className="bg-gray-800/30 border-2 border-dashed border-gray-700/50 rounded-lg p-8 text-center mt-4 cursor-pointer hover:border-cyan-700/50 hover:bg-cyan-950/10 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <UploadIcon size={32} className="text-gray-500 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 font-medium">Drag files here or click to upload</p>
                    <p className="text-xs text-gray-600 mt-1">Files will be uploaded to "{selectedBucket.name}"</p>
                </div>
            )}
        </div>
    );
};
