import { describe, it, expect } from 'vitest';
import type { StudioTab } from '../types';
import {
    STUDIO_GROUPS,
    SECTION_TO_GROUP,
    SECTION_LABELS,
    isStudioGroupId,
    isStudioTab,
    groupOf,
    isCollapsed,
    defaultSectionOf,
    sectionSegments,
} from './studioNav';

const ALL_SECTIONS = Object.keys(SECTION_TO_GROUP) as StudioTab[];

describe('STUDIO_GROUPS', () => {
    it('declares the seven groups in the reviewed order', () => {
        expect(STUDIO_GROUPS.map(g => g.id)).toEqual([
            'overview', 'data', 'compute', 'auth', 'integrations', 'operations', 'settings',
        ]);
    });

    it('marks only `settings` as trailing', () => {
        const trailing = STUDIO_GROUPS.filter(g => g.placement === 'trailing');
        expect(trailing.map(g => g.id)).toEqual(['settings']);
    });

    it('gives every group at least one section', () => {
        for (const group of STUDIO_GROUPS) {
            expect(group.sections.length).toBeGreaterThanOrEqual(1);
        }
    });

    it('gives every group a non-empty label', () => {
        for (const group of STUDIO_GROUPS) {
            expect(group.label.trim()).not.toBe('');
        }
    });
});

describe('section ↔ group membership', () => {
    it('places every StudioTab in exactly one group', () => {
        const seen = new Map<string, number>();
        for (const group of STUDIO_GROUPS) {
            for (const section of group.sections) {
                seen.set(section, (seen.get(section) ?? 0) + 1);
            }
        }
        for (const section of ALL_SECTIONS) {
            expect(seen.get(section), `section ${section} must appear exactly once`).toBe(1);
        }
        expect(seen.size).toBe(ALL_SECTIONS.length);
    });

    it('keeps SECTION_TO_GROUP consistent with STUDIO_GROUPS', () => {
        for (const group of STUDIO_GROUPS) {
            for (const section of group.sections) {
                expect(SECTION_TO_GROUP[section]).toBe(group.id);
            }
        }
    });

    it('resolves groupOf back to the owning group', () => {
        for (const section of ALL_SECTIONS) {
            expect(groupOf(section).sections).toContain(section);
        }
    });
});

describe('SECTION_LABELS', () => {
    it('labels all 14 sections with no empty value', () => {
        expect(Object.keys(SECTION_LABELS)).toHaveLength(14);
        for (const section of ALL_SECTIONS) {
            expect(SECTION_LABELS[section].trim()).not.toBe('');
        }
    });

    it('uses the reviewed wording', () => {
        expect(SECTION_LABELS['erd']).toBe('Schema (ERD)');
        expect(SECTION_LABELS['database']).toBe('Databases');
        expect(SECTION_LABELS['project-settings']).toBe('Settings');
    });
});

describe('type guards', () => {
    it('recognises group ids', () => {
        expect(isStudioGroupId('data')).toBe(true);
        expect(isStudioGroupId('settings')).toBe(true);
        expect(isStudioGroupId('database')).toBe(false);
        expect(isStudioGroupId('nope')).toBe(false);
    });

    it('recognises section ids', () => {
        expect(isStudioTab('database')).toBe(true);
        expect(isStudioTab('project-settings')).toBe(true);
        expect(isStudioTab('data')).toBe(false);
        expect(isStudioTab('nope')).toBe(false);
    });

    it('does not treat inherited Object properties as ids', () => {
        expect(isStudioGroupId('toString')).toBe(false);
        expect(isStudioTab('constructor')).toBe(false);
    });
});

describe('collapse and defaults', () => {
    it('collapses only the single-section groups', () => {
        const collapsed = STUDIO_GROUPS.filter(isCollapsed).map(g => g.id);
        expect(collapsed).toEqual(['overview', 'settings']);
    });

    it('defaults a group to its first section', () => {
        expect(defaultSectionOf('data')).toBe('database');
        expect(defaultSectionOf('compute')).toBe('functions');
        expect(defaultSectionOf('auth')).toBe('users');
        expect(defaultSectionOf('integrations')).toBe('messaging');
        expect(defaultSectionOf('operations')).toBe('health');
        expect(defaultSectionOf('overview')).toBe('overview');
        expect(defaultSectionOf('settings')).toBe('project-settings');
    });
});

describe('sectionSegments', () => {
    it('omits the section segment for collapsed groups', () => {
        expect(sectionSegments('overview')).toBe('overview');
        expect(sectionSegments('project-settings')).toBe('settings');
    });

    it('nests the group id for expanded groups', () => {
        expect(sectionSegments('database')).toBe('data/database');
        expect(sectionSegments('storage')).toBe('data/storage');
        expect(sectionSegments('erd')).toBe('data/erd');
        expect(sectionSegments('functions')).toBe('compute/functions');
        expect(sectionSegments('sites')).toBe('compute/sites');
        expect(sectionSegments('users')).toBe('auth/users');
        expect(sectionSegments('teams')).toBe('auth/teams');
        expect(sectionSegments('messaging')).toBe('integrations/messaging');
        expect(sectionSegments('webhooks')).toBe('integrations/webhooks');
        expect(sectionSegments('health')).toBe('operations/health');
        expect(sectionSegments('migrations')).toBe('operations/migrations');
        expect(sectionSegments('backups')).toBe('operations/backups');
    });

    it('produces a unique segment path for every section', () => {
        const segments = ALL_SECTIONS.map(sectionSegments);
        expect(new Set(segments).size).toBe(segments.length);
    });
});
