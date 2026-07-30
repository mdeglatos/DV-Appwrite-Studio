import { getSdkTeams, ID, Query } from '../services/appwrite';
import type { AIContext } from '../types';
import { Type } from '@google/genai';
import type { NamedFunctionDeclaration } from '../types';

async function handleApiError(error: unknown) {
    console.error('Appwrite API error in team tool:', error);
    if (error instanceof Error) {
        return { error: `Appwrite API Error: ${error.message}` };
    }
    return { error: 'An unknown error occurred while communicating with the Appwrite API.' };
}

// Team Functions
async function listTeams(context: AIContext, { limit = 100 }: { limit?: number }) {
    const finalLimit = Math.min(limit, 100);
    try {
        const teams = getSdkTeams(context.project);
        return await teams.list([Query.limit(finalLimit)]);
    } catch (error) {
        return handleApiError(error);
    }
}

async function createTeam(context: AIContext, { teamId, name, roles }: { teamId: string, name: string, roles?: string[] }) {
    try {
        const teams = getSdkTeams(context.project);
        const finalTeamId = teamId.toLowerCase() === 'unique()' ? ID.unique() : teamId;
        return await teams.create(finalTeamId, name, roles);
    } catch (error) {
        return handleApiError(error);
    }
}

async function getTeam(context: AIContext, { teamId }: { teamId: string }) {
    try {
        const teams = getSdkTeams(context.project);
        return await teams.get(teamId);
    } catch (error) {
        return handleApiError(error);
    }
}

async function updateTeamName(context: AIContext, { teamId, name }: { teamId: string, name: string }) {
    try {
        const teams = getSdkTeams(context.project);
        return await teams.updateName(teamId, name);
    } catch (error) {
        return handleApiError(error);
    }
}

async function deleteTeam(context: AIContext, { teamId }: { teamId: string }) {
    try {
        const teams = getSdkTeams(context.project);
        await teams.delete(teamId);
        return { success: `Successfully deleted team ${teamId}` };
    } catch (error) {
        return handleApiError(error);
    }
}

// Membership Functions
async function listTeamMemberships(context: AIContext, { teamId, limit = 100 }: { teamId: string, limit?: number }) {
    const finalLimit = Math.min(limit, 100);
    try {
        const teams = getSdkTeams(context.project);
        return await teams.listMemberships(teamId, [Query.limit(finalLimit)]);
    } catch (error) {
        return handleApiError(error);
    }
}

async function createTeamMembership(context: AIContext, { teamId, email, roles, url, name }: { teamId: string, email: string, roles: string[], url: string, name?: string }) {
    try {
        const teams = getSdkTeams(context.project);
        // Fix: Reorder arguments to match SDK signature, which expects roles before email for an invitation.
        return await teams.createMembership(teamId, roles, url, email, name);
    } catch (error) {
        return handleApiError(error);
    }
}

async function deleteTeamMembership(context: AIContext, { teamId, membershipId }: { teamId: string, membershipId: string }) {
    try {
        const teams = getSdkTeams(context.project);
        await teams.deleteMembership(teamId, membershipId);
        return { success: `Successfully deleted membership ${membershipId} from team ${teamId}` };
    } catch (error) {
        return handleApiError(error);
    }
}

export const teamsFunctions = {
    listTeams,
    createTeam,
    getTeam,
    updateTeamName,
    deleteTeam,
    listTeamMemberships,
    createTeamMembership,
    deleteTeamMembership,
};

export const teamsToolDefinitions: NamedFunctionDeclaration[] = [
    {
        name: 'listTeams',
        description: 'Get a list of all the project\'s teams.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            limit: { type: Type.INTEGER, description: 'Optional. The maximum number of teams to return. Default is 100. Maximum is 100.' },
          },
          required: [],
        },
    },
    {
        name: 'createTeam',
        description: 'Create a new team.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            teamId: { type: Type.STRING, description: 'Team ID. Use "unique()" to create a unique ID.' },
            name: { type: Type.STRING, description: 'Team name.' },
            roles: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Optional. Array of roles for new members. A role can be any string.' },
          },
          required: ['teamId', 'name'],
        },
    },
    {
        name: 'getTeam',
        description: 'Get a team by its unique ID.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            teamId: { type: Type.STRING, description: 'Team ID.' },
          },
          required: ['teamId'],
        },
    },
    {
        name: 'updateTeamName',
        description: 'Update a team\'s name.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            teamId: { type: Type.STRING, description: 'Team ID.' },
            name: { type: Type.STRING, description: 'New team name.' },
          },
          required: ['teamId', 'name'],
        },
    },
    {
        name: 'deleteTeam',
        description: 'Delete a team from the project.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            teamId: { type: Type.STRING, description: 'Team ID.' },
          },
          required: ['teamId'],
        },
    },
    {
        name: 'listTeamMemberships',
        description: 'Get a list of all the team\'s members.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            teamId: { type: Type.STRING, description: 'Team ID.' },
            limit: { type: Type.INTEGER, description: 'Optional. The maximum number of memberships to return. Default is 100. Maximum is 100.' },
          },
          required: ['teamId'],
        },
    },
    {
        name: 'createTeamMembership',
        description: 'Invite a new member to join a team. An email with a link to join the team will be sent to the new member. If the member doesn\'t exist in the project, they will be automatically created.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            teamId: { type: Type.STRING, description: 'Team ID.' },
            email: { type: Type.STRING, description: 'Email of the new member.' },
            roles: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Array of roles for the new member.' },
            url: { type: Type.STRING, description: 'URL to redirect the user back to after they accept the invitation. This should be a page in your app.' },
            name: { type: Type.STRING, description: 'Optional. Name of the new member. Only used if the user doesn\'t exist in the project yet.' },
          },
          required: ['teamId', 'email', 'roles', 'url'],
        },
    },
    {
        name: 'deleteTeamMembership',
        description: 'Delete a team membership. This removes a user from a team.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            teamId: { type: Type.STRING, description: 'Team ID.' },
            membershipId: { type: Type.STRING, description: 'Membership ID.' },
          },
          required: ['teamId', 'membershipId'],
        },
    },
];
