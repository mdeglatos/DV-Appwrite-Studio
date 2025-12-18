
import { Client, Account, ID, AppwriteException, Query, Permission, Role } from 'appwrite';
import { Client as NodeClient, Databases, Storage, Functions, Users, Teams } from 'node-appwrite';
import type { AppwriteProject } from '../types';
import { appwriteConfig } from '../config';

// Main client for user authentication, connected to the app's own backend.
export const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId);

export const account = new Account(client);

/**
 * Normalizes an Appwrite endpoint URL.
 * Ensures protocol is present and removes trailing slashes.
 */
function normalizeEndpoint(endpoint: string): string {
    if (!endpoint) return '';
    let clean = endpoint.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http')) {
        clean = `https://${clean}`;
    }
    // Ensure /v1 is appended if missing, as SDKs expect the base path
    if (!clean.endsWith('/v1') && !clean.includes('/v1/')) {
        clean = `${clean}/v1`;
    }
    return clean;
}

/**
 * Enhanced error translator for browser-specific fetch issues.
 */
export function handleFetchError(error: any): string {
    const msg = error?.message || String(error);
    if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        return `Connection Failed: This is likely a CORS issue. Please ensure "${window.location.origin}" is added as a 'Web Platform' in your Appwrite Project settings.`;
    }
    return msg;
}

/**
 * Creates a temporary, admin-level Appwrite client for a specific user-defined project.
 */
function createProjectAdminClient(project: AppwriteProject): NodeClient {
    if (!project || !project.endpoint || !project.projectId || !project.apiKey) {
        throw new Error('Appwrite project configuration is missing or incomplete.');
    }
    
    const client = new NodeClient();
    client
        .setEndpoint(normalizeEndpoint(project.endpoint))
        .setProject(project.projectId.trim())
        .setKey(project.apiKey.trim());
    return client;
}

export function getSdkDatabases(project: AppwriteProject): Databases {
    return new Databases(createProjectAdminClient(project));
}

export function getSdkStorage(project: AppwriteProject): Storage {
    return new Storage(createProjectAdminClient(project));
}

export function getSdkFunctions(project: AppwriteProject): Functions {
    return new Functions(createProjectAdminClient(project));
}

export function getSdkUsers(project: AppwriteProject): Users {
    return new Users(createProjectAdminClient(project));
}

export function getSdkTeams(project: AppwriteProject): Teams {
    return new Teams(createProjectAdminClient(project));
}

export { ID, Query, Permission, Role, AppwriteException };
