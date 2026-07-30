import React from 'react';
import { ExternalLinkIcon } from '../../Icons';

interface TabShellProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    /** External Appwrite Console deep link — renders the "Open in Console" action when present. */
    consoleHref?: string;
    /** Extra actions rendered to the left of the Console link. */
    actions?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * The single owner of the Studio page frame: title, subtitle, console link and
 * action slot, followed by the panel's own content.
 *
 * It deliberately declares **no** width, centring or scroll classes —
 * `components/Studio.tsx` owns the `max-w-6xl mx-auto` container and the
 * scrolling region, and no tab may re-declare them.
 */
export const TabShell: React.FC<TabShellProps> = ({ title, subtitle, icon, consoleHref, actions, children }) => (
    <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4">
            <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                    {icon}
                    {title}
                </h1>
                {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {actions}
                {consoleHref && (
                    <a
                        href={consoleHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900/60 hover:bg-gray-800 border border-white/5 rounded-xl text-xs font-bold text-gray-300 transition-all shadow-inner whitespace-nowrap"
                    >
                        <ExternalLinkIcon size={14} /> Open in Console
                    </a>
                )}
            </div>
        </div>

        {children}
    </div>
);
