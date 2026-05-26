import { getSdkMessaging, ID, Query } from '../services/appwrite';
import type { AIContext } from '../types';
import { Type, type FunctionDeclaration } from '@google/genai';

async function handleApiError(error: unknown) {
    console.error('Appwrite API error in messaging tool:', error);
    if (error instanceof Error) {
        return { error: `Appwrite Messaging Error: ${error.message}` };
    }
    return { error: 'An unknown error occurred while communicating with the Appwrite Messaging service.' };
}

// Providers
async function listMessagingProviders(context: AIContext) {
    try {
        const messaging = getSdkMessaging(context.project);
        return await messaging.listProviders();
    } catch (e) {
        return handleApiError(e);
    }
}

// Topics
async function listMessagingTopics(context: AIContext, { limit = 100 }: { limit?: number }) {
    try {
        const messaging = getSdkMessaging(context.project);
        return await messaging.listTopics([Query.limit(Math.min(limit, 100))]);
    } catch (e) {
        return handleApiError(e);
    }
}

async function createMessagingTopic(context: AIContext, { topicId, name, subscribe }: { topicId: string, name: string, subscribe?: string[] }) {
    try {
        const messaging = getSdkMessaging(context.project);
        const finalTopicId = topicId.toLowerCase() === 'unique()' ? ID.unique() : topicId;
        return await messaging.createTopic(finalTopicId, name, subscribe);
    } catch (e) {
        return handleApiError(e);
    }
}

async function deleteMessagingTopic(context: AIContext, { topicId }: { topicId: string }) {
    try {
        const messaging = getSdkMessaging(context.project);
        await messaging.deleteTopic(topicId);
        return { success: `Successfully deleted topic ${topicId}` };
    } catch (e) {
        return handleApiError(e);
    }
}

// Subscribers
async function listMessagingSubscribers(context: AIContext, { topicId, limit = 100 }: { topicId: string, limit?: number }) {
    try {
        const messaging = getSdkMessaging(context.project);
        return await messaging.listSubscribers(topicId, [Query.limit(Math.min(limit, 100))]);
    } catch (e) {
        return handleApiError(e);
    }
}

async function createSubscriber(context: AIContext, { topicId, subscriberId, targetId }: { topicId: string, subscriberId: string, targetId: string }) {
    try {
        const messaging = getSdkMessaging(context.project);
        const finalSubId = subscriberId.toLowerCase() === 'unique()' ? ID.unique() : subscriberId;
        return await messaging.createSubscriber(topicId, finalSubId, targetId);
    } catch (e) {
        return handleApiError(e);
    }
}

async function deleteSubscriber(context: AIContext, { topicId, subscriberId }: { topicId: string, subscriberId: string }) {
    try {
        const messaging = getSdkMessaging(context.project);
        await messaging.deleteSubscriber(topicId, subscriberId);
        return { success: `Successfully deleted subscriber ${subscriberId} from topic ${topicId}` };
    } catch (e) {
        return handleApiError(e);
    }
}

// Broadcast Messages
async function sendBroadcastMessage(
    context: AIContext,
    { channel, messageId, subject, content, title, body, topics, users, targets }: {
        channel: 'email' | 'sms' | 'push';
        messageId: string;
        subject?: string;
        content?: string;
        title?: string;
        body?: string;
        topics?: string[];
        users?: string[];
        targets?: string[];
    }
) {
    try {
        const messaging = getSdkMessaging(context.project);
        const finalMessageId = messageId.toLowerCase() === 'unique()' ? ID.unique() : messageId;
        
        let response;
        if (channel === 'email') {
            if (!subject || !content) {
                return { error: 'Subject and Content parameters are required for Email channel.' };
            }
            response = await messaging.createEmail(finalMessageId, subject, content, topics, users, targets);
        } else if (channel === 'sms') {
            if (!content) {
                return { error: 'Content parameter is required for SMS channel.' };
            }
            response = await messaging.createSms(finalMessageId, content, topics, users, targets);
        } else if (channel === 'push') {
            response = await messaging.createPush(finalMessageId, title, body, topics, users, targets);
        } else {
            return { error: 'Invalid message channel. Choose email, sms, or push.' };
        }
        
        return { success: `Successfully queued ${channel} message.`, message: response };
    } catch (e) {
        return handleApiError(e);
    }
}

export const messagingFunctions = {
    listMessagingProviders,
    listMessagingTopics,
    createMessagingTopic,
    deleteMessagingTopic,
    listMessagingSubscribers,
    createSubscriber,
    deleteSubscriber,
    sendBroadcastMessage,
};

export const messagingToolDefinitions: FunctionDeclaration[] = [
    {
        name: 'listMessagingProviders',
        description: 'Get a list of registered notification providers (email SMTP, SMS Twilio, push FCM/APNs) configured in the project.',
        parameters: { type: Type.OBJECT, properties: {}, required: [] },
    },
    {
        name: 'listMessagingTopics',
        description: 'List notification broadcast topics.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                limit: { type: Type.INTEGER, description: 'Optional. Max topics to retrieve.' }
            },
            required: [],
        },
    },
    {
        name: 'createMessagingTopic',
        description: 'Create a new topic subscription channel.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                topicId: { type: Type.STRING, description: 'Topic ID. Use "unique()" to auto-generate.' },
                name: { type: Type.STRING, description: 'Display name.' },
                subscribe: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Optional list of user IDs allowed to subscribe.' }
            },
            required: ['topicId', 'name'],
        },
    },
    {
        name: 'deleteMessagingTopic',
        description: 'Deregister or delete a messaging topic.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                topicId: { type: Type.STRING, description: 'Topic ID.' }
            },
            required: ['topicId'],
        },
    },
    {
        name: 'listMessagingSubscribers',
        description: 'List active subscribers inside a specific topic channel.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                topicId: { type: Type.STRING, description: 'Topic unique ID.' },
                limit: { type: Type.INTEGER, description: 'Optional. Max subscribers list limit.' }
            },
            required: ['topicId'],
        },
    },
    {
        name: 'createSubscriber',
        description: 'Subscribe a user target to a topic channel.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                topicId: { type: Type.STRING, description: 'Topic ID.' },
                subscriberId: { type: Type.STRING, description: 'Subscriber ID. Use "unique()".' },
                targetId: { type: Type.STRING, description: 'Target ID associated with the user.' }
            },
            required: ['topicId', 'subscriberId', 'targetId'],
        },
    },
    {
        name: 'deleteSubscriber',
        description: 'Remove a subscriber from a topic channel.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                topicId: { type: Type.STRING, description: 'Topic ID.' },
                subscriberId: { type: Type.STRING, description: 'Subscriber unique ID.' }
            },
            required: ['topicId', 'subscriberId'],
        },
    },
    {
        name: 'sendBroadcastMessage',
        description: 'Send or queue a multi-channel campaign message (Email, SMS, or Push Notification) to topics, users, or targets.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                channel: { type: Type.STRING, description: 'Communication channel: "email", "sms", or "push".' },
                messageId: { type: Type.STRING, description: 'Message ID. Use "unique()".' },
                subject: { type: Type.STRING, description: 'Required for "email". Subject line.' },
                content: { type: Type.STRING, description: 'Required for "email" and "sms". Content body.' },
                title: { type: Type.STRING, description: 'Required for "push". Push alert title.' },
                body: { type: Type.STRING, description: 'Required for "push". Push notification body text.' },
                topics: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Target broadcast topics list.' },
                users: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Target user IDs list.' },
                targets: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Target user device tokens or addresses list.' }
            },
            required: ['channel', 'messageId'],
        },
    },
];
