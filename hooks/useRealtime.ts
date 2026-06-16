
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

    // Connect/disconnect on project change AND tab visibility change
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                if (activeProject) {
                    console.log('[useRealtime] Tab visible, reconnecting Realtime...');
                    realtimeManager.connect(activeProject);
                }
            } else {
                console.log('[useRealtime] Tab hidden, disconnecting Realtime...');
                realtimeManager.disconnect();
            }
        };

        if (activeProject && document.visibilityState === 'visible') {
            realtimeManager.connect(activeProject);
        } else {
            realtimeManager.disconnect();
        }

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            realtimeManager.disconnect();
        };
    }, [activeProject?.endpoint, activeProject?.projectId]);

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
        if (!enabled || intervalMs <= 0) return;

        let timer: ReturnType<typeof setInterval> | null = null;

        const startTimer = () => {
            if (timer) clearInterval(timer);
            timer = setInterval(() => {
                if (refreshRef.current) {
                    refreshRef.current();
                }
            }, intervalMs);
        };

        const stopTimer = () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                if (refreshRef.current) {
                    refreshRef.current();
                }
                startTimer();
            } else {
                stopTimer();
            }
        };

        // Start timer initially if visible
        if (document.visibilityState === 'visible') {
            startTimer();
        }

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            stopTimer();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
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
