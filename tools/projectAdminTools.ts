import * as adminService from '../services/projectAdminService';
import type { AIContext } from '../types';
import { Type, type FunctionDeclaration } from '@google/genai';

async function handleApiError(error: unknown) {
    console.error('Appwrite API error in project admin tool:', error);
    if (error instanceof Error) {
        return { error: `Appwrite Project Admin Error: ${error.message}` };
    }
    return { error: 'An unknown error occurred while updating project configurations.' };
}

// 1. API Keys
async function listApiKeys(context: AIContext) {
    try {
        return await adminService.listApiKeys(context.project);
    } catch (e) {
        return handleApiError(e);
    }
}

async function createApiKey(context: AIContext, { name, scopes }: { name: string, scopes: string[] }) {
    try {
        return await adminService.createApiKey(context.project, name, scopes);
    } catch (e) {
        return handleApiError(e);
    }
}

async function deleteApiKey(context: AIContext, { keyId }: { keyId: string }) {
    try {
        await adminService.deleteApiKey(context.project, keyId);
        return { success: `Successfully deleted API Key ${keyId}` };
    } catch (e) {
        return handleApiError(e);
    }
}

// 2. Platforms
async function listPlatforms(context: AIContext) {
    try {
        return await adminService.listPlatforms(context.project);
    } catch (e) {
        return handleApiError(e);
    }
}

async function createPlatform(
    context: AIContext,
    { name, type, hostname, packageIdentifier, bundleId }: { name: string, type: 'web' | 'android' | 'apple', hostname?: string, packageIdentifier?: string, bundleId?: string }
) {
    try {
        return await adminService.createPlatform(context.project, name, type, hostname, packageIdentifier, bundleId);
    } catch (e) {
        return handleApiError(e);
    }
}

async function deletePlatform(context: AIContext, { platformId }: { platformId: string }) {
    try {
        await adminService.deletePlatform(context.project, platformId);
        return { success: `Successfully deleted platform ${platformId}` };
    } catch (e) {
        return handleApiError(e);
    }
}

async function addStudioCorsFixer(context: AIContext) {
    try {
        const origin = window.location.origin;
        const hostname = window.location.hostname;
        const name = `DV Studio (Auto-Registered)`;
        
        // Check if platform already exists
        const platforms = await adminService.listPlatforms(context.project);
        const exists = platforms.some(p => p.type === 'web' && p.hostname === hostname);
        if (exists) {
            return { success: `Domain "${hostname}" is already registered as an authorized Web platform.` };
        }

        const newPlatform = await adminService.createPlatform(context.project, name, 'web', hostname);
        return { success: `Successfully registered "${hostname}" as Web Platform in project settings. CORS issue resolved!`, platform: newPlatform };
    } catch (e) {
        return handleApiError(e);
    }
}

// 3. Global Variables
async function listGlobalVariables(context: AIContext) {
    try {
        return await adminService.listGlobalVariables(context.project);
    } catch (e) {
        return handleApiError(e);
    }
}

async function createGlobalVariable(context: AIContext, { key, value }: { key: string, value: string }) {
    try {
        return await adminService.createGlobalVariable(context.project, key, value);
    } catch (e) {
        return handleApiError(e);
    }
}

async function updateGlobalVariable(context: AIContext, { variableId, key, value }: { variableId: string, key: string, value: string }) {
    try {
        return await adminService.updateGlobalVariable(context.project, variableId, key, value);
    } catch (e) {
        return handleApiError(e);
    }
}

async function deleteGlobalVariable(context: AIContext, { variableId }: { variableId: string }) {
    try {
        await adminService.deleteGlobalVariable(context.project, variableId);
        return { success: `Successfully deleted global variable ${variableId}` };
    } catch (e) {
        return handleApiError(e);
    }
}

// 4. Auth & OAuth Configurations
async function getAuthSettings(context: AIContext) {
    try {
        return await adminService.getAuthSettings(context.project);
    } catch (e) {
        return handleApiError(e);
    }
}

async function toggleAuthMethod(
    context: AIContext,
    { method, enabled }: { method: 'emailPassword' | 'magicLink' | 'anonymous' | 'phone' | 'invites', enabled: boolean }
) {
    try {
        await adminService.updateAuthMethod(context.project, method, enabled);
        return { success: `Successfully ${enabled ? 'enabled' : 'disabled'} authentication route: ${method}` };
    } catch (e) {
        return handleApiError(e);
    }
}

