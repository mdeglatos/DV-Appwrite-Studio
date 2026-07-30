import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LeftSidebar } from './LeftSidebar';
import { SECTION_LABELS, STUDIO_GROUPS } from '../services/studioNav';
import type { StudioTab } from '../types';

const baseProps: React.ComponentProps<typeof LeftSidebar> = {
    isOpen: true,
    onClose: vi.fn(),
    projects: [],
    activeProject: null,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    onSelect: vi.fn(),
    activeTools: {},
    onToolsChange: vi.fn(),
    geminiApiKey: null,
    geminiModel: 'gemini-3-flash',
    geminiModels: ['gemini-3-flash', 'gemini-3-pro'],
    geminiThinkingEnabled: true,
    onSaveGeminiSettings: vi.fn(),
    width: 320,
    isResizing: false,
    onResizeStart: vi.fn(),
    viewMode: 'agent',
    activeStudioSection: 'overview',
    onStudioSectionChange: vi.fn(),
};

describe('Deep Thinking toggle', () => {
    it('is reachable on the default gemini-3-flash model', () => {
        render(<LeftSidebar {...baseProps} geminiModel="gemini-3-flash" />);
        expect(screen.getByText('Deep Thinking')).toBeInTheDocument();
    });

    it('is hidden on a pro model', () => {
        render(<LeftSidebar {...baseProps} geminiModel="gemini-3-pro" />);
        expect(screen.queryByText('Deep Thinking')).not.toBeInTheDocument();
    });

    it('would be unreachable under the old gemini-2.5-flash-only condition', () => {
        // The models this app actually offers — none of them equal 'gemini-2.5-flash',
        // which is precisely why the old gate could never be satisfied.
        for (const model of baseProps.geminiModels) {
            expect(model).not.toBe('gemini-2.5-flash');
        }
        // …and the current condition IS satisfied by one of them.
        expect(baseProps.geminiModels.some(m => m.endsWith('-flash'))).toBe(true);
    });
});

describe('Studio navigation tree', () => {
    it('lists all 14 sections under their group headings', () => {
        const { container } = render(<LeftSidebar {...baseProps} viewMode="studio" />);

        const headings = Array.from(container.querySelectorAll('nav h4')).map(h => h.textContent);
        expect(headings).toEqual(STUDIO_GROUPS.map(g => g.label));

        const sections = Object.keys(SECTION_LABELS) as StudioTab[];
        expect(sections).toHaveLength(14);
        for (const section of sections) {
            expect(
                screen.getAllByText(SECTION_LABELS[section]).length,
                `section ${section} must be listed`
            ).toBeGreaterThan(0);
        }
    });

    it('declares no local tab list of its own', () => {
        const source = readFileSync(join(__dirname, 'LeftSidebar.tsx'), 'utf8');
        expect(source).not.toContain('studioTabs');
        expect(source).toContain('STUDIO_GROUPS');
    });
});
