import type { FunctionDeclaration } from '@google/genai';
import { databaseFunctions, databaseToolDefinitions } from './databaseTools';
import { storageFunctions, storageToolDefinitions } from './storageTools';
import { functionsFunctions, functionsToolDefinitions } from './functionsTools';
import { usersFunctions, usersToolDefinitions } from './usersTools';
import { teamsFunctions, teamsToolDefinitions } from './teamsTools';
import { sitesFunctions, sitesToolDefinitions } from './sitesTools';
import { projectAdminFunctions, projectAdminToolDefinitions } from './projectAdminTools';
import { messagingFunctions, messagingToolDefinitions } from './messagingTools';
import { healthFunctions, healthToolDefinitions } from './healthTools';
import { webhookFunctions, webhookToolDefinitions } from './webhookTools';

// Combine all tool functions into a single object.
export const availableTools = {
  ...databaseFunctions,
  ...storageFunctions,
  ...functionsFunctions,
  ...usersFunctions,
  ...teamsFunctions,
  ...sitesFunctions,
  ...projectAdminFunctions,
  ...messagingFunctions,
  ...healthFunctions,
  ...webhookFunctions,
};

// Group tool definitions by category for dynamic loading.
export const toolDefinitionGroups: { [key: string]: FunctionDeclaration[] } = {
  database: databaseToolDefinitions,
  storage: storageToolDefinitions,
  functions: functionsToolDefinitions,
  users: usersToolDefinitions,
  teams: teamsToolDefinitions,
  sites: sitesToolDefinitions,
  projectAdmin: projectAdminToolDefinitions,
  messaging: messagingToolDefinitions,
  health: healthToolDefinitions,
  webhook: webhookToolDefinitions,
};