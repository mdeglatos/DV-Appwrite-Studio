import { getSdkHealth } from '../services/appwrite';
import type { AIContext } from '../types';
import { Type, type FunctionDeclaration } from '@google/genai';

async function getSystemHealth(context: AIContext) {
    try {
        const health = getSdkHealth(context.project);
        const report: Record<string, any> = {};

        // Run checks in parallel with individual error handlers so one failure doesn't block the rest
        const [db, cache, storage, time, antivirus] = await Promise.all([
            health.getDB().catch(e => ({ status: 'error', message: e.message })),
            health.getCache().catch(e => ({ status: 'error', message: e.message })),
            health.getStorage().catch(e => ({ status: 'error', message: e.message })),
            health.getTime().catch(e => ({ status: 'error', message: e.message })),
            health.getAntivirus().catch(e => ({ status: 'error', message: e.message })),
        ]);

        report.database = db;
        report.cache = cache;
        report.storage = storage;
        report.time = time;
        report.antivirus = antivirus;

        // Fetch queue status for messages and webhooks (key metrics for v1.9.0)
        try {
            const webhooksQueue = await health.getQueueWebhooks();
            const messagingQueue = await health.getQueueMessaging();
            report.queues = {
                webhooks: webhooksQueue,
                messaging: messagingQueue
            };
        } catch (e: any) {
            report.queues = { error: e.message };
        }

        return report;
    } catch (error: any) {
        console.error('Appwrite API error in health tool:', error);
        return { error: `Appwrite Health API Error: ${error.message}` };
    }
}

export const healthFunctions = {
    getSystemHealth,
};

export const healthToolDefinitions: FunctionDeclaration[] = [
    {
        name: 'getSystemHealth',
        description: 'Check the overall infrastructure health status of the Appwrite server (Database latency, Cache, Storage systems, NTP Clock sync, Antivirus status, and Queue backlogs).',
        parameters: { type: Type.OBJECT, properties: {}, required: [] },
    },
];
