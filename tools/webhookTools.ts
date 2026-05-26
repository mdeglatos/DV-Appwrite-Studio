import * as adminService from '../services/projectAdminService';
import type { AIContext } from '../types';
import { Type, type FunctionDeclaration } from '@google/genai';

async function handleApiError(error: unknown) {
    console.error('Appwrite API error in webhook tool:', error);
    if (error instanceof Error) {
        return { error: `Appwrite Webhook Error: ${error.message}` };
    }
    return { error: 'An unknown error occurred while communicating with the Appwrite Webhooks service.' };
}

async function listWebhooks(context: AIContext) {
    try {
        return await adminService.listWebhooks(context.project);
    } catch (e) {
        return handleApiError(e);
    }
}

async function createWebhook(
    context: AIContext, 
    { name, url, events, security }: { name: string, url: string, events: string[], security: boolean }
) {
    try {
        return await adminService.createWebhook(context.project, name, url, events, security);
    } catch (e) {
        return handleApiError(e);
    }
}

async function deleteWebhook(context: AIContext, { webhookId }: { webhookId: string }) {
    try {
        await adminService.deleteWebhook(context.project, webhookId);
        return { success: `Successfully deleted webhook ${webhookId}` };
    } catch (e) {
        return handleApiError(e);
    }
}

export const webhookFunctions = {
    listWebhooks,
    createWebhook,
    deleteWebhook,
};

export const webhookToolDefinitions: FunctionDeclaration[] = [
    {
        name: 'listWebhooks',
        description: 'Get a list of registered webhook endpoints configured for event notifications.',
        parameters: { type: Type.OBJECT, properties: {}, required: [] },
    },
    {
        name: 'createWebhook',
        description: 'Create a new webhook to post events payloads to a destination HTTP url.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: 'Descriptive webhook name.' },
                url: { type: Type.STRING, description: 'Target destination POST URL.' },
                events: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING }, 
                    description: 'System trigger events list, e.g. ["users.create", "databases.*.collections.*.documents.*.create"].' 
                },
                security: { type: Type.BOOLEAN, description: 'SSL certificate verification toggle.' }
            },
            required: ['name', 'url', 'events', 'security'],
        },
    },
    {
        name: 'deleteWebhook',
        description: 'Delete a webhook configuration by its unique ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                webhookId: { type: Type.STRING, description: 'Webhook unique ID.' }
            },
            required: ['webhookId'],
        },
    },
];
