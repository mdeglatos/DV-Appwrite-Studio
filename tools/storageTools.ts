import { getSdkStorage, ID, Query } from '../services/appwrite';
import type { AIContext } from '../types';
import { Type, type FunctionDeclaration } from '@google/genai';

async function handleApiError(error: unknown) {
    console.error('Appwrite API error in storage tool:', error);
    if (error instanceof Error) {
        return { error: `Appwrite API Error: ${error.message}` };
    }
    return { error: 'An unknown error occurred while communicating with the Appwrite API.' };
}

// =================================================================
// Bucket Functions
// =================================================================

async function listBuckets(context: AIContext, { limit = 100 }: { limit?: number }) {
  const finalLimit = Math.min(limit, 100);
  console.log(`Executing listBuckets tool with limit=${finalLimit}`);
  try {
    const storage = getSdkStorage(context.project);
    return await storage.listBuckets([Query.limit(finalLimit)]);
  } catch (error) {
    return handleApiError(error);
  }
}

async function createBucket(context: AIContext, { bucketId, name, permissions, fileSecurity, enabled, maximumFileSize, allowedFileExtensions, compression, encryption, antivirus }: { 
    bucketId: string, 
    name: string, 
    permissions?: string[], 
    fileSecurity?: boolean, 
    enabled?: boolean, 
    maximumFileSize?: number, 
    allowedFileExtensions?: string[],
    compression?: 'none' | 'gzip' | 'zstd',
    encryption?: boolean,
    antivirus?: boolean,
}) {
  console.log(`Executing createBucket tool with name '${name}'`);
  try {
    const buckId = bucketId.toLowerCase() === 'unique()' ? ID.unique() : bucketId;
    const storage = getSdkStorage(context.project);
    return await storage.createBucket(buckId, name, permissions, fileSecurity, enabled, maximumFileSize, allowedFileExtensions, compression as any, encryption, antivirus);
  } catch (error) {
    return handleApiError(error);
  }
}

