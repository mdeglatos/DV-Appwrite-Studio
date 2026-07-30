import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LeftSidebar } from './LeftSidebar';
import { ToastProvider } from '../hooks/useToast';
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

/** The sidebar reads the app-wide toast owner, so it always renders inside one. */
function renderSidebar(props: Partial<React.ComponentProps<typeof LeftSidebar>> = {}) {
    return render(
        <ToastProvider>
            <LeftSidebar {...baseProps} {...props} />
        </ToastProvider>
    );
}

describe('Deep Thinking toggle', () => {
    it('is reachable on the default gemini-3-flash model', () => {
        renderSidebar({ geminiModel: 'gemini-3-flash' });
        expect(screen.getByText('Deep Thinking')).toBeInTheDocument();
    });

    it('is hidden on a pro model', () => {
        renderSidebar({ geminiModel: 'gemini-3-pro' });
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

describe('saving the AI settings', () => {
    /** Opens the collapsed AI-settings section and dirties the form. */
    function openAndDirtyGeminiForm(container: HTMLElement) {
        fireEvent.click(screen.getByText('Configuration'));
        const apiKeyInput = container.querySelector('#gemini-api-key-input') as HTMLInputElement;
        expect(apiKeyInput).not.toBeNull();
        fireEvent.change(apiKeyInput, { target: { value: 'new-key' } });
        return apiKeyInput.closest('form') as HTMLFormElement;
    }

    it('shows the reason when the save fails, instead of rejecting into nothing', async () => {
        const onSaveGeminiSettings = vi.fn(() => Promise.reject(new Error('prefs quota exceeded')));
        const { container } = renderSidebar({ onSaveGeminiSettings });

        const form = openAndDirtyGeminiForm(container);
        await act(async () => { fireEvent.submit(form); });

        expect(onSaveGeminiSettings).toHaveBeenCalledTimes(1);
        expect(await screen.findByText(/prefs quota exceeded/)).toBeInTheDocument();
    });

    it('reports nothing when the save succeeds', async () => {
        const onSaveGeminiSettings = vi.fn(() => Promise.resolve());
        const { container } = renderSidebar({ onSaveGeminiSettings });

        const form = openAndDirtyGeminiForm(container);
        await act(async () => { fireEvent.submit(form); });

        expect(onSaveGeminiSettings).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(/Could not save AI settings/)).not.toBeInTheDocument();
    });
});

describe('Studio navigation tree', () => {
    it('lists all 14 sections under their group headings', () => {
        const { container } = renderSidebar({ viewMode: 'studio' });

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
