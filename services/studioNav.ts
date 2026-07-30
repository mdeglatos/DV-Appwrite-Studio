import type { StudioTab } from '../types';

/**
 * The single owner of the Studio's navigation structure: what sections exist,
 * which group each belongs to, in what order they appear, how they are labelled,
 * and what URL segments they map to.
 *
 * This module is pure data + pure functions — no React, no JSX, no import from
 * `components/` — precisely so `services/router.tsx` may import it. The
 * presentation binding (icon + panel component per section) lives in
 * `components/studio/navigation.tsx`.
 *
 * Adding a Studio section is a three-step change:
 *   1. add the literal to `StudioTab` in `types.ts`
 *   2. add it to a group here (and give it a label)
 *   3. add its icon + panel in `components/studio/navigation.tsx`
 * Skipping step 2 or 3 is a compile error, not a blank screen.
 */

export type StudioGroupId =
    'overview' | 'data' | 'compute' | 'auth' | 'integrations' | 'operations' | 'settings';

export interface StudioGroup {
    id: StudioGroupId;
    label: string;
    sections: readonly StudioTab[];   // ordered; >= 1
    placement?: 'trailing';           // 'settings' only
}

export const STUDIO_GROUPS: readonly StudioGroup[] = [
    { id: 'overview', label: 'Overview', sections: ['overview'] },
    { id: 'data', label: 'Data', sections: ['database', 'storage', 'erd'] },
    { id: 'compute', label: 'Compute', sections: ['functions', 'sites'] },
    { id: 'auth', label: 'Auth', sections: ['users', 'teams'] },
    { id: 'integrations', label: 'Integrations', sections: ['messaging', 'webhooks'] },
    { id: 'operations', label: 'Operations', sections: ['health', 'migrations', 'backups'] },
    { id: 'settings', label: 'Settings', sections: ['project-settings'], placement: 'trailing' },
];

/**
 * Explicitly annotated `Record<StudioTab, …>` — that annotation is what turns a
 * section missing from the registry into a compile error.
 */
export const SECTION_TO_GROUP: Record<StudioTab, StudioGroupId> = {
    'overview': 'overview',
    'database': 'data',
    'storage': 'data',
    'erd': 'data',
    'functions': 'compute',
    'sites': 'compute',
    'users': 'auth',
    'teams': 'auth',
    'messaging': 'integrations',
    'webhooks': 'integrations',
    'health': 'operations',
    'migrations': 'operations',
    'backups': 'operations',
    'project-settings': 'settings',
};

export const SECTION_LABELS: Record<StudioTab, string> = {
    'overview': 'Overview',
    'database': 'Databases',
    'storage': 'Storage',
    'erd': 'Schema (ERD)',
    'functions': 'Functions',
    'sites': 'Sites',
    'users': 'Users',
    'teams': 'Teams',
    'messaging': 'Messaging',
    'webhooks': 'Webhooks',
    'health': 'Health',
    'migrations': 'Migrations',
    'backups': 'Backups',
    'project-settings': 'Settings',
};

const GROUP_BY_ID = STUDIO_GROUPS.reduce((acc, group) => {
    acc[group.id] = group;
    return acc;
}, {} as Record<StudioGroupId, StudioGroup>);

export function isStudioGroupId(v: string): v is StudioGroupId {
    return Object.prototype.hasOwnProperty.call(GROUP_BY_ID, v);
}

export function isStudioTab(v: string): v is StudioTab {
    return Object.prototype.hasOwnProperty.call(SECTION_TO_GROUP, v);
}

export function groupOf(section: StudioTab): StudioGroup {
    return GROUP_BY_ID[SECTION_TO_GROUP[section]];
}

/** A group with a single section renders no sub-nav and omits the section segment from its URL. */
export function isCollapsed(group: StudioGroup): boolean {
    return group.sections.length === 1;
}

export function defaultSectionOf(group: StudioGroupId): StudioTab {
    return GROUP_BY_ID[group].sections[0];
}

/** Canonical path suffix after `/project/:id/studio`, e.g. 'data/database' or 'settings'. */
export function sectionSegments(section: StudioTab): string {
    const group = groupOf(section);
    return isCollapsed(group) ? group.id : `${group.id}/${section}`;
}