async function getBucket(context: AIContext, { bucketId }: { bucketId?: string }) {
    const finalBucketId = bucketId || context.bucket?.$id;
    if (!finalBucketId) return { error: 'Bucket ID is missing. Please provide a bucketId or select a bucket from the context menu.' };

    console.log(`Executing getBucket tool for bucket '${finalBucketId}'`);
    try {
        const storage = getSdkStorage(context.project);
        return await storage.getBucket(finalBucketId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function updateBucket(context: AIContext, { bucketId, name, permissions, fileSecurity, enabled, maximumFileSize, allowedFileExtensions, compression, encryption, antivirus }: { 
    bucketId?: string, 
    name: string, 
    permissions?: string[], 
    fileSecurity?: boolean, 
    enabled?: boolean, 
    maximumFileSize?: number, 
    allowedFileExtensions?: string[],
    compression?: 'none' | 'gzip' | 'zstd',
    encryption?: boolean,
    antivirus?: boolean,
}) {
  const finalBucketId = bucketId || context.bucket?.$id;
  if (!finalBucketId) return { error: 'Bucket ID is missing. Please provide a bucketId or select a bucket from the context menu.' };

  console.log(`Executing updateBucket tool for bucket '${finalBucketId}'`);
  try {
    const storage = getSdkStorage(context.project);
    return await storage.updateBucket(finalBucketId, name, permissions, fileSecurity, enabled, maximumFileSize, allowedFileExtensions, compression as any, encryption, antivirus);
  } catch (error) {
    return handleApiError(error);
  }
}

async function deleteBucket(context: AIContext, { bucketId }: { bucketId?: string }) {
    const finalBucketId = bucketId || context.bucket?.$id;
    if (!finalBucketId) return { error: 'Bucket ID is missing. Please provide a bucketId or select a bucket from the context menu.' };

    console.log(`Executing deleteBucket tool for bucket '${finalBucketId}'`);
    try {
        const storage = getSdkStorage(context.project);
        await storage.deleteBucket(finalBucketId);
        return { success: `Successfully deleted bucket ${finalBucketId}` };
    } catch (error) {
        return handleApiError(error);
    }
}

async function setBucketPermissions(context: AIContext, { bucketId, permissions }: { bucketId?: string, permissions: string[] }) {
    const finalBucketId = bucketId || context.bucket?.$id;
    if (!finalBucketId) return { error: 'Bucket ID is missing. Please provide a bucketId or select a bucket from the context menu.' };

    console.log(`Executing setBucketPermissions for bucket '${finalBucketId}'`);
    try {
        const storage = getSdkStorage(context.project);
        // The SDK's update method requires the name. Fetch it first.
        const currentBucket = await storage.getBucket(finalBucketId);
        return await storage.updateBucket(finalBucketId, currentBucket.name, permissions);
    } catch (error) {
        return handleApiError(error);
    }
}


// =================================================================
// File Functions
// =================================================================

async function listFiles(context: AIContext, { bucketId, limit = 100 }: { bucketId?: string, limit?: number }) {
    const finalBucketId = bucketId || context.bucket?.$id;
    if (!finalBucketId) return { error: 'Bucket ID is missing. Please provide a bucketId or select a bucket from the context menu.' };
    
    const finalLimit = Math.min(limit, 100);
    console.log(`Executing listFiles tool for bucket '${finalBucketId}' with limit=${finalLimit}`);
    try {
        const storage = getSdkStorage(context.project);
        return await storage.listFiles(finalBucketId, [Query.limit(finalLimit)]);
    } catch (error) {
        return handleApiError(error);
    }
}

async function getFile(context: AIContext, { bucketId, fileId }: { bucketId?: string, fileId: string }) {
    const finalBucketId = bucketId || context.bucket?.$id;
    if (!finalBucketId) return { error: 'Bucket ID is missing. Please provide a bucketId or select a bucket from the context menu.' };

    console.log(`Executing getFile tool for file '${fileId}'`);
    try {
        const storage = getSdkStorage(context.project);
        return await storage.getFile(finalBucketId, fileId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function writeFile(context: AIContext, { bucketId, fileId, fileToUpload, permissions }: { bucketId?: string, fileId?: string, fileToUpload?: File, permissions?: string[] }) {
    const finalBucketId = bucketId || context.bucket?.$id;
    if (!finalBucketId) return { error: 'Bucket ID is missing. Please provide a bucketId or select a bucket from the context menu.' };

    console.log(`Executing writeFile tool for bucket '${finalBucketId}'`);
    if (!fileToUpload) {
        return { error: 'No file was provided to upload. If multiple files were attached to the message, you must specify which one to use with the "fileName" argument.' };
    }
    
    try {
        // The Node.js SDK's file upload isn't browser-compatible.
        // We must use a manual fetch call with FormData to upload from the client
        // while still using the project's API key for authentication.
        const fileIdToUse = (fileId || 'unique()').toLowerCase() === 'unique()' ? ID.unique() : fileId!;

        const formData = new FormData();
        formData.append('fileId', fileIdToUse);
        formData.append('file', fileToUpload);
        if (permissions) {
            permissions.forEach((p, i) => formData.append(`permissions[${i}]`, p));
        }

        const response = await fetch(`${context.project.endpoint}/storage/buckets/${finalBucketId}/files`, {
            method: 'POST',
            headers: {
                'X-Appwrite-Project': context.project.projectId,
                'X-Appwrite-Key': context.project.apiKey,
            },
            body: formData,
        });

        const jsonResponse = await response.json();

        if (!response.ok) {
            // Appwrite error responses have a 'message' field.
            throw new Error(jsonResponse.message || `File upload failed with status ${response.status}`);
        }

        return jsonResponse;
    } catch (error) {
        return handleApiError(error);
    }
}

async function updateFilePermissions(context: AIContext, { bucketId, fileId, permissions }: { bucketId?: string, fileId: string, permissions: string[] }) {
    const finalBucketId = bucketId || context.bucket?.$id;
    if (!finalBucketId) return { error: 'Bucket ID is missing. Please provide a bucketId or select a bucket from the context menu.' };

    console.log(`Executing updateFilePermissions tool for file '${fileId}'`);
    try {
        const storage = getSdkStorage(context.project);
        // In modern SDKs, use updateFile. It requires a name, so fetch first.
        const currentFile = await storage.getFile(finalBucketId, fileId);
        return await storage.updateFile(finalBucketId, fileId, currentFile.name, permissions);
    } catch (error) {
        return handleApiError(error);
    }
}

async function deleteFile(context: AIContext, { bucketId, fileId }: { bucketId?: string, fileId: string }) {
    const finalBucketId = bucketId || context.bucket?.$id;
    if (!finalBucketId) return { error: 'Bucket ID is missing. Please provide a bucketId or select a bucket from the context menu.' };
    
    console.log(`Executing deleteFile tool for file '${fileId}'`);
    try {
        const storage = getSdkStorage(context.project);
        await storage.deleteFile(finalBucketId, fileId);
        return { success: `Successfully deleted file ${fileId}` };
    } catch (error) {
        return handleApiError(error);
    }
}

async function getFileUrl(context: AIContext, { bucketId, fileId }: { bucketId?: string, fileId: string }) {
    const finalBucketId = bucketId || context.bucket?.$id;
    if (!finalBucketId) return { error: 'Bucket ID is missing. Please provide a bucketId or select a bucket from the context menu.' };
    
    console.log(`Executing getFileUrl tool for file '${fileId}' in bucket '${finalBucketId}'`);
    try {
        const { endpoint, projectId } = context.project;

        // The URL for viewing a file requires the project endpoint, bucket ID, file ID, and project ID as a query parameter.
        // The node-appwrite SDK's getFileView method doesn't append the project query param, so we construct it manually
        // to match the format required for direct browser access.
        const fileViewUrl = `${endpoint}/storage/buckets/${finalBucketId}/files/${fileId}/view?project=${projectId}`;
        
        return { url: fileViewUrl };
    } catch(error) {
        return handleApiError(error);
    }
}

async function createFileToken(context: AIContext, { bucketId, fileId }: { bucketId?: string, fileId: string }) {
    const finalBucketId = bucketId || context.bucket?.$id;
    if (!finalBucketId) return { error: 'Bucket ID is missing.' };

    console.log(`Executing createFileToken tool for file '${fileId}' in bucket '${finalBucketId}'`);
    try {
        const storage = getSdkStorage(context.project);
        const client = (storage as any).client;
        return await client.call('POST', new URL(`${client.config.endpoint}/storage/buckets/${finalBucketId}/files/${fileId}/tokens`));
    } catch (error) {
        return handleApiError(error);
    }
}

export const storageFunctions = {
    // Buckets
    listBuckets,
    createBucket,
    getBucket,
    updateBucket,
    deleteBucket,
    setBucketPermissions,
    // Files
    listFiles,
    getFile,
    writeFile,
    updateFilePermissions,
    deleteFile,
    getFileUrl,
    createFileToken,
};

export const storageToolDefinitions: FunctionDeclaration[] = [
    // Bucket Tools
    {
        name: 'listBuckets',
        description: 'Lists all storage buckets in the project.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                limit: { type: Type.INTEGER, description: 'Optional. The maximum number of buckets to return. Default is 100. Maximum is 100.' },
            },
            required: [],
        },
    },
    {
        name: 'createBucket',
        description: 'Creates a new storage bucket with specified settings.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: "Unique ID for the bucket. Use 'unique()' to auto-generate." },
                name: { type: Type.STRING, description: "Name for the new bucket." },
                permissions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Optional. Array of permission strings. Controls who can access the documents in this bucket." },
                fileSecurity: { type: Type.BOOLEAN, description: 'Optional. Enables file-level permissions. If true, access to files is controlled by file permissions, otherwise by bucket permissions. Defaults to false.'},
                enabled: { type: Type.BOOLEAN, description: 'Optional. Is bucket enabled? When set to false, users cannot access the files in this bucket. Defaults to true.'},
                maximumFileSize: { type: Type.INTEGER, description: 'Optional. Maximum file size in bytes. Maximum 5GB.'},
                allowedFileExtensions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Optional. Array of allowed file extensions (e.g., ["jpg", "png"]).'},
                compression: { type: Type.STRING, description: 'Optional. Compression algorithm. Can be "none", "gzip", or "zstd".'},
                encryption: { type: Type.BOOLEAN, description: 'Optional. Is encryption enabled? For self-hosted projects, this requires the `APP_ENCRYPTION_KEY` to be set. Defaults to true.'},
                antivirus: { type: Type.BOOLEAN, description: 'Optional. Is ClamAV antivirus enabled? For self-hosted projects, this requires the ClamAV service to be running. Defaults to true.'},
            },
            required: ['bucketId', 'name']
        }
    },
    {
        name: 'getBucket',
        description: 'Gets a storage bucket by its ID. Uses the active bucket from the context if bucketId is not provided.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: 'Optional. The ID of the bucket to retrieve. Defaults to the active context.' }
            },
            required: []
        }
    },
    {
        name: 'updateBucket',
        description: 'Updates a storage bucket. Uses the active bucket from the context if bucketId is not provided.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: 'Optional. The ID of the bucket to update. Defaults to the active context.' },
                name: { type: Type.STRING, description: "The new name for the bucket." },
                permissions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Optional. Array of permission strings. WARNING: This will overwrite all existing permissions." },
                fileSecurity: { type: Type.BOOLEAN, description: 'Optional. Enables file-level permissions.'},
                enabled: { type: Type.BOOLEAN, description: 'Optional. Is bucket enabled?'},
                maximumFileSize: { type: Type.INTEGER, description: 'Optional. Maximum file size in bytes.'},
                allowedFileExtensions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Optional. Array of allowed file extensions.'},
                compression: { type: Type.STRING, description: 'Optional. Compression algorithm: "none", "gzip", or "zstd".'},
                encryption: { type: Type.BOOLEAN, description: 'Optional. Is encryption enabled?'},
                antivirus: { type: Type.BOOLEAN, description: 'Optional. Is ClamAV antivirus enabled?'},
            },
            required: ['name']
        }
    },
    {
        name: 'deleteBucket',
        description: 'Deletes a storage bucket. Uses the active bucket from the context if bucketId is not provided.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: 'Optional. The ID of the bucket to delete. Defaults to the active context.' }
            },
            required: []
        }
    },
    {
        name: 'setBucketPermissions',
        description: 'Sets permissions for a storage bucket. Uses the active bucket from the context if bucketId is not provided. WARNING: This overwrites all existing permissions.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: 'Optional. The ID of the bucket to update. Defaults to the active context.' },
                permissions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Array of permission strings. E.g., ["read(\\"any\\")", "create(\\"users\\")"]'
                },
            },
            required: ['permissions'],
        },
    },
    // File Tools
    {
        name: 'listFiles',
        description: 'Lists all files in a storage bucket. Uses the active bucket from the context if bucketId is not provided.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: 'Optional. The ID of the bucket. Defaults to the active context.' },
                limit: { type: Type.INTEGER, description: 'Optional. The maximum number of files to return. Default is 100. Maximum is 100.' },
            },
            required: []
        }
    },
    {
        name: 'getFile',
        description: 'Gets a file\'s metadata by its ID. Uses the active bucket from the context if bucketId is not provided.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: 'Optional. The ID of the bucket. Defaults to the active context.' },
                fileId: { type: Type.STRING, description: 'The ID of the file.' }
            },
            required: ['fileId']
        }
    },
    {
        name: 'writeFile',
        description: 'Uploads a file to a storage bucket. The file must be one of the files attached to the user\'s message. If multiple files are attached, this tool must be called multiple times in parallel (once for each file). Uses the active bucket from the context if bucketId is not provided.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: 'Optional. ID of the storage bucket. Defaults to the active context.' },
                fileId: { type: Type.STRING, description: "Optional. File ID. If not provided, a unique ID will be generated by Appwrite." },
                fileName: { type: Type.STRING, description: 'The name of the file to upload, which must match one of the files attached to the user\'s message (e.g., "image.png"). This argument is REQUIRED when multiple files are attached to the message.' },
                permissions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Optional. An array of permission strings.' }
            },
            required: [],
        }
    },
    {
        name: 'updateFilePermissions',
        description: 'Updates the permissions for a specific file. This will overwrite all existing permissions for the file.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: 'Optional. The ID of the bucket. Defaults to the active context.' },
                fileId: { type: Type.STRING, description: 'The ID of the file to update.' },
                permissions: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of permission strings. E.g., ["read(\\"any\\")", "update(\\"users\\")"]' }
            },
            required: ['fileId', 'permissions']
        }
    },
    {
        name: 'deleteFile',
        description: 'Deletes a file from a storage bucket. Uses the active bucket from the context if bucketId is not provided.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: 'Optional. The ID of the bucket. Defaults to the active context.' },
                fileId: { type: Type.STRING, description: 'The ID of the file to delete.' }
            },
            required: ['fileId']
        }
    },
    {
        name: 'getFileUrl',
        description: 'Constructs a public URL to view a file in the browser. Uses active context for bucketId if not provided.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: 'Optional. The bucket ID. Defaults to active bucket.' },
                fileId: { type: Type.STRING, description: 'The ID of the file.' },
            },
            required: ['fileId'],
        },
    },
    {
        name: 'createFileToken',
        description: 'Generates a secure, short-lived sharing token for a storage file.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                bucketId: { type: Type.STRING, description: 'Optional. The bucket ID. Defaults to active bucket.' },
                fileId: { type: Type.STRING, description: 'The ID of the file.' },
            },
            required: ['fileId'],
        },
    },
];