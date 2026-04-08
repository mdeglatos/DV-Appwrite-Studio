import { getSdkSites, ID, Query } from '../services/appwrite';
import type { AIContext } from '../types';
import { Type, type FunctionDeclaration } from '@google/genai';

async function handleApiError(error: unknown) {
    console.error('Appwrite API error in sites tool:', error);
    if (error instanceof Error) {
        return { error: `Appwrite API Error: ${error.message}` };
    }
    return { error: 'An unknown error occurred while communicating with the Appwrite API.' };
}

// ============================================================================
// Site CRUD
// ============================================================================

async function listSites(context: AIContext, { limit = 25, search }: { limit?: number; search?: string }) {
    const finalLimit = Math.min(limit, 100);
    try {
        const sites = getSdkSites(context.project);
        const queries: string[] = [Query.limit(finalLimit), Query.orderDesc('$createdAt')];
        return await sites.list(queries, search);
    } catch (error) {
        return handleApiError(error);
    }
}

async function getSite(context: AIContext, { siteId }: { siteId: string }) {
    try {
        const sites = getSdkSites(context.project);
        return await sites.get(siteId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function createSite(context: AIContext, {
    siteId, name, framework, buildRuntime,
    enabled, logging, timeout,
    installCommand, buildCommand, outputDirectory,
    adapter, fallbackFile, specification,
}: {
    siteId: string; name: string; framework: string; buildRuntime: string;
    enabled?: boolean; logging?: boolean; timeout?: number;
    installCommand?: string; buildCommand?: string; outputDirectory?: string;
    adapter?: string; fallbackFile?: string; specification?: string;
}) {
    try {
        const sites = getSdkSites(context.project);
        const finalSiteId = siteId.toLowerCase() === 'unique()' ? ID.unique() : siteId;
        return await sites.create(
            finalSiteId, name, framework as any, buildRuntime as any,
            enabled, logging, timeout,
            installCommand, buildCommand, outputDirectory,
            adapter as any, undefined, // installationId
            fallbackFile, undefined, undefined, undefined, undefined, // provider fields
            specification
        );
    } catch (error) {
        return handleApiError(error);
    }
}

async function updateSite(context: AIContext, {
    siteId, name, framework,
    enabled, logging, timeout,
    installCommand, buildCommand, outputDirectory,
    buildRuntime, adapter, fallbackFile, specification,
}: {
    siteId: string; name: string; framework: string;
    enabled?: boolean; logging?: boolean; timeout?: number;
    installCommand?: string; buildCommand?: string; outputDirectory?: string;
    buildRuntime?: string; adapter?: string; fallbackFile?: string; specification?: string;
}) {
    try {
        const sites = getSdkSites(context.project);
        return await sites.update(
            siteId, name, framework as any,
            enabled, logging, timeout,
            installCommand, buildCommand, outputDirectory,
            buildRuntime as any, adapter as any, fallbackFile,
            undefined, undefined, undefined, undefined, undefined, // provider/installation fields
            specification
        );
    } catch (error) {
        return handleApiError(error);
    }
}

async function deleteSite(context: AIContext, { siteId }: { siteId: string }) {
    try {
        const sites = getSdkSites(context.project);
        await sites.delete(siteId);
        return { success: `Successfully deleted site ${siteId}` };
    } catch (error) {
        return handleApiError(error);
    }
}

// ============================================================================
// Deployment Management
// ============================================================================

async function listSiteDeployments(context: AIContext, { siteId, limit = 25 }: { siteId: string; limit?: number }) {
    const finalLimit = Math.min(limit, 100);
    try {
        const sites = getSdkSites(context.project);
        return await sites.listDeployments(
            siteId,
            [Query.limit(finalLimit), Query.orderDesc('$createdAt')]
        );
    } catch (error) {
        return handleApiError(error);
    }
}

async function getSiteDeployment(context: AIContext, { siteId, deploymentId }: { siteId: string; deploymentId: string }) {
    try {
        const sites = getSdkSites(context.project);
        return await sites.getDeployment(siteId, deploymentId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function createSiteVcsDeployment(context: AIContext, {
    siteId, type, reference, activate
}: {
    siteId: string; type: string; reference: string; activate?: boolean;
}) {
    try {
        const sites = getSdkSites(context.project);
        return await sites.createVcsDeployment(siteId, type as any, reference, activate);
    } catch (error) {
        return handleApiError(error);
    }
}

async function activateSiteDeployment(context: AIContext, { siteId, deploymentId }: { siteId: string; deploymentId: string }) {
    try {
        const sites = getSdkSites(context.project);
        return await sites.updateSiteDeployment(siteId, deploymentId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function cancelSiteDeployment(context: AIContext, { siteId, deploymentId }: { siteId: string; deploymentId: string }) {
    try {
        const sites = getSdkSites(context.project);
        return await sites.updateDeploymentStatus(siteId, deploymentId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function deleteSiteDeployment(context: AIContext, { siteId, deploymentId }: { siteId: string; deploymentId: string }) {
    try {
        const sites = getSdkSites(context.project);
        await sites.deleteDeployment(siteId, deploymentId);
        return { success: `Successfully deleted deployment ${deploymentId} from site ${siteId}` };
    } catch (error) {
        return handleApiError(error);
    }
}

// ============================================================================
// Environment Variables
// ============================================================================

async function listSiteVariables(context: AIContext, { siteId }: { siteId: string }) {
    try {
        const sites = getSdkSites(context.project);
        return await sites.listVariables(siteId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function createSiteVariable(context: AIContext, {
    siteId, key, value, secret
}: {
    siteId: string; key: string; value: string; secret?: boolean;
}) {
    try {
        const sites = getSdkSites(context.project);
        return await sites.createVariable(siteId, key, value, secret);
    } catch (error) {
        return handleApiError(error);
    }
}

async function updateSiteVariable(context: AIContext, {
    siteId, variableId, key, value, secret
}: {
    siteId: string; variableId: string; key: string; value?: string; secret?: boolean;
}) {
    try {
        const sites = getSdkSites(context.project);
        return await sites.updateVariable(siteId, variableId, key, value, secret);
    } catch (error) {
        return handleApiError(error);
    }
}

async function deleteSiteVariable(context: AIContext, { siteId, variableId }: { siteId: string; variableId: string }) {
    try {
        const sites = getSdkSites(context.project);
        await sites.deleteVariable(siteId, variableId);
        return { success: `Successfully deleted variable ${variableId} from site ${siteId}` };
    } catch (error) {
        return handleApiError(error);
    }
}

// ============================================================================
// Logs
// ============================================================================

async function listSiteLogs(context: AIContext, { siteId, limit = 25 }: { siteId: string; limit?: number }) {
    const finalLimit = Math.min(limit, 100);
    try {
        const sites = getSdkSites(context.project);
        return await sites.listLogs(
            siteId,
            [Query.limit(finalLimit)]
        );
    } catch (error) {
        return handleApiError(error);
    }
}

// ============================================================================
// Exports
// ============================================================================

export const sitesFunctions = {
    listSites,
    getSite,
    createSite,
    updateSite,
    deleteSite,
    listSiteDeployments,
    getSiteDeployment,
    createSiteVcsDeployment,
    activateSiteDeployment,
    cancelSiteDeployment,
    deleteSiteDeployment,
    listSiteVariables,
    createSiteVariable,
    updateSiteVariable,
    deleteSiteVariable,
    listSiteLogs,
};

export const sitesToolDefinitions: FunctionDeclaration[] = [
    // -- Site CRUD --
    {
        name: 'listSites',
        description: 'List all sites (hosted web applications) in the Appwrite project. Returns site names, frameworks, statuses, and deployment info.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                limit: { type: Type.INTEGER, description: 'Optional. Max sites to return. Default 25, max 100.' },
                search: { type: Type.STRING, description: 'Optional. Search term to filter sites by name.' },
            },
            required: [],
        },
    },
    {
        name: 'getSite',
        description: 'Get details of a specific site by its ID, including framework, build settings, deployment status, and domain.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
            },
            required: ['siteId'],
        },
    },
    {
        name: 'createSite',
        description: 'Create a new Appwrite Site (hosted web application). Requires a name, framework (e.g. "nextjs", "nuxt", "sveltekit", "astro", "react", "vue", "angular", "remix", "static"), and build runtime (e.g. "node-14.5", "node-16", "node-18", "node-21").',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID. Use "unique()" to auto-generate.' },
                name: { type: Type.STRING, description: 'Site name.' },
                framework: { type: Type.STRING, description: 'Framework identifier (e.g. "nextjs", "nuxt", "sveltekit", "astro", "react", "vue", "angular", "remix", "static").' },
                buildRuntime: { type: Type.STRING, description: 'Build runtime (e.g. "node-14.5", "node-16", "node-18", "node-21").' },
                enabled: { type: Type.BOOLEAN, description: 'Optional. Enable the site. Default true.' },
                logging: { type: Type.BOOLEAN, description: 'Optional. Enable request logging.' },
                timeout: { type: Type.INTEGER, description: 'Optional. Build timeout in seconds.' },
                installCommand: { type: Type.STRING, description: 'Optional. Custom install command (e.g. "npm install").' },
                buildCommand: { type: Type.STRING, description: 'Optional. Custom build command (e.g. "npm run build").' },
                outputDirectory: { type: Type.STRING, description: 'Optional. Build output directory (e.g. ".next", "dist", "build").' },
                adapter: { type: Type.STRING, description: 'Optional. Deployment adapter ("static" or "ssr").' },
                fallbackFile: { type: Type.STRING, description: 'Optional. Fallback file for SPAs (e.g. "index.html").' },
                specification: { type: Type.STRING, description: 'Optional. Build specification/machine size.' },
            },
            required: ['siteId', 'name', 'framework', 'buildRuntime'],
        },
    },
    {
        name: 'updateSite',
        description: 'Update an existing site\'s settings — name, framework, build commands, timeout, logging, etc.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
                name: { type: Type.STRING, description: 'Site name.' },
                framework: { type: Type.STRING, description: 'Framework identifier.' },
                enabled: { type: Type.BOOLEAN, description: 'Optional. Enable/disable the site.' },
                logging: { type: Type.BOOLEAN, description: 'Optional. Enable/disable request logging.' },
                timeout: { type: Type.INTEGER, description: 'Optional. Build timeout in seconds.' },
                installCommand: { type: Type.STRING, description: 'Optional. Custom install command.' },
                buildCommand: { type: Type.STRING, description: 'Optional. Custom build command.' },
                outputDirectory: { type: Type.STRING, description: 'Optional. Build output directory.' },
                buildRuntime: { type: Type.STRING, description: 'Optional. Build runtime.' },
                adapter: { type: Type.STRING, description: 'Optional. Deployment adapter.' },
                fallbackFile: { type: Type.STRING, description: 'Optional. Fallback file for SPAs.' },
                specification: { type: Type.STRING, description: 'Optional. Build specification.' },
            },
            required: ['siteId', 'name', 'framework'],
        },
    },
    {
        name: 'deleteSite',
        description: 'Delete a site and all its deployments from the Appwrite project.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
            },
            required: ['siteId'],
        },
    },

    // -- Deployments --
    {
        name: 'listSiteDeployments',
        description: 'List all deployments for a site. Each deployment represents a version of the web app.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
                limit: { type: Type.INTEGER, description: 'Optional. Max deployments to return. Default 25.' },
            },
            required: ['siteId'],
        },
    },
    {
        name: 'getSiteDeployment',
        description: 'Get details of a specific site deployment including status, build logs, and size.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
                deploymentId: { type: Type.STRING, description: 'Deployment ID.' },
            },
            required: ['siteId', 'deploymentId'],
        },
    },
    {
        name: 'createSiteVcsDeployment',
        description: 'Trigger a new deployment from a Git branch or tag. The site must be connected to a Git repository.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
                type: { type: Type.STRING, description: 'Reference type: "branch" or "tag".' },
                reference: { type: Type.STRING, description: 'Branch name or tag (e.g. "main", "develop", "v1.0.0").' },
                activate: { type: Type.BOOLEAN, description: 'Optional. Activate the deployment after build completes.' },
            },
            required: ['siteId', 'type', 'reference'],
        },
    },
    {
        name: 'activateSiteDeployment',
        description: 'Activate a ready deployment, making it the live version of the site. This performs an instant rollback/rollforward.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
                deploymentId: { type: Type.STRING, description: 'Deployment ID to activate.' },
            },
            required: ['siteId', 'deploymentId'],
        },
    },
    {
        name: 'cancelSiteDeployment',
        description: 'Cancel an in-progress site deployment build.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
                deploymentId: { type: Type.STRING, description: 'Deployment ID to cancel.' },
            },
            required: ['siteId', 'deploymentId'],
        },
    },
    {
        name: 'deleteSiteDeployment',
        description: 'Delete a specific deployment from a site.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
                deploymentId: { type: Type.STRING, description: 'Deployment ID.' },
            },
            required: ['siteId', 'deploymentId'],
        },
    },

    // -- Variables --
    {
        name: 'listSiteVariables',
        description: 'List all environment variables configured for a site.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
            },
            required: ['siteId'],
        },
    },
    {
        name: 'createSiteVariable',
        description: 'Create a new environment variable for a site. The site must be redeployed for the variable to take effect.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
                key: { type: Type.STRING, description: 'Variable key/name (e.g. "API_KEY").' },
                value: { type: Type.STRING, description: 'Variable value.' },
                secret: { type: Type.BOOLEAN, description: 'Optional. Mark as secret (value hidden in console).' },
            },
            required: ['siteId', 'key', 'value'],
        },
    },
    {
        name: 'updateSiteVariable',
        description: 'Update an existing environment variable for a site.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
                variableId: { type: Type.STRING, description: 'Variable ID.' },
                key: { type: Type.STRING, description: 'Variable key.' },
                value: { type: Type.STRING, description: 'Optional. New variable value.' },
                secret: { type: Type.BOOLEAN, description: 'Optional. Mark as secret.' },
            },
            required: ['siteId', 'variableId', 'key'],
        },
    },
    {
        name: 'deleteSiteVariable',
        description: 'Delete an environment variable from a site.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
                variableId: { type: Type.STRING, description: 'Variable ID.' },
            },
            required: ['siteId', 'variableId'],
        },
    },

    // -- Logs --
    {
        name: 'listSiteLogs',
        description: 'List recent request logs for a site. Shows HTTP method, path, status code, and duration for each request.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                siteId: { type: Type.STRING, description: 'Site ID.' },
                limit: { type: Type.INTEGER, description: 'Optional. Max logs to return. Default 25.' },
            },
            required: ['siteId'],
        },
    },
];
