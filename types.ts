
import type { Models } from 'appwrite';
import type { FunctionCall, Part } from '@google/genai';

// A unique ID is added to each message to allow for updates (e.g., tool call status).
export type Message = UserMessage | ModelMessage | ActionMessage;

export interface UserMessage {
  id: string;
  role: 'user';
  content: string;
  files?: File[];
}

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web?: GroundingChunkWeb;
  // In the future, could also include 'maps' if that grounding is added.
}

export interface ModelMessage {
  id:string;
  role: 'model';
  content: string;
  groundingChunks?: GroundingChunk[];
}

export interface ActionMessage {
  id: string;
  role: 'action';
  toolCalls: FunctionCall[];
  toolResults?: Part[]; // The results from the tool calls
  isLoading: boolean; // To show a spinner while the tool is executing
}


export interface AppwriteProject {
  $id: string; // Document ID from Appwrite
  name: string;
  endpoint: string;
  projectId: string;
  apiKey: string;
}

export interface AIContext {
    project: AppwriteProject;
    database?: Database | null;
    collection?: Collection | null;
    bucket?: Bucket | null;
    fn?: AppwriteFunction | null;
}

export interface UserPrefs extends Models.Preferences {
  activeProjectId?: string | null;
  geminiApiKey?: string | null;
  geminiModel?: string | null;
  geminiThinking?: boolean | null;
  activeTools?: { [key: string]: boolean };
  sidebarWidth?: number | null;
}

// Custom types for Appwrite resources since they are not exported in some SDK versions.
// These are based on the expected REST API response shapes.

export interface Database {
    $id: string;
    name: string;
    $createdAt: string;
    $updatedAt: string;
    enabled: boolean;
}

export interface Collection {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    $permissions: string[];
    databaseId: string;
    name: string;
    enabled: boolean;
    documentSecurity: boolean;
    attributes: object[]; // In a real app, you might want to type this further
    indexes: object[]; // And this too
}

export interface Bucket {
    $id:string;
    $createdAt: string;
    $updatedAt: string;
    $permissions: string[];
    fileSecurity: boolean;
    name: string;
    enabled: boolean;
    maximumFileSize: number;
    allowedFileExtensions: string[];
    compression: string;
    encryption: boolean;
    antivirus: boolean;
}

export interface AppwriteFunction {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    $permissions: string[];
    name: string;
    enabled: boolean;
    runtime: string;
    deployment: string;
    vars: object[];
    events: string[];
    schedule: string;
    timeout: number;
    entrypoint: string;
    commands: string;
}

export interface BackupOptions {
    includeDatabases: boolean;
    includeDocuments: boolean;
    includeFunctions: boolean;
    includeFunctionCode: boolean;
    includeStorageMetadata: boolean;
    includeUsers: boolean;
    includeTeams: boolean;
}

export type StudioTab = 'overview' | 'database' | 'storage' | 'functions' | 'users' | 'teams' | 'migrations' | 'mcp' | 'backups';
