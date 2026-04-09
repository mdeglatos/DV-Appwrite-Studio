
import { Client } from 'appwrite';
import { normalizeEndpoint } from './appwrite';
import type { AppwriteProject } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface RealtimeEvent {
    /** Full event strings, e.g. ['databases.main.collections.users.documents.abc.create'] */
    events: string[];
    /** Channel strings, e.g. ['databases.main.collections.users.documents'] */
    channels: string[];
    /** The resource payload (document, file, bucket, etc.) */
    payload: Record<string, any>;
    /** Timestamp when the event was received */
    timestamp: number;
}

export type RealtimeCallback = (event: RealtimeEvent) => void;

export type RealtimeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ============================================================================
// Realtime Manager
// ============================================================================

/**
 * Manages a single Realtime WebSocket connection to a user's managed Appwrite project.
 * 
 * Uses the `appwrite` client SDK (not node-appwrite) because Realtime is client-only.
 * Connects without a session — will only receive events for resources with open
 * read permissions (role:any). This is supplemented by polling elsewhere.
 */
class RealtimeManager {
    private client: Client | null = null;
    private unsubscribeFn: (() => void) | null = null;
    private callbacks: Set<RealtimeCallback> = new Set();
    private currentProjectKey: string | null = null;
    private _status: RealtimeConnectionStatus = 'disconnected';
    private statusListeners: Set<(status: RealtimeConnectionStatus) => void> = new Set();
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts = 0;
    private static readonly MAX_RECONNECT_ATTEMPTS = 5;
    private static readonly RECONNECT_BASE_DELAY_MS = 2000;

    get status(): RealtimeConnectionStatus {
        return this._status;
    }

    private setStatus(status: RealtimeConnectionStatus): void {
        if (this._status === status) return;
        this._status = status;
        this.statusListeners.forEach(listener => listener(status));
    }

    /**
     * Subscribe to connection status changes.
     * Returns an unsubscribe function.
     */
    onStatusChange(listener: (status: RealtimeConnectionStatus) => void): () => void {
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    }

    /**
     * Connect to a managed Appwrite project's Realtime service.
     * Automatically disconnects from any previous project.
     * 
     * Subscribes to broad channels so we receive events for:
     * - All database document changes
     * - All storage file changes
     */
    connect(project: AppwriteProject): void {
        const projectKey = `${project.endpoint}::${project.projectId}`;

        // Already connected to this exact project
        if (projectKey === this.currentProjectKey && this._status === 'connected') {
            return;
        }

        // Disconnect from previous project
        this.disconnect();

        this.currentProjectKey = projectKey;
        this.setStatus('connecting');
        this.reconnectAttempts = 0;

        try {
            const endpoint = normalizeEndpoint(project.endpoint);
            this.client = new Client()
                .setEndpoint(endpoint)
                .setProject(project.projectId.trim());

            this.setupSubscription();
        } catch (error) {
            console.error('[Realtime] Failed to create client:', error);
            this.setStatus('error');
        }
    }