export const projectAdminFunctions = {
    listApiKeys,
    createApiKey,
    deleteApiKey,
    listPlatforms,
    createPlatform,
    deletePlatform,
    addStudioCorsFixer,
    listGlobalVariables,
    createGlobalVariable,
    updateGlobalVariable,
    deleteGlobalVariable,
    getAuthSettings,
    toggleAuthMethod,
};

export const projectAdminToolDefinitions: FunctionDeclaration[] = [
    {
        name: 'listApiKeys',
        description: 'Get a list of all administrative API keys created in the project.',
        parameters: { type: Type.OBJECT, properties: {}, required: [] },
    },
    {
        name: 'createApiKey',
        description: 'Create a new administrative API Key with specific capability scopes.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: 'Descriptive name for the API key.' },
                scopes: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING }, 
                    description: 'Scopes list, e.g. ["databases.read", "databases.write", "users.read", "users.write"].' 
                }
            },
            required: ['name', 'scopes'],
        },
    },
    {
        name: 'deleteApiKey',
        description: 'Delete or revoke an API Key by its unique ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                keyId: { type: Type.STRING, description: 'API Key unique ID.' }
            },
            required: ['keyId'],
        },
    },
    {
        name: 'listPlatforms',
        description: 'Get a list of all client platforms registered (Web hosts, iOS/Android apps) in the project.',
        parameters: { type: Type.OBJECT, properties: {}, required: [] },
    },
    {
        name: 'createPlatform',
        description: 'Register a new client platform (Web, Android, Apple bundle).',
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: 'Human-readable name.' },
                type: { type: Type.STRING, description: 'Platform type: "web", "android", or "apple".' },
                hostname: { type: Type.STRING, description: 'Required for "web". Target domain/hostname, e.g. "localhost" or "app.example.com".' },
                packageIdentifier: { type: Type.STRING, description: 'Required for "android". Application ID, e.g. "com.example.app".' },
                bundleId: { type: Type.STRING, description: 'Required for "apple". Bundle ID, e.g. "com.example.appleapp".' },
            },
            required: ['name', 'type'],
        },
    },
    {
        name: 'deletePlatform',
        description: 'Delete or deregister a client platform by its ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                platformId: { type: Type.STRING, description: 'Platform ID.' }
            },
            required: ['platformId'],
        },
    },
    {
        name: 'addStudioCorsFixer',
        description: 'Automatically register the current DV Backend Studio workspace domain as an authorized Web platform to immediately fix "Failed to fetch" CORS errors.',
        parameters: { type: Type.OBJECT, properties: {}, required: [] },
    },
    {
        name: 'listGlobalVariables',
        description: 'List project-wide global environment variables.',
        parameters: { type: Type.OBJECT, properties: {}, required: [] },
    },
    {
        name: 'createGlobalVariable',
        description: 'Create a new project-wide environment variable.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                key: { type: Type.STRING, description: 'Variable key name, e.g. "API_ENDPOINT".' },
                value: { type: Type.STRING, description: 'Variable value string.' }
            },
            required: ['key', 'value'],
        },
    },
    {
        name: 'updateGlobalVariable',
        description: 'Update an existing project-wide environment variable.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                variableId: { type: Type.STRING, description: 'Variable unique ID.' },
                key: { type: Type.STRING, description: 'New key name.' },
                value: { type: Type.STRING, description: 'New value.' }
            },
            required: ['variableId', 'key', 'value'],
        },
    },
    {
        name: 'deleteGlobalVariable',
        description: 'Delete a project-wide environment variable.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                variableId: { type: Type.STRING, description: 'Variable unique ID.' }
            },
            required: ['variableId'],
        },
    },
    {
        name: 'getAuthSettings',
        description: 'Get project password security limits, enabled auth paths, and OAuth providers.',
        parameters: { type: Type.OBJECT, properties: {}, required: [] },
    },
    {
        name: 'toggleAuthMethod',
        description: 'Enable or disable a specific authentication pathway.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                method: { type: Type.STRING, description: 'Pathway name: "emailPassword", "magicLink", "anonymous", "phone", or "invites".' },
                enabled: { type: Type.BOOLEAN, description: 'Enable state.' }
            },
            required: ['method', 'enabled'],
        },
    },
];
