import React from 'react';

/**
 * The app shell's connection/project status banner.
 *
 * Rendered once in `AgentApp`, above the view branch, so a failed project load
 * or a "Connection Failed / likely CORS" context error is visible in **both**
 * the Agent and the Studio views. It used to be inlined in `MainContent`, which
 * only the Agent view renders.
 *
 * Distinct from `components/studio/ui/ListState.tsx` by scope: `ListState` is a
 * *list's* substitute content, this is the *project connection*'s status.
 */
interface ErrorBannerProps {
    message: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message }) => (
    <div className="mx-auto w-full max-w-2xl mt-4 animate-fade-in">
        <div className="bg-red-950/40 border border-red-500/30 text-red-200 p-4 rounded-2xl backdrop-blur-md flex items-start gap-4 shadow-lg shadow-red-900/10">
            <span className="text-2xl">⚠️</span>
            <div>
                <p className="font-semibold text-red-400">Error</p>
                <p className="text-sm opacity-90 leading-relaxed">{message}</p>
            </div>
        </div>
    </div>
);
