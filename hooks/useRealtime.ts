
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    realtimeManager,
    matchesEvent,
    extractDatabaseId,
    extractCollectionId,
    extractBucketId,
    type RealtimeEvent,
    type RealtimeCallback,
    type RealtimeConnectionStatus,
} from '../services/realtimeService';
import type { AppwriteProject } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UseRealtimeReturn {
    /** Current connection status */
    status: RealtimeConnectionStatus;
    /** Whether the connection is live */
    isConnected: boolean;
    /** Last received event (for debugging / display) */
    lastEvent: RealtimeEvent | null;
    /** Total events received in this session */
    eventCount: number;
    /** Register a listener for specific event patterns */
    useEventListener: (callback: RealtimeCallback) => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Manages the Realtime WebSocket connection lifecycle for the active project.
 * 
 * - Connects when a project is selected
 * - Disconnects when the project changes or component unmounts
 * - Exposes connection status and event subscription
 */
export function useRealtime(activeProject: AppwriteProject | null): UseRealtimeReturn {
    const [status, setStatus] = useState<RealtimeConnectionStatus>(realtimeManager.status);
    const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
    const [eventCount, setEventCount] = useState(0);
    const callbacksRef = useRef<Set<RealtimeCallback>>(new Set());

    // Connect/disconnect on project change
    useEffect(() => {
        if (!activeProject) {
            realtimeManager.disconnect();
            return;
        }

        realtimeManager.connect(activeProject);

        return () => {
            // Don't disconnect on every re-render — only when project actually changes
            // The connect() method handles deduplication internally
        };
    }, [activeProject?.endpoint, activeProject?.projectId]);

    // Disconnect on full unmount
    useEffect(() => {
        return () => {
            realtimeManager.disconnect();
        };
    }, []);

    // Track connection status
    useEffect(() => {
        const unsubscribe = realtimeManager.onStatusChange(setStatus);
        return unsubscribe;
    }, []);

    // Subscribe to all events and distribute to registered callbacks
    useEffect(() => {
        const unsubscribe = realtimeManager.subscribe((event: RealtimeEvent) => {
            setLastEvent(event);
            setEventCount(prev => prev + 1);

            // Distribute to all registered listeners
            callbacksRef.current.forEach(cb => {
                try {
                    cb(event);
                } catch (err) {
                    console.error('[useRealtime] Listener error:', err);
                }
            });
        });

        return unsubscribe;
    }, []);

    /**
     * Register an event listener. Should be called within a useEffect in the consuming component.
     * The callback is stored by reference — use useCallback for stability.
     */
    const useEventListener = useCallback((callback: RealtimeCallback) => {
        callbacksRef.current.add(callback);
        return () => {
            callbacksRef.current.delete(callback);
        };
    }, []);

    return {
        status,
        isConnected: status === 'connected',
        lastEvent,
        eventCount,
        useEventListener,
    };
}

// ============================================================================
// Smart Polling Hook
// ============================================================================

/**
 * A hook that calls a refresh function on an interval,
 * but only when the browser tab is visible.
 * 
 * This is the universal fallback for when Realtime events
 * don't reach us (permission restrictions, disconnections, etc.).
 */
export function useSmartPolling(
    refreshFn: (() => void) | null,
    intervalMs: number,
    enabled: boolean = true
): void {
    const refreshRef = useRef(refreshFn);
    refreshRef.current = refreshFn;

    useEffect(() => {
        if (!enabled || !refreshRef.current || intervalMs <= 0) return;

        const tick = () => {
            if (document.visibilityState === 'visible' && refreshRef.current) {
                refreshRef.current();
            }
        };

        const timer = setInterval(tick, intervalMs);
        return () => clearInterval(timer);
    }, [intervalMs, enabled]);
}

// Re-export utilities for convenience
export {
    matchesEvent,
    extractDatabaseId,
    extractCollectionId,
    extractBucketId,
    type RealtimeEvent,
    type RealtimeCallback,
    type RealtimeConnectionStatus,
};
