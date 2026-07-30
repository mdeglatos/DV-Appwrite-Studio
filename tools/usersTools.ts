import { getSdkUsers, ID, Query } from '../services/appwrite';
import type { AIContext } from '../types';
import { Type } from '@google/genai';
import type { NamedFunctionDeclaration } from '../types';

async function handleApiError(error: unknown) {
    console.error('Appwrite API error in user tool:', error);
    if (error instanceof Error) {
        return { error: `Appwrite API Error: ${error.message}` };
    }
    return { error: 'An unknown error occurred while communicating with the Appwrite API.' };
}

// User Functions
async function listUsers(context: AIContext, { limit = 100 }: { limit?: number }) {
    const finalLimit = Math.min(limit, 100);
    try {
        const users = getSdkUsers(context.project);
        return await users.list([Query.limit(finalLimit)]);
    } catch (error) {
        return handleApiError(error);
    }
}

async function createUser(context: AIContext, { userId, email, password, name }: { userId: string, email?: string, password?: string, name?: string }) {
    try {
        const users = getSdkUsers(context.project);
        const finalUserId = userId.toLowerCase() === 'unique()' ? ID.unique() : userId;
        return await users.create(finalUserId, email, undefined, password, name);
    } catch (error) {
        return handleApiError(error);
    }
}

async function getUser(context: AIContext, { userId }: { userId: string }) {
    try {
        const users = getSdkUsers(context.project);
        return await users.get(userId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function updateUserStatus(context: AIContext, { userId, status }: { userId: string, status: boolean }) {
     try {
        const users = getSdkUsers(context.project);
        return await users.updateStatus(userId, status);
    } catch (error) {
        return handleApiError(error);
    }
}

async function deleteUser(context: AIContext, { userId }: { userId: string }) {
    try {
        const users = getSdkUsers(context.project);
        await users.delete(userId);
        return { success: `Successfully deleted user ${userId}` };
    } catch (error) {
        return handleApiError(error);
    }
}


// Session Functions
async function listUserSessions(context: AIContext, { userId }: { userId: string }) {
    try {
        const users = getSdkUsers(context.project);
        return await users.listSessions(userId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function deleteUserSession(context: AIContext, { userId, sessionId }: { userId: string, sessionId: string }) {
    try {
        const users = getSdkUsers(context.project);
        await users.deleteSession(userId, sessionId);
        return { success: `Successfully deleted session ${sessionId} for user ${userId}` };
    } catch (error) {
        return handleApiError(error);
    }
}

export const usersFunctions = {
    listUsers,
    createUser,
    getUser,
    updateUserStatus,
    deleteUser,
    listUserSessions,
    deleteUserSession,
};

export const usersToolDefinitions: NamedFunctionDeclaration[] = [
    {
        name: 'listUsers',
        description: 'Get a list of all the project\'s users.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            limit: { type: Type.INTEGER, description: 'Optional. The maximum number of users to return. Default is 100. Maximum is 100.' },
          },
          required: [],
        },
    },
    {
        name: 'createUser',
        description: 'Create a new user.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            userId: { type: Type.STRING, description: 'User ID. Use "unique()" to create a unique ID.' },
            email: { type: Type.STRING, description: 'Optional. User email.' },
            password: { type: Type.STRING, description: 'Optional. User password.' },
            name: { type: Type.STRING, description: 'Optional. User name.' },
          },
          required: ['userId'],
        },
    },
    {
        name: 'getUser',
        description: 'Get a user by their unique ID.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            userId: { type: Type.STRING, description: 'User ID.' },
          },
          required: ['userId'],
        },
    },
    {
        name: 'updateUserStatus',
        description: 'Update a user\'s status (enabled/disabled).',
        parameters: {
          type: Type.OBJECT,
          properties: {
            userId: { type: Type.STRING, description: 'User ID.' },
            status: { type: Type.BOOLEAN, description: 'User status. True for active, false for blocked.' },
          },
          required: ['userId', 'status'],
        },
    },
    {
        name: 'deleteUser',
        description: 'Delete a user from the project.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            userId: { type: Type.STRING, description: 'User ID.' },
          },
          required: ['userId'],
        },
    },
    {
        name: 'listUserSessions',
        description: 'Get a list of all the user\'s sessions.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            userId: { type: Type.STRING, description: 'User ID.' },
          },
          required: ['userId'],
        },
    },
    {
        name: 'deleteUserSession',
        description: 'Delete a user\'s session by its unique ID.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            userId: { type: Type.STRING, description: 'User ID.' },
            sessionId: { type: Type.STRING, description: 'Session ID. Use "current" to delete the current session.' },
          },
          required: ['userId', 'sessionId'],
        },
    },
];
