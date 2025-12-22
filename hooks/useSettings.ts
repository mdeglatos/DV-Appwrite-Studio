
import { useState, useCallback } from 'react';
import type { Models } from 'appwrite';
import { updateUserPrefs } from '../services/authService';
import type { UserPrefs } from '../types';
import { toolDefinitionGroups } from '../tools';

// Get all possible tool names from the groups
const allIndividualToolNames = Object.values(toolDefinitionGroups).flat().map(tool => tool.name);
const allToolNames = ['search', ...allIndividualToolNames];

const GEMINI_MODELS = ['gemini-3-flash', 'gemini-3-pro'];
const DEFAULT_GEMINI_MODEL = 'gemini-3-flash';

export function useSettings(currentUser: Models.User<UserPrefs>, refreshUser: () => Promise<void>, logCallback: (log: string) => void) {
    const [activeTools, setActiveTools] = useState(() => {
        // Default state: all tools are enabled
        const defaultToolsState = allToolNames.reduce((acc, toolName) => {
            acc[toolName as keyof typeof acc] = true;
            return acc;
        }, {} as { [key: string]: boolean });

        // Merge with user's saved preferences
        const savedTools = currentUser.prefs.activeTools;
        if (savedTools && typeof savedTools === 'object') {
            return { ...defaultToolsState, ...savedTools };
        }
        
        return defaultToolsState;
    });

    const geminiApiKey = currentUser.prefs.geminiApiKey || null;
    const geminiModel = currentUser.prefs.geminiModel || DEFAULT_GEMINI_MODEL;
    const geminiThinkingEnabled = currentUser.prefs.geminiThinking ?? true;
    const sidebarWidth = currentUser.prefs.sidebarWidth || 320; // Default width 320px (w-80)

    const handleSaveGeminiSettings = useCallback(async (settings: { apiKey: string; model: string; thinkingEnabled: boolean; }) => {
        try {
            await updateUserPrefs({ 
                geminiApiKey: settings.apiKey.trim() || null, 
                geminiModel: settings.model,
                geminiThinking: settings.thinkingEnabled,
            });
            await refreshUser();
            logCallback('Gemini settings updated successfully.');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            logCallback(`ERROR saving Gemini settings: ${errorMessage}`);
            throw e;
        }
    }, [refreshUser, logCallback]);

    const handleToolsChange = useCallback(async (newTools: { [key: string]: boolean }) => {
        setActiveTools(newTools);
        try {
            await updateUserPrefs({ activeTools: newTools });
            logCallback('Agent tools selection saved.');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            logCallback(`ERROR saving tool preferences: ${errorMessage}`);
            throw e;
        }
    }, [logCallback]);

    const handleSidebarWidthChange = useCallback(async (newWidth: number) => {
        try {
            await updateUserPrefs({ sidebarWidth: newWidth });
            logCallback('Sidebar width saved.');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            logCallback(`ERROR saving sidebar width: ${errorMessage}`);
        }
    }, [logCallback]);

    return {
        activeTools,
        handleToolsChange,
        geminiApiKey,
        geminiModel,
        GEMINI_MODELS,
        geminiThinkingEnabled,
        handleSaveGeminiSettings,
        sidebarWidth,
        handleSidebarWidthChange,
    };
}