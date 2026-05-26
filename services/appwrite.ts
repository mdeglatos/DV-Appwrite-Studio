
import { Client, Account, ID, AppwriteException, Query, Permission, Role } from 'appwrite';
import { Client as NodeClient, Databases, Storage, Functions, Users, Teams, Sites, Messaging, Health } from 'node-appwrite';
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
export function normalizeEndpoint(endpoint: string): string {
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
 * Generates a deep link to the Appwrite Console for a specific resource.
 * The project segment follows the pattern: project-default-[PROJECT_ID]
 */
export function getConsoleUrl(project: AppwriteProject, path: string = ''): string {
    // Convert https://host/v1 to https://host/console
    const base = project.endpoint.replace(/\/v1\/?$/, '/console');
    const projectPart = `project-default-${project.projectId}`;
    return `${base}/${projectPart}${path}`;
}

export const consoleLinks = {
    overview: (p: AppwriteProject) => getConsoleUrl(p, '/overview'),
    databases: (p: AppwriteProject) => getConsoleUrl(p, '/databases'),
    database: (p: AppwriteProject, dbId: string) => getConsoleUrl(p, `/databases/database-${dbId}`),
    collection: (p: AppwriteProject, dbId: string, collId: string) => getConsoleUrl(p, `/databases/database-${dbId}/collection-${collId}`),
    storage: (p: AppwriteProject) => getConsoleUrl(p, '/storage'),
    bucket: (p: AppwriteProject, bucketId: string) => getConsoleUrl(p, `/storage/bucket-${bucketId}`),
    functions: (p: AppwriteProject) => getConsoleUrl(p, '/functions'),
    function: (p: AppwriteProject, funcId: string) => getConsoleUrl(p, `/functions/function-${funcId}`),
    functionDomains: (p: AppwriteProject, funcId: string) => getConsoleUrl(p, `/functions/function-${funcId}/domains`),
    users: (p: AppwriteProject) => getConsoleUrl(p, '/auth/users'),
    teams: (p: AppwriteProject) => getConsoleUrl(p, '/auth/teams'),
    sites: (p: AppwriteProject) => getConsoleUrl(p, '/sites'),
    site: (p: AppwriteProject, siteId: string) => getConsoleUrl(p, `/sites/site-${siteId}`),
    settings: (p: AppwriteProject) => getConsoleUrl(p, '/settings'),
    apiKeys: (p: AppwriteProject) => getConsoleUrl(p, '/overview/keys'),
};

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

function jsonToLegacyQuery(qObj: { method?: string; attribute?: string; values?: any[] } | null | undefined): string | null {
    if (!qObj || typeof qObj !== 'object' || !qObj.method) {
        return null;
    }
    const method = qObj.method;
    const attribute = qObj.attribute;
    const values = qObj.values;

    const formatValue = (val: any): string => {
        if (Array.isArray(val)) {
            return '[' + val.map(formatValue).join(',') + ']';
        }
        if (typeof val === 'string') {
            return `"${val.replace(/"/g, '\\"')}"`;
        }
        if (typeof val === 'number' || typeof val === 'boolean') {
            return String(val);
        }
        if (val === null) {
            return 'null';
        }
        return String(val);
    };

    if (attribute !== undefined && attribute !== null) {
        if (values !== undefined && values !== null) {
            if (values.length === 1) {
                return `${method}("${attribute}", ${formatValue(values[0])})`;
            }
            return `${method}("${attribute}", ${formatValue(values)})`;
        }
        return `${method}("${attribute}")`;
    } else {
        if (values !== undefined && values !== null) {
            if (values.length === 1) {
                return `${method}(${formatValue(values[0])})`;
            }
            return `${method}(${formatValue(values)})`;
        }
        return `${method}()`;
    }
}

const versionCache: Record<string, { isLegacy: boolean; version?: string; checking?: Promise<boolean> }> = {};

/**
 * Detects whether the Appwrite server at the given endpoint is legacy (v1.3 or older)
 * by making a lightweight fetch check or checking the domain name.
 */
export async function detectServerVersion(endpoint: string, projectId?: string): Promise<boolean> {
    if (!endpoint) return false;
    const cleanEndpoint = normalizeEndpoint(endpoint);
    
    if (versionCache[cleanEndpoint]) {
        if (versionCache[cleanEndpoint].checking) {
            return versionCache[cleanEndpoint].checking!;
        }
        return versionCache[cleanEndpoint].isLegacy;
    }

    const promise = (async () => {
        try {
            if (cleanEndpoint.includes('cloud.appwrite.io')) {
                versionCache[cleanEndpoint] = { isLegacy: false, version: 'cloud' };
                return false;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const headers: Record<string, string> = {};
            if (projectId) {
                headers['x-appwrite-project'] = projectId.trim();
            }

            const res = await fetch(cleanEndpoint, {
                method: 'GET',
                headers,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const data = await res.json();
            if (data && typeof data === 'object' && typeof data.version === 'string') {
                const verParts = data.version.split('.').map(Number);
                const isLegacy = verParts[0] < 1 || (verParts[0] === 1 && verParts[1] < 4);
                versionCache[cleanEndpoint] = { isLegacy, version: data.version };
                return isLegacy;
            }
        } catch (e) {
            // Ignore fetch/parse errors - defaults to modern
        }
        return false;
    })();

    versionCache[cleanEndpoint] = { isLegacy: false, checking: promise };
    const isLegacy = await promise;
    versionCache[cleanEndpoint] = { isLegacy };
    return isLegacy;
}

/**
 * Creates a temporary, admin-level Appwrite client for a specific user-defined project.
 */
export function configureClient(client: NodeClient): NodeClient {
    // Force disable caching for admin requests to prevent stale data
    if (typeof (client as any).addHeader === 'function') {
        (client as any).addHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        (client as any).addHeader('Pragma', 'no-cache');
        (client as any).addHeader('Expires', '0');
    }

    // Monkey-patch the 'call' method to inject a unique timestamp query parameter
    // into GET requests. This forces the browser to bypass cache even if headers are ignored.
    // Also parse and extract limit, offset, and search from queries for legacy Appwrite server compatibility.
    const originalCall = (client as any).call.bind(client);
    (client as any).call = async (method: string, url: URL, headers: any, params: any, responseType: any) => {
        const endpoint = (client as any).config?.endpoint;
        const projectId = (client as any).config?.project;
        const isLegacy = endpoint ? await detectServerVersion(endpoint, projectId) : false;

        if (method.toLowerCase() === 'get') {
            params = params || {};
            // Using a specific key that Appwrite likely ignores or treats as extra
            params['__t'] = Date.now();

            if (isLegacy && Array.isArray(params.queries)) {
                params.queries = params.queries.map((q: any) => {
                    if (typeof q === 'string') {
                        if (q.trim().startsWith('{')) {
                            try {
                                const parsed = JSON.parse(q);
                                const legacy = jsonToLegacyQuery(parsed);
                                if (legacy) {
                                    if (parsed.method === 'limit' && parsed.values && parsed.values[0] !== undefined) {
                                        params.limit = parsed.values[0];
                                    } else if (parsed.method === 'offset' && parsed.values && parsed.values[0] !== undefined) {
                                        params.offset = parsed.values[0];
                                    } else if (parsed.method === 'search' && parsed.values && parsed.values[0] !== undefined) {
                                        params.search = parsed.values[0];
                                    }
                                    return legacy;
                                }
                            } catch (e) {
                                // Ignore JSON parse errors
                            }
                        } else {
                            // Extract limit, offset, and search from legacy strings if present
                            const limitMatch = q.match(/^limit\((\d+)\)$/);
                            if (limitMatch) {
                                params.limit = parseInt(limitMatch[1], 10);
                            }
                            const offsetMatch = q.match(/^offset\((\d+)\)$/);
                            if (offsetMatch) {
                                params.offset = parseInt(offsetMatch[1], 10);
                            }
                            const searchMatch = q.match(/^search\((.+)\)$/);
                            if (searchMatch) {
                                params.search = searchMatch[1];
                            }
                        }
                    }
                    return q;
                });
            }
        }
        return originalCall(method, url, headers, params, responseType);
    };

    return client;
}

export function createProjectAdminClient(project: AppwriteProject): NodeClient {
    if (!project || !project.endpoint || !project.projectId || !project.apiKey) {
        throw new Error('Appwrite project configuration is missing or incomplete.');
    }
    
    const client = new NodeClient();
    client
        .setEndpoint(normalizeEndpoint(project.endpoint))
        .setProject(project.projectId.trim())
        .setKey(project.apiKey.trim());

    return configureClient(client);
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

export function getSdkSites(project: AppwriteProject): Sites {
    return new Sites(createProjectAdminClient(project));
}

export function getSdkMessaging(project: AppwriteProject): Messaging {
    return new Messaging(createProjectAdminClient(project));
}

export function getSdkHealth(project: AppwriteProject): Health {
    return new Health(createProjectAdminClient(project));
}

export async function listAll<T>(
    listFn: (queries: string[]) => Promise<{ total: number; [key: string]: any }>,
    itemsKey: string,
    extraQueries: string[] = [],
    maxItems: number = 5000
): Promise<T[]> {
    const allItems: T[] = [];
    let offset = 0;
    const limit = 100;
    let total = Infinity;

    while (offset < total && allItems.length < maxItems) {
        const res = await listFn([
            Query.limit(limit),
            Query.offset(offset),
            ...extraQueries
        ]);
        total = res.total;
        const items = res[itemsKey] as T[] | undefined;
        if (!items || items.length === 0) break;
        allItems.push(...items);
        offset += items.length;
    }
    return allItems;
}

export { ID, Query, Permission, Role, AppwriteException };

