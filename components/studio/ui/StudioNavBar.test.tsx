import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { StudioNavBar } from './StudioNavBar';
import { StudioSubNav } from './StudioSubNav';
import { STUDIO_GROUPS, SECTION_LABELS, groupOf } from '../../../services/studioNav';

const PRIMARY_LABELS = ['Overview', 'Data', 'Compute', 'Auth', 'Integrations', 'Operations'];

function renderNavBar(overrides: Partial<React.ComponentProps<typeof StudioNavBar>> = {}) {
    const onGroupChange = vi.fn();
    const onRefresh = vi.fn();
    const view = render(
        <StudioNavBar
            activeGroup="data"
            onGroupChange={onGroupChange}
            onRefresh={onRefresh}
            isLoading={false}
            {...overrides}
        />
    );
    return { view, onGroupChange, onRefresh };
}

describe('StudioNavBar', () => {
    it('renders the six primary group chips with their registry labels', () => {
        renderNavBar();
        for (const label of PRIMARY_LABELS) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
    });

    it('renders exactly one chip per group plus the Sync action', () => {
        const { view } = renderNavBar();
        const buttons = view.container.querySelectorAll('button');
        expect(buttons).toHaveLength(STUDIO_GROUPS.length + 1);
    });

    it('renders the Settings gear last, icon-only', () => {
        const { view } = renderNavBar();
        const buttons = Array.from(view.container.querySelectorAll('button'));
        const settings = view.container.querySelector('button[aria-label="Settings"]');
        expect(settings).toBeInTheDocument();
        expect(settings?.textContent).toBe('');
        // Last group chip before the Sync button
        expect(buttons.indexOf(settings as HTMLButtonElement)).toBe(buttons.length - 2);
    });

    it('marks the active group', () => {
        renderNavBar({ activeGroup: 'operations' });
        expect(screen.getByText('Operations').closest('button')).toHaveAttribute('aria-current', 'page');
        expect(screen.getByText('Data').closest('button')).not.toHaveAttribute('aria-current');
    });

    it('calls onGroupChange with the clicked group id', () => {
        const { onGroupChange } = renderNavBar();
        fireEvent.click(screen.getByText('Compute'));
        expect(onGroupChange).toHaveBeenCalledWith('compute');

        fireEvent.click(screen.getByLabelText('Settings'));
        expect(onGroupChange).toHaveBeenCalledWith('settings');
    });

    it('calls onRefresh from the Sync button and disables it while loading', () => {
        const { onRefresh, view } = renderNavBar();
        fireEvent.click(screen.getByText('Sync'));
        expect(onRefresh).toHaveBeenCalled();
        view.unmount();

        renderNavBar({ isLoading: true });
        expect(screen.getByText('Sync').closest('button')).toBeDisabled();
    });
});

describe('StudioSubNav', () => {
    it('renders one button per section of an expanded group', () => {
        const dataGroup = groupOf('database');
        const { container } = render(
            <StudioSubNav group={dataGroup} activeSection="database" onSectionChange={vi.fn()} />
        );
        const nav = within(container.querySelector('nav')!);
        expect(container.querySelectorAll('button')).toHaveLength(3);
        expect(nav.getByText(SECTION_LABELS['database'])).toBeInTheDocument();
        expect(nav.getByText(SECTION_LABELS['storage'])).toBeInTheDocument();
        expect(nav.getByText(SECTION_LABELS['erd'])).toBeInTheDocument();
    });

    it('renders nothing for a collapsed group', () => {
        const { container: settings } = render(
            <StudioSubNav group={groupOf('project-settings')} activeSection="project-settings" onSectionChange={vi.fn()} />
        );
        expect(settings.innerHTML).toBe('');

        const { container: overview } = render(
            <StudioSubNav group={groupOf('overview')} activeSection="overview" onSectionChange={vi.fn()} />
        );
        expect(overview.innerHTML).toBe('');
    });

    it('calls onSectionChange with the clicked section id', () => {
        const onSectionChange = vi.fn();
        render(<StudioSubNav group={groupOf('health')} activeSection="health" onSectionChange={onSectionChange} />);
        fireEvent.click(screen.getByText(SECTION_LABELS['backups']));
        expect(onSectionChange).toHaveBeenCalledWith('backups');
    });

    it('marks the active section', () => {
        render(<StudioSubNav group={groupOf('storage')} activeSection="storage" onSectionChange={vi.fn()} />);
        expect(screen.getByText(SECTION_LABELS['storage']).closest('button')).toHaveAttribute('aria-current', 'page');
        expect(screen.getByText(SECTION_LABELS['erd']).closest('button')).not.toHaveAttribute('aria-current');
    });
});