    /**
     * Set up the WebSocket subscription to broad channels.
     */
    private setupSubscription(): void {
        if (!this.client) return;

        try {
            // Subscribe to all databases and all buckets at the project level.
            // These broad channel strings will catch creates, updates, and deletes
            // for documents and files across the entire project.
            const unsubscribe = this.client.subscribe(
                [
                    'databases',    // All database/collection/document events
                    'buckets',      // All bucket/file events
                ],
                (response: any) => {
                    // Successfully receiving events means we're connected
                    if (this._status === 'connecting') {
                        this.setStatus('connected');
                        this.reconnectAttempts = 0;
                    }

                    const event: RealtimeEvent = {
                        events: response.events || [],
                        channels: response.channels || [],
                        payload: response.payload || {},
                        timestamp: Date.now(),
                    };

                    this.callbacks.forEach(cb => {
                        try {
                            cb(event);
                        } catch (err) {
                            console.error('[Realtime] Callback error:', err);
                        }
                    });
                }
            );

            this.unsubscribeFn = unsubscribe;

            // The Appwrite client SDK establishes the WebSocket on subscribe.
            // If no error was thrown, we can optimistically set connected.
            // If the WebSocket fails later, the SDK will call the error handler internally,
            // but we won't get a direct notification. The polling fallback covers this.
            setTimeout(() => {
                if (this._status === 'connecting') {
                    this.setStatus('connected');
                }
            }, 3000);
        } catch (error) {
            console.error('[Realtime] Subscription failed:', error);
            this.setStatus('error');
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule a reconnection attempt with exponential backoff.
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= RealtimeManager.MAX_RECONNECT_ATTEMPTS) {
            console.warn('[Realtime] Max reconnect attempts reached. Falling back to polling only.');
            this.setStatus('error');
            return;
        }

        const delay = RealtimeManager.RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;

        this.reconnectTimer = setTimeout(() => {
            if (this.client && this.currentProjectKey) {
                console.log(`[Realtime] Reconnect attempt ${this.reconnectAttempts}...`);
                this.setupSubscription();
            }
        }, delay);
    }

    /**
     * Disconnect from the current project's Realtime service.
     */
    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.unsubscribeFn) {
            try {
                this.unsubscribeFn();
            } catch (error) {
                // Ignore errors during cleanup
            }
            this.unsubscribeFn = null;
        }

        this.client = null;
        this.currentProjectKey = null;
        this.reconnectAttempts = 0;
        this.setStatus('disconnected');
    }

    /**
     * Register a callback that fires on every Realtime event.
     * Returns an unsubscribe function.
     */
    subscribe(callback: RealtimeCallback): () => void {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    /**
     * Check if the manager is currently connected.
     */
    get isConnected(): boolean {
        return this._status === 'connected';
    }
}

// Singleton instance — one WebSocket connection at a time
export const realtimeManager = new RealtimeManager();

// ============================================================================
// Event Matching Utilities
// ============================================================================

/**
 * Check if a realtime event matches a given pattern.
 * Patterns use Appwrite event string format with wildcards.
 * 
 * Examples:
 *   matchesEvent(event, 'databases') → any database event
 *   matchesEvent(event, 'databases.mydb.collections') → any collection event in 'mydb'
 *   matchesEvent(event, 'databases.mydb.collections.users.documents') → document events in 'users' collection
 *   matchesEvent(event, 'buckets.images.files') → file events in 'images' bucket
 */
export function matchesEvent(event: RealtimeEvent, pattern: string): boolean {
    return event.events.some(e => e.includes(pattern)) ||
           event.channels.some(c => c.includes(pattern));
}

/**
 * Check if the event is a create, update, or delete operation.
 */
export function getEventAction(event: RealtimeEvent): 'create' | 'update' | 'delete' | null {
    for (const e of event.events) {
        if (e.endsWith('.create')) return 'create';
        if (e.endsWith('.update')) return 'update';
        if (e.endsWith('.delete')) return 'delete';
    }
    return null;
}

/**
 * Extract a database ID from an event, if present.
 */
export function extractDatabaseId(event: RealtimeEvent): string | null {
    for (const e of event.events) {
        const match = e.match(/databases\.([^.]+)/);
        if (match) return match[1];
    }
    return null;
}

/**
 * Extract a collection ID from an event, if present.
 */
export function extractCollectionId(event: RealtimeEvent): string | null {
    for (const e of event.events) {
        const match = e.match(/collections\.([^.]+)/);
        if (match) return match[1];
    }
    return null;
}

/**
 * Extract a bucket ID from an event, if present.
 */
export function extractBucketId(event: RealtimeEvent): string | null {
    for (const e of event.events) {
        const match = e.match(/buckets\.([^.]+)/);
        if (match) return match[1];
    }
    return null;
}
