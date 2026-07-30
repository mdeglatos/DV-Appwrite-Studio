import React, { useState, useEffect } from 'react';
import type { Models } from 'node-appwrite';
import type { AppwriteProject } from '../../../types';
import { getSdkStorage } from '../../../services/appwrite';
import { ListState } from './ListState';

interface FilePreviewProps {
    project: AppwriteProject;
    bucketId: string;
    file: Models.File;
}

/**
 * Previews a stored file by fetching its bytes through the SDK.
 *
 * The previous implementation built a `…/preview?project=<id>` URL and handed it
 * to an `<img>`, which only works for a *public* bucket — a private one rendered
 * a broken image and the "Open in New Tab" link 401'd. Fetching the bytes uses
 * the same authenticated client as everything else, and the object URL is
 * revoked when the modal closes.
 */
export const FilePreview: React.FC<FilePreviewProps> = ({ project, bucketId, file }) => {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let created: string | null = null;

        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const buffer = await getSdkStorage(project).getFileView(bucketId, file.$id);
                if (cancelled) return;
                created = URL.createObjectURL(new Blob([buffer], { type: file.mimeType || 'application/octet-stream' }));
                setObjectUrl(created);
            } catch (e: any) {
                if (!cancelled) setError(`Could not load preview: ${e.message}`);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        load();

        return () => {
            cancelled = true;
            if (created) URL.revokeObjectURL(created);
        };
    }, [project, bucketId, file.$id, file.mimeType]);

    const isImage = file.mimeType?.startsWith('image/');

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>Type: {file.mimeType}</span>
                <span>Size: {(file.sizeOriginal / 1024).toFixed(1)} KB</span>
                <span>ID: {file.$id}</span>
            </div>

            {isLoading || error || !objectUrl ? (
                <ListState
                    isLoading={isLoading}
                    error={error}
                    isEmpty={!objectUrl}
                    emptyMessage="No preview available."
                    loadingMessage="Loading preview…"
                />
            ) : isImage ? (
                <img
                    src={objectUrl}
                    alt={file.name}
                    className="max-w-full max-h-[60vh] rounded-lg border border-gray-700 mx-auto"
                />
            ) : (
                <div className="bg-gray-900 rounded-lg border border-gray-700 p-8 text-center">
                    <p className="text-gray-400 mb-4">Preview not available for {file.mimeType}</p>
                    <a
                        href={objectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold"
                    >
                        Open in New Tab
                    </a>
                </div>
            )}
        </div>
    );
};
