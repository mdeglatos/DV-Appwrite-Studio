
import { getSdkFunctions, ID, Query } from '../services/appwrite';
import type { AIContext, AppwriteProject } from '../types';
import { Type, type FunctionDeclaration } from '@google/genai';
import Tar from 'tar-js';
import pako from 'pako';


async function handleApiError(error: unknown) {
    console.error('Appwrite API error in functions tool:', error);
    if (error instanceof Error) {
        return { error: `Appwrite API Error: ${error.message}` };
    }
    return { error: 'An unknown error occurred while communicating with the Appwrite API.' };
}

/**
 * Sanitizes an endpoint URL and performs a fetch with Appwrite admin headers.
 * Uses mode: 'cors' and credentials: 'omit' to ensure browser-based API key requests 
 * aren't blocked by standard credential-based CORS restrictions.
 */
async function appwriteFetch(project: AppwriteProject, path: string, options: RequestInit = {}) {
    const cleanEndpoint = project.endpoint.trim().replace(/\/+$/, '');
    const cleanPath = path.trim().replace(/^\/+/, '');
    const url = `${cleanEndpoint}/${cleanPath}`;
    
    const headers: Record<string, string> = {
        'X-Appwrite-Project': project.projectId.trim(),
        'X-Appwrite-Key': project.apiKey.trim(),
        'X-Appwrite-Response-Format': 'json',
    };

    if (options.headers && typeof options.headers === 'object') {
        Object.entries(options.headers).forEach(([key, value]) => {
            headers[key] = String(value);
        });
    }

    const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'omit',
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP Error ${response.status}` }));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return response.json();
}

// Helper to create a .tar.gz blob from an array of File objects
async function createTarGzFromFiles(files: File[]): Promise<Blob> {
    const tar = new Tar();
    const filePromises = files.map(async (file) => {
        const contentBuffer = await file.arrayBuffer();
        const content = new Uint8Array(contentBuffer);
        tar.append(file.name, content);
    });

    await Promise.all(filePromises);

    const tarUint8Array = tar.out;
    const gzippedData = pako.gzip(tarUint8Array);
    return new Blob([gzippedData], { type: 'application/gzip' });
}

// Helper to create a .tar.gz blob from in-memory file content
async function createTarGzFromStringContent(files: { name: string; content: string }[]): Promise<Blob> {
    const tar = new Tar();
    const encoder = new TextEncoder();

    for (const file of files) {
        const content = encoder.encode(file.content);
        tar.append(file.name, content);
    }
    
    const tarUint8Array = tar.out;
    const gzippedData = pako.gzip(tarUint8Array);
    return new Blob([gzippedData], { type: 'application/gzip' });
}

// New helper for deploying from string content, used by both manual deploy and AI tool
export async function deployCodeFromString(
    project: AppwriteProject,
    functionId: string,
    files: { name: string; content: string }[],
    activate: boolean,
    entrypoint?: string,
    commands?: string
) {
    if (!files || files.length === 0) {
        throw new Error('No source files were provided to package.');
    }

    const codeBlob = await createTarGzFromStringContent(files);
    
    // CRITICAL: Wrap blob in a File object to ensure multi-part boundary and filename metadata
    const fileObj = new File([codeBlob], 'code.tar.gz', { type: 'application/gzip' });
    
    const formData = new FormData();
    // Explicitly append with filename to ensure multipart headers are set correctly by browser
    formData.append('code', fileObj, 'code.tar.gz');
    formData.append('activate', activate ? 'true' : 'false');
    if (entrypoint) formData.append('entrypoint', entrypoint);
    if (commands) formData.append('commands', commands);

    return appwriteFetch(project, `/functions/${functionId}/deployments`, {
        method: 'POST',
        body: formData,
    });
}


// New exported helper to download and unpack deployment code
export interface UnpackedFile {
    name: string;
    content: string;
    size: number;
}

// Helper to decode a string from a Uint8Array, stopping at the first null character.
function decodeString(buffer: Uint8Array): string {
    let result = '';
    for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === 0) break;
        result += String.fromCharCode(buffer[i]);
    }
    return result;
}

// Helper to parse octal number from a Uint8Array.
function parseOctal(buffer: Uint8Array): number {
    const str = decodeString(buffer).trim();
    if (!str) return 0;
    return parseInt(str, 8);
}

// A simple TAR extractor.
function untar(arrayBuffer: ArrayBuffer): UnpackedFile[] {
    const tarData = new Uint8Array(arrayBuffer);
    const files: UnpackedFile[] = [];
    let offset = 0;

    while (offset < tarData.length) {
        const header = tarData.subarray(offset, offset + 512);

        // Check for end-of-archive marker (two consecutive null blocks)
        if (header.every(b => b === 0)) {
            break;
        }

        const fileName = decodeString(header.subarray(0, 100));
        const fileSize = parseOctal(header.subarray(124, 136));
        const typeflag = String.fromCharCode(header[156]);

        offset += 512;

        if ((typeflag === '0' || typeflag === '' || typeflag === '\0') && fileName) { // It's a file with a name
            const fileContentBuffer = tarData.subarray(offset, offset + fileSize);
            const content = new TextDecoder('utf-8').decode(fileContentBuffer);
            files.push({
                name: fileName,
                content: content,
                size: fileSize,
            });
        }
        
        // Move offset to the next header, aligned to 512 bytes
        if (fileSize > 0) {
            offset += Math.ceil(fileSize / 512) * 512;
        }

        // Safety break
        if (offset > tarData.length || isNaN(fileSize)) {
            console.error("Error parsing TAR file. Aborting.");
            break;
        }
    }
    return files;
}

export async function downloadAndUnpackDeployment(
    project: AppwriteProject,
    functionId: string,
    deploymentId: string | null
): Promise<UnpackedFile[] | null> {
    if (!deploymentId) {
        console.warn(`Function ${functionId} has no active deployment.`);
        return null;
    }

    try {
        const functions = getSdkFunctions(project);
        const deploymentData: ArrayBuffer = await functions.getDeploymentDownload(functionId, deploymentId);
        
        if (!deploymentData || deploymentData.byteLength === 0) {
            console.warn(`Downloaded deployment for ${functionId} is empty.`);
            return null;
        }

        const gzippedData = new Uint8Array(deploymentData);
        const tarData = pako.ungzip(gzippedData);

        // FIX: The original code incorrectly used 'tar-js' for extraction, which it does not support.
        // Replaced with a simple, self-contained TAR parser.
        const files = untar(tarData.buffer);

        return files;
    } catch (error) {
        console.error(`Failed to download or unpack deployment ${deploymentId} for function ${functionId}:`, error);
        if (error instanceof Error && (error.message.includes('not_found') || (error as any).code === 404)) {
             console.warn(`Deployment ${deploymentId} not found.`);
             return null;
        }
        throw error;
    }
}


// =================================================================
// Function Management
// =================================================================

async function createFunction(context: AIContext, { functionId, name, runtime, execute, events, schedule, timeout, enabled, logging, entrypoint, commands, installationId, providerRepositoryId, providerBranch, providerSilentMode, providerRootDirectory }: { 
    functionId: string, 
    name: string, 
    runtime: string, 
    execute?: string[], 
    events?: string[], 
    schedule?: string, 
    timeout?: number, 
    enabled?: boolean, 
    logging?: boolean, 
    entrypoint?: string, 
    commands?: string,
    installationId?: string,
    providerRepositoryId?: string,
    providerBranch?: string,
    providerSilentMode?: boolean,
    providerRootDirectory?: string,
}) {
    try {
        const functions = getSdkFunctions(context.project);
        const finalFuncId = functionId.toLowerCase() === 'unique()' ? ID.unique() : functionId;
        return await functions.create(
            finalFuncId,
            name,
            runtime as any,
            execute as any,
            events as any,
            schedule,
            timeout,
            enabled,
            logging,
            entrypoint,
            commands,
            undefined, // scopes
            installationId,
            providerRepositoryId,
            providerBranch,
            providerSilentMode,
            providerRootDirectory
        );
    } catch (error) {
        return handleApiError(error);
    }
}

async function getFunction(context: AIContext, { functionId }: { functionId: string }) {
    try {
        const functions = getSdkFunctions(context.project);
        return await functions.get(functionId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function listFunctions(context: AIContext, { search, limit = 100 }: { search?: string, limit?: number }) {
    const finalLimit = Math.min(limit, 100);
    try {
        const functions = getSdkFunctions(context.project);
        const queries = [Query.limit(finalLimit)];
        if (search) {
            queries.push(Query.search('search', search));
        }
        return await functions.list(queries);
    } catch (error) {
        return handleApiError(error);
    }
}

async function updateFunction(context: AIContext, { functionId, name, runtime, execute, events, schedule, timeout, enabled, logging, entrypoint, commands, installationId, providerRepositoryId, providerBranch, providerSilentMode, providerRootDirectory }: { 
    functionId: string, 
    name: string, 
    runtime?: string, 
    execute?: string[], 
    events?: string[], 
    schedule?: string, 
    timeout?: number, 
    enabled?: boolean, 
    logging?: boolean, 
    entrypoint?: string, 
    commands?: string, 
    installationId?: string, 
    providerRepositoryId?: string, 
    providerBranch?: string, 
    providerSilentMode?: boolean, 
    providerRootDirectory?: string,
}) {
    try {
        const sdkFunctions = getSdkFunctions(context.project);
        let finalRuntime = runtime;
        if (!finalRuntime) {
            // SDK requires runtime, but it might be omitted in an update. Fetch current to provide it.
            const currentFunc = await sdkFunctions.get(functionId);
            finalRuntime = currentFunc.runtime;
        }

        return await sdkFunctions.update(
            functionId,
            name,
            finalRuntime as any, 
            execute as any,
            events as any,
            schedule,
            timeout,
            enabled,
            logging,
            entrypoint,
            commands,
            undefined, // scopes
            installationId,
            providerRepositoryId,
            providerBranch,
            providerSilentMode,
            providerRootDirectory
        );
    } catch (error) {
        return handleApiError(error);
    }
}

async function deleteFunction(context: AIContext, { functionId }: { functionId: string }) {
    try {
        const functions = getSdkFunctions(context.project);
        await functions.delete(functionId);
        return { success: `Successfully deleted function ${functionId}` };
    } catch (error) {
        return handleApiError(error);
    }
}

async function listRuntimes(context: AIContext) {
    try {
        const functions = getSdkFunctions(context.project);
        return await functions.listRuntimes();
    } catch (error) {
        return handleApiError(error);
    }
}

// =================================================================
// Deployment Management
// =================================================================
async function getFunctionDeploymentCode(context: AIContext, { functionId, deploymentId }: { functionId: string, deploymentId?: string }) {
    try {
        let finalDeploymentId = deploymentId;
        if (!finalDeploymentId) {
            // If no deploymentId is provided, get the function to find its active deployment.
            const functions = getSdkFunctions(context.project);
            const func = await functions.get(functionId);
            finalDeploymentId = (func as any).deployment;
        }

        const files = await downloadAndUnpackDeployment(context.project, functionId, finalDeploymentId);
        
        if (!files) {
            return { result: "No files found in the deployment or the deployment does not exist." };
        }

        return { files: files.map(f => ({ name: f.name, size: f.size, content: f.content })) };
    } catch (error) {
        return handleApiError(error);
    }
}

async function deployNewCodeToFunction(context: AIContext, { functionId, activate, entrypoint, commands, files }: { 
    functionId: string, 
    activate: boolean, 
    entrypoint?: string, 
    commands?: string,
    files: { name: string, content: string }[],
}) {
    console.log(`Executing deployNewCodeToFunction tool for function '${functionId}'`);
    try {
        console.log(`Packaging in-memory files: ${files.map(f => f.name).join(', ')}`);
        const result = await deployCodeFromString(context.project, functionId, files, activate, entrypoint, commands);
        console.log('Deployment successful:', result);
        return result;
    } catch (error) {
        return handleApiError(error);
    }
}

async function createDeployment(context: AIContext, { functionId, activate, entrypoint, commands, codeFile }: { 
    functionId: string, 
    activate: boolean, 
    entrypoint?: string, 
    commands?: string,
    // Note: 'fileName' is used by the AI to select a file, but the file content is passed here.
    codeFile?: File,  // this will be injected by geminiService
}) {
    console.log(`Executing createDeployment for function '${functionId}'`);
    
    // The file is injected as 'codeFile'.
    if (!codeFile) {
        return { error: 'No code file was provided for deployment. If multiple files were attached to the message, you must specify which one to use with the "fileName" argument.' };
    }

    try {
        const formData = new FormData();
        // Explicitly set filename
        formData.append('code', codeFile, codeFile.name);
        formData.append('activate', String(activate));
        if (entrypoint) formData.append('entrypoint', entrypoint);
        if (commands) formData.append('commands', commands);

        return appwriteFetch(context.project, `/functions/${functionId}/deployments`, {
            method: 'POST',
            body: formData,
        });
    } catch (error) {
        return handleApiError(error);
    }
}

async function getDeployment(context: AIContext, { functionId, deploymentId }: { functionId: string, deploymentId: string }) {
    try {
        const functions = getSdkFunctions(context.project);
        return await functions.getDeployment(functionId, deploymentId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function listDeployments(context: AIContext, { functionId, search, limit = 100 }: { functionId: string, search?: string, limit?: number }) {
    const finalLimit = Math.min(limit, 100);
    try {
        const functions = getSdkFunctions(context.project);
        const queries = [Query.limit(finalLimit)];
        if (search) {
            queries.push(Query.search('search', search));
        }
        return await functions.listDeployments(functionId, queries);
    } catch (error) {
        return handleApiError(error);
    }
}

async function deleteDeployment(context: AIContext, { functionId, deploymentId }: { functionId: string, deploymentId: string }) {
    try {
        const functions = getSdkFunctions(context.project);
        await functions.deleteDeployment(functionId, deploymentId);
        return { success: `Successfully deleted deployment ${deploymentId}` };
    } catch (error) {
        return handleApiError(error);
    }
}

// =================================================================
// Execution Management
// =================================================================

async function createExecution(context: AIContext, { functionId, body, async, path, method, headers }: { functionId: string, body?: string, async?: boolean, path?: string, method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS', headers?: string }) {
    try {
        const functions = getSdkFunctions(context.project);
        let parsedHeaders: object | undefined;
        if (headers) {
            try {
                parsedHeaders = JSON.parse(headers);
            } catch (e) {
                return { error: 'Invalid JSON format for headers. Please provide a valid JSON string.' };
            }
        }
        return await functions.createExecution(functionId, body, async, path, method as any, parsedHeaders);
    } catch (error) {
        return handleApiError(error);
    }
}

async function getExecution(context: AIContext, { functionId, executionId }: { functionId: string, executionId: string }) {
    try {
        const functions = getSdkFunctions(context.project);
        return await functions.getExecution(functionId, executionId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function listFunctionExecutions(context: AIContext, { functionId, limit = 100 }: { functionId: string, limit?: number }) {
    const finalLimit = Math.min(limit, 100);
    try {
        const functions = getSdkFunctions(context.project);
        return await functions.listExecutions(functionId, [Query.limit(finalLimit)]);
    } catch (error) {
        if (error instanceof Error) { return { error: `Appwrite API Error: ${error.message}` }; }
        return { error: 'An unknown error occurred while listing executions.' };
    }
}

// =================================================================
// Variable Management
// =================================================================

async function createVariable(context: AIContext, { functionId, key, value }: { functionId: string, key: string, value: string }) {
    try {
        const functions = getSdkFunctions(context.project);
        return await functions.createVariable(functionId, key, value);
    } catch (error) {
        return handleApiError(error);
    }
}

async function getVariable(context: AIContext, { functionId, variableId }: { functionId: string, variableId: string }) {
    try {
        const functions = getSdkFunctions(context.project);
        return await functions.getVariable(functionId, variableId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function listVariables(context: AIContext, { functionId }: { functionId: string }) {
    try {
        const functions = getSdkFunctions(context.project);
        return await functions.listVariables(functionId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function updateVariable(context: AIContext, { functionId, variableId, key, value }: { functionId: string, variableId: string, key: string, value?: string }) {
    try {
        const functions = getSdkFunctions(context.project);
        return await functions.updateVariable(functionId, variableId, key, value);
    } catch (error) {
        return handleApiError(error);
    }
}

async function deleteVariable(context: AIContext, { functionId, variableId }: { functionId: string, variableId: string }) {
    try {
        const functions = getSdkFunctions(context.project);
        await functions.deleteVariable(functionId, variableId);
        return { success: `Successfully deleted variable ${variableId}` };
    } catch (error) {
        return handleApiError(error);
    }
}


export const functionsFunctions = {
    createFunction,
    getFunction,
    listFunctions,
    updateFunction,
    deleteFunction,
    listRuntimes,
    getFunctionDeploymentCode,
    deployNewCodeToFunction,
    createDeployment,
    getDeployment,
    listDeployments,
    deleteDeployment,
    createExecution,
    getExecution,
    listFunctionExecutions,
    createVariable,
    getVariable,
    listVariables,
    updateVariable,
    deleteVariable,
};

export const functionsToolDefinitions: FunctionDeclaration[] = [
    {
        name: 'createFunction',
        description: 'Create a new function.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID. Choose a custom ID or use "unique()" to generate a random one.' },
                name: { type: Type.STRING, description: 'Function name.' },
                runtime: { type: Type.STRING, description: 'Execution runtime (e.g., "node-18.0", "python-3.9"). Use listRuntimes() to see available runtimes.' },
                execute: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Optional. Array of role strings with execution permissions.' },
                events: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Optional. List of events that trigger this function.' },
                schedule: { type: Type.STRING, description: 'Optional. Schedule CRON syntax.' },
                timeout: { type: Type.INTEGER, description: 'Optional. Maximum execution time in seconds.' },
                enabled: { type: Type.BOOLEAN, description: 'Optional. Is the function enabled? Defaults to true.' },
                logging: { type: Type.BOOLEAN, description: 'Optional. Is logging enabled? Defaults to true.' },
                entrypoint: { type: Type.STRING, description: 'Optional. Entrypoint file.' },
                commands: { type: Type.STRING, description: 'Optional. Build commands.' },
                installationId: { type: Type.STRING, description: 'Optional. Appwrite Installation ID for VCS deployment.' },
                providerRepositoryId: { type: Type.STRING, description: 'Optional. Repository ID of the repo linked to the function.' },
                providerBranch: { type: Type.STRING, description: 'Optional. Production branch for the repo linked to the function.' },
                providerSilentMode: { type: Type.BOOLEAN, description: 'Optional. Is the VCS connection in silent mode?' },
                providerRootDirectory: { type: Type.STRING, description: 'Optional. Path to function code in the linked repo.' },
            },
            required: ['functionId', 'name', 'runtime'],
        }
    },
    {
        name: 'getFunction',
        description: 'Get a function by its unique ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID.' },
            },
            required: ['functionId'],
        }
    },
    {
        name: 'listFunctions',
        description: "Get a list of all the project's functions.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                search: { type: Type.STRING, description: 'Optional. Search term to filter results.' },
                limit: { type: Type.INTEGER, description: 'Optional. Maximum number of functions to return. Default is 100.' },
            },
            required: [],
        }
    },
    {
        name: 'updateFunction',
        description: 'Update a function by its unique ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID.' },
                name: { type: Type.STRING, description: 'Function name.' },
                runtime: { type: Type.STRING, description: 'Optional. Execution runtime. If not provided, the existing runtime will be used.' },
                execute: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Optional. Array of role strings with execution permissions.' },
                events: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Optional. List of events that trigger this function.' },
                schedule: { type: Type.STRING, description: 'Optional. Schedule CRON syntax.' },
                timeout: { type: Type.INTEGER, description: 'Optional. Maximum execution time in seconds.' },
                enabled: { type: Type.BOOLEAN, description: 'Optional. Is the function enabled?' },
                logging: { type: Type.BOOLEAN, description: 'Optional. Is logging enabled?' },
                entrypoint: { type: Type.STRING, description: 'Optional. Entrypoint file.' },
                commands: { type: Type.STRING, description: 'Optional. Build commands.' },
                installationId: { type: Type.STRING, description: 'Optional. Appwrite Installation ID for VCS deployment.' },
                providerRepositoryId: { type: Type.STRING, description: 'Optional. Repository ID of the repo linked to the function.' },
                providerBranch: { type: Type.STRING, description: 'Optional. Production branch for the repo linked to the function.' },
                providerSilentMode: { type: Type.BOOLEAN, description: 'Optional. Is the VCS connection in silent mode?' },
                providerRootDirectory: { type: Type.STRING, description: 'Optional. Path to function code in the linked repo.' },
            },
            required: ['functionId', 'name'],
        }
    },
    {
        name: 'deleteFunction',
        description: 'Delete a function by its unique ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID.' },
            },
            required: ['functionId'],
        }
    },
    {
        name: 'listRuntimes',
        description: 'Get a list of all runtimes that are currently active.',
        parameters: { type: Type.OBJECT, properties: {}, required: [] },
    },
     {
        name: 'getFunctionDeploymentCode',
        description: 'Downloads and unpacks the code for a function deployment, returning the file names and their contents. If deploymentId is omitted, it fetches the code for the currently active deployment.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'The ID of the function.' },
                deploymentId: { type: Type.STRING, description: 'Optional. The ID of the deployment to download. Defaults to the active deployment.' },
            },
            required: ['functionId'],
        }
    },
    {
        name: 'deployNewCodeToFunction',
        description: 'Deploys new or updated code to a function. The code is provided as an array of file objects, each with a "name" and "content" property. Use this when the user asks to create, update, or write code for a function, as it allows you to generate the complete source code yourself.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID for which to create the deployment.' },
                files: { 
                    type: Type.ARRAY, 
                    description: 'An array of file objects, each with a "name" and "content" property. You must generate the content for these files.',
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: 'The name of the file (e.g., "index.js").' },
                            content: { type: Type.STRING, description: 'The source code or content of the file.' },
                        },
                        required: ['name', 'content'],
                    } 
                },
                activate: { type: Type.BOOLEAN, description: 'Automatically activate the deployment when it is finished building.' },
                entrypoint: { type: Type.STRING, description: 'Optional. Entrypoint file within the code package (e.g., "src/index.js").' },
                commands: { type: Type.STRING, description: 'Optional. Build commands to run during deployment (e.g., "npm install").' },
            },
            required: ['functionId', 'files', 'activate'],
        }
    },
    {
        name: 'createDeployment',
        description: 'Create a new function code deployment from a user-attached file. The code must be a pre-packaged tar.gz file. Use this to upload a new version of your function code. For raw source files, use packageAndDeployFunction instead.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID for which to create the deployment.' },
                activate: { type: Type.BOOLEAN, description: 'Automatically activate the deployment when it is finished building.' },
                fileName: { type: Type.STRING, description: 'The name of the code package file to deploy (e.g., "code.tar.gz"). This MUST match one of the files attached to the user\'s message. This argument is REQUIRED when multiple files are attached.' },
                entrypoint: { type: Type.STRING, description: 'Optional. Entrypoint file within the code package (e.g., "src/index.js").' },
                commands: { type: Type.STRING, description: 'Optional. Build commands to run during deployment (e.g., "npm install").' },
            },
            required: ['functionId', 'activate'],
        }
    },
    {
        name: 'getDeployment',
        description: 'Get a function deployment by its unique ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID.' },
                deploymentId: { type: Type.STRING, description: 'Deployment ID.' },
            },
            required: ['functionId', 'deploymentId'],
        }
    },
    {
        name: 'listDeployments',
        description: "Get a list of all the function's code deployments.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID.' },
                search: { type: Type.STRING, description: 'Optional. Search term to filter results.' },
                limit: { type: Type.INTEGER, description: 'Optional. Maximum number of deployments to return. Default is 100.' },
            },
            required: ['functionId'],
        }
    },
    {
        name: 'deleteDeployment',
        description: 'Delete a code deployment by its unique ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID.' },
                deploymentId: { type: Type.STRING, description: 'Deployment ID.' },
            },
            required: ['functionId', 'deploymentId'],
        }
    },
    {
        name: 'createExecution',
        description: 'Trigger a function execution asynchronously or synchronously.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID.' },
                body: { type: Type.STRING, description: 'Optional. HTTP body of execution.' },
                async: { type: Type.BOOLEAN, description: 'Optional. Execute code in the background. Defaults to false.' },
                path: { type: Type.STRING, description: 'Optional. HTTP path of execution. Can include query params.' },
                method: { type: Type.STRING, description: 'Optional. HTTP method of execution (GET, POST, PUT, etc.). Defaults to GET.' },
                headers: { type: Type.STRING, description: 'Optional. HTTP headers of execution, as a JSON string. E.g., \'{"Content-Type": "application/json"}\'.' },
            },
            required: ['functionId'],
        }
    },
    {
        name: 'getExecution',
        description: 'Get a function execution log by its unique ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID.' },
                executionId: { type: Type.STRING, description: 'Execution ID.' },
            },
            required: ['functionId', 'executionId'],
        }
    },
    {
        name: 'listFunctionExecutions',
        description: "Get a list of all the function's executions (logs).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function ID.' },
                limit: { type: Type.INTEGER, description: 'Optional. The maximum number of executions to return. Default is 100.' },
            },
            required: ['functionId']
        }
    },
    {
        name: 'createVariable',
        description: 'Create a new function environment variable.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function unique ID.' },
                key: { type: Type.STRING, description: 'Variable key.' },
                value: { type: Type.STRING, description: 'Variable value.' },
            },
            required: ['functionId', 'key', 'value'],
        }
    },
    {
        name: 'getVariable',
        description: 'Get a variable by its unique ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function unique ID.' },
                variableId: { type: Type.STRING, description: 'Variable unique ID.' },
            },
            required: ['functionId', 'variableId'],
        }
    },
    {
        name: 'listVariables',
        description: 'Get a list of all variables of a specific function.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function unique ID.' },
            },
            required: ['functionId'],
        }
    },
    {
        name: 'updateVariable',
        description: 'Update a variable by its unique ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function unique ID.' },
                variableId: { type: Type.STRING, description: 'Variable unique ID.' },
                key: { type: Type.STRING, description: 'Variable key.' },
                value: { type: Type.STRING, description: 'Optional. Variable value. If not passed, it will be an empty string.' },
            },
            required: ['functionId', 'variableId', 'key'],
        }
    },
    {
        name: 'deleteVariable',
        description: 'Delete a variable by its unique ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                functionId: { type: Type.STRING, description: 'Function unique ID.' },
                variableId: { type: Type.STRING, description: 'Variable unique ID.' },
            },
            required: ['functionId', 'variableId'],
        }
    },
];
