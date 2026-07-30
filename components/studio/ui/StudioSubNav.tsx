import React from 'react';
import type { StudioTab } from '../../../types';
import { type StudioGroup, SECTION_LABELS, isCollapsed } from '../../../services/studioNav';
import { STUDIO_SECTION_UI } from '../navigation';

interface StudioSubNavProps {
    group: StudioGroup;
    activeSection: StudioTab;
    onSectionChange: (section: StudioTab) => void;
}

/**
 * Renders the active group's sections. A collapsed group (one section) has
 * nothing to choose between, so it renders nothing at all.
 */
export const StudioSubNav: React.FC<StudioSubNavProps> = ({ group, activeSection, onSectionChange }) => {
    if (isCollapsed(group)) return null;

    return (
        <div className="flex justify-center w-full px-4">
            <nav
                aria-label={`${group.label} sections`}
                className="flex gap-1 bg-gray-900/40 rounded-xl p-1 border border-gray-800/50 overflow-x-auto max-w-full custom-scrollbar"
            >
                {group.sections.map(section => (
                    <button
                        key={section}
                        onClick={() => onSectionChange(section)}
                        aria-current={activeSection === section ? 'page' : undefined}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                            activeSection === section
                                ? 'bg-gray-800 text-cyan-400 border border-white/5 shadow-inner'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }`}
                    >
                        {STUDIO_SECTION_UI[section].icon}
                        <span>{SECTION_LABELS[section]}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
};
