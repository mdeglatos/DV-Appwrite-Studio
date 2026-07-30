
import { useState, useEffect, useRef } from 'react';
import type { Chat } from '@google/genai';
import { createChatSession, runAI } from '../services/geminiService';
import type { Message, AIContext, AppwriteProject, Database, Collection, Bucket, AppwriteFunction, UserMessage, ModelMessage } from '../types';

interface UseChatSessionProps {
    activeProject: AppwriteProject | null;
    selectedDatabase: Database | null;
    selectedCollection: Collection | null;
    selectedBucket: Bucket | null;
    selectedFunction: AppwriteFunction | null;
    activeTools: { [key: string]: boolean };
    geminiModel: string;
    geminiThinkingEnabled: boolean;
    geminiApiKey: string | null;
    logCallback: (log: string) => void;
    onCodeGenerated?: (files: { name: string; content: string }[]) => void;
}

export function useChatSession({
    activeProject,
    selectedDatabase,
    selectedCollection,
    selectedBucket,
    selectedFunction,
    activeTools,
    geminiModel,
    geminiThinkingEnabled,
    geminiApiKey,
    logCallback,
    onCodeGenerated,
}: UseChatSessionProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [chat, setChat] = useState<Chat | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const prevContextForReset = useRef({ projectId: activeProject?.$id });

    useEffect(() => {
        const didProjectChange = prevContextForReset.current.projectId !== activeProject?.$id;
        const isHardReset = didProjectChange;

        const initializeSession = async () => {
            if (!activeProject) {
                setChat(null);
                if (isHardReset) setMessages([]);
                return;
            }

            const context: AIContext = {
                project: activeProject, database: selectedDatabase, collection: selectedCollection,
                bucket: selectedBucket, fn: selectedFunction,
            };
            
            // `Chat#history` is private; `getHistory()` is the public accessor for the same
            // comprehensive history (it returns a structured clone of it).
            let initialHistory = isHardReset ? undefined : chat?.getHistory();
            if (isHardReset) setMessages([]);

            const contextDescription = [
                context.database ? `DB: ${context.database.name}` : '',
                context.collection ? `Collection: ${context.collection.name}` : '',
                context.bucket ? `Bucket: ${context.bucket.name}` : '',
                context.fn ? `Function: ${context.fn.name}` : '',
            ].filter(Boolean).join(', ');

            logCallback(`Project context updated. ${contextDescription || 'No specific context.'} Initializing Smart Mode session...`);
            
            try {
                const newChat = createChatSession(activeTools, geminiModel, context, geminiThinkingEnabled, geminiApiKey, initialHistory);
                setChat(newChat);
                if(!isHardReset) setError(null); // Don't clear error if it's just a soft reset
                logCallback('AI session ready.');
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
                setError(errorMessage);
                logCallback(`ERROR: ${errorMessage}`);
                setChat(null);
            }
        };

        initializeSession();
        prevContextForReset.current = { projectId: activeProject?.$id };
    }, [activeProject, activeTools, geminiApiKey, geminiModel, geminiThinkingEnabled, selectedDatabase, selectedCollection, selectedBucket, selectedFunction, logCallback]);


    const handleSendMessage = async (input: string) => {
        if ((!input.trim() && selectedFiles.length === 0) || isLoading || !activeProject || !chat) return;
        
        const userMessage: UserMessage = { 
            id: crypto.randomUUID(), role: 'user', content: input, files: selectedFiles,
        };
        
        logCallback(`\n--- USER: ${input.trim()} ${selectedFiles.length > 0 ? `(with files: ${selectedFiles.map(f => f.name).join(', ')})` : ''} ---\n`);
        setMessages(prev => [...prev, userMessage]);
        setSelectedFiles([]);
        setIsLoading(true);
        setError(null);

        const updateChatCallback = (message: Message) => {
            setMessages(prev => {
                const existingIndex = prev.findIndex(m => m.id === message.id);
                if (existingIndex > -1) {
                    const newMessages = [...prev];
                    newMessages[existingIndex] = message;
                    return newMessages;
                }
                return [...prev, message];
            });
        };

        try {
            const context: AIContext = {
                project: activeProject, database: selectedDatabase, collection: selectedCollection,
                bucket: selectedBucket, fn: selectedFunction,
            };
            // activeTools passed here acts as a strict filter for execution
            await runAI(chat, input, context, activeTools, logCallback, updateChatCallback, userMessage.files, onCodeGenerated);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            logCallback(`ERROR: ${errorMessage}`);
            const errorMsg: ModelMessage = { id: crypto.randomUUID(), role: 'model', content: `Error: ${errorMessage}` };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearChat = () => {
        setMessages([]);
        logCallback('Chat history cleared by user.');
        // The main useEffect will trigger a session reset, but let's be explicit
        if (activeProject) {
            try {
                const context: AIContext = { project: activeProject, database: selectedDatabase, collection: selectedCollection, bucket: selectedBucket, fn: selectedFunction };
                const newChat = createChatSession(activeTools, geminiModel, context, geminiThinkingEnabled, geminiApiKey);
                setChat(newChat);
                logCallback('AI session has been reset.');
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
                setError(`Failed to reset AI session: ${errorMessage}`);
                logCallback(`ERROR resetting AI session: ${errorMessage}`);
                setChat(null);
            }
        }
    };

    const handleFileSelect = (files: File[] | null) => {
        if (!files || files.length === 0) {
            setSelectedFiles([]);
            return;
        }
        if (files.length > 5) {
            setError("You can select a maximum of 5 files at a time.");
            return;
        }
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                setError(`File "${file.name}" is too large. Max size is 10MB.`);
                return;
            }
        }
        setError(null);
        setSelectedFiles(Array.from(files));
    };

    return {
        messages,
        setMessages,
        isLoading,
        error,
        setError,
        selectedFiles,
        handleSendMessage,
        handleClearChat,
        handleFileSelect
    };
}
