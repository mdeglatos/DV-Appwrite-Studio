import { describe, it, expect } from 'vitest';
import type { StudioTab } from '../types';
import { matchRoute, buildUrl, routes, rewriteLegacyPath, resolveStudioSection, type ParsedRoute, type RouteName } from './router';
import { SECTION_TO_GROUP } from './studioNav';

const ALL_SECTIONS = Object.keys(SECTION_TO_GROUP) as StudioTab[];

function parse(path: string): ParsedRoute {
    const { name, params } = matchRoute(path);
    return { name, path, params, queryParams: {} };
}

describe('matchRoute', () => {
    it('resolves a grouped studio collection drill-down with all three params', () => {
        const { name, params } = matchRoute('/project/p/studio/data/database/db1/collection/c1');
        expect(name).toBe('studio_collection');
        expect(params).toEqual({ projectId: 'p', dbId: 'db1', collId: 'c1' });
    });

    it('resolves the agent code-editor route (the F4 regression)', () => {
        const { name, params } = matchRoute('/project/p/agent/functions/f1/code');
        expect(name).toBe('agent_function_code');
        expect(params).toEqual({ projectId: 'p', fnId: 'f1' });
    });

    it('does not let the generic :group/:section pattern shadow a specific one', () => {
        expect(matchRoute('/project/p/studio/data/database/db1').name).toBe('studio_database');
        expect(matchRoute('/project/p/studio/compute/functions/f1').name).toBe('studio_function');
        expect(matchRoute('/project/p/studio/compute/sites/s1').name).toBe('studio_site');
        expect(matchRoute('/project/p/studio/auth/teams/t1').name).toBe('studio_team');
        // …while two segments after `studio` still fall to the generic pattern
        expect(matchRoute('/project/p/studio/compute/functions').name).toBe('studio_section');
    });

    it('returns not-found for an unmatched path', () => {
        expect(matchRoute('/project/p/studio/a/b/c/d/e/f/g').name).toBe('not-found');
        expect(matchRoute('/nonsense').name).toBe('not-found');
    });
});

describe('routes builders round-trip through matchRoute', () => {
    const cases: { built: string; expected: RouteName; params?: Record<string, string> }[] = [
        { built: routes.landing(), expected: 'landing' },
        { built: routes.login(), expected: 'login' },
        { built: routes.projects(), expected: 'projects' },

        { built: routes.agent('p'), expected: 'agent', params: { projectId: 'p' } },
        { built: routes.agentDatabase('p', 'db1'), expected: 'agent_database', params: { projectId: 'p', dbId: 'db1' } },
        { built: routes.agentCollection('p', 'db1', 'c1'), expected: 'agent_collection', params: { projectId: 'p', dbId: 'db1', collId: 'c1' } },
        { built: routes.agentStorage('p', 'b1'), expected: 'agent_storage', params: { projectId: 'p', bucketId: 'b1' } },
        { built: routes.agentFunction('p', 'f1'), expected: 'agent_function', params: { projectId: 'p', fnId: 'f1' } },
        { built: routes.agentFunctionCode('p', 'f1'), expected: 'agent_function_code', params: { projectId: 'p', fnId: 'f1' } },

        { built: routes.studioSection('p', 'database'), expected: 'studio_section', params: { projectId: 'p', group: 'data', section: 'database' } },
        { built: routes.studioDatabase('p', 'db1'), expected: 'studio_database', params: { projectId: 'p', dbId: 'db1' } },
        { built: routes.studioCollection('p', 'db1', 'c1'), expected: 'studio_collection', params: { projectId: 'p', dbId: 'db1', collId: 'c1' } },
        { built: routes.studioDocument('p', 'db1', 'c1', 'd1'), expected: 'studio_document', params: { projectId: 'p', dbId: 'db1', collId: 'c1', docId: 'd1' } },
        { built: routes.studioStorage('p', 'b1'), expected: 'studio_storage', params: { projectId: 'p', bucketId: 'b1' } },
        { built: routes.studioFile('p', 'b1', 'file1'), expected: 'studio_file', params: { projectId: 'p', bucketId: 'b1', fileId: 'file1' } },
        { built: routes.studioFunction('p', 'f1'), expected: 'studio_function', params: { projectId: 'p', fnId: 'f1' } },
        { built: routes.studioFunctionCode('p', 'f1'), expected: 'studio_function_code', params: { projectId: 'p', fnId: 'f1' } },
        { built: routes.studioExecution('p', 'f1', 'e1'), expected: 'studio_execution', params: { projectId: 'p', fnId: 'f1', execId: 'e1' } },
        { built: routes.studioSite('p', 's1'), expected: 'studio_site', params: { projectId: 'p', siteId: 's1' } },
        { built: routes.studioTeam('p', 't1'), expected: 'studio_team', params: { projectId: 'p', teamId: 't1' } },
    ];

    it('covers all 20 builders', () => {
        expect(cases).toHaveLength(20);
        expect(Object.keys(routes)).toHaveLength(20);
    });

    for (const { built, expected, params } of cases) {
        it(`${built} → ${expected}`, () => {
            const matched = matchRoute(built);
            expect(matched.name).toBe(expected);
            if (params) expect(matched.params).toEqual(params);
        });
    }

    it('never produces a legacy path that would need rewriting', () => {
        for (const { built } of cases) {
            expect(rewriteLegacyPath(built), `${built} should already be canonical`).toBeNull();
        }
    });
});

describe('routes.studioSection', () => {
    it('resolves every section back to itself', () => {
        for (const section of ALL_SECTIONS) {
            const path = routes.studioSection('p', section);
            expect(resolveStudioSection(parse(path)), `round-trip for ${section}`).toBe(section);
        }
    });

    it('collapses single-section groups', () => {
        expect(routes.studioSection('p', 'overview')).toBe('/project/p/studio/overview');
        expect(routes.studioSection('p', 'project-settings')).toBe('/project/p/studio/settings');
        expect(matchRoute(routes.studioSection('p', 'overview')).name).toBe('studio_group');
        expect(matchRoute(routes.studioSection('p', 'project-settings')).name).toBe('studio_group');
    });

    it('encodes the project id', () => {
        expect(routes.studioSection('a/b', 'database')).toBe('/project/a%2Fb/studio/data/database');
    });
});

describe('rewriteLegacyPath', () => {
    const cases: [string, string | null][] = [
        // §8.3 — legacy Studio paths
        ['/project/p/studio/overview', null],
        ['/project/p/studio/database', '/project/p/studio/data/database'],
        ['/project/p/studio/database/db1', '/project/p/studio/data/database/db1'],
        ['/project/p/studio/database/db1/collection/c1/document/d1', '/project/p/studio/data/database/db1/collection/c1/document/d1'],
        ['/project/p/studio/storage', '/project/p/studio/data/storage'],
        ['/project/p/studio/storage/b1/file/f1', '/project/p/studio/data/storage/b1/file/f1'],
        ['/project/p/studio/erd', '/project/p/studio/data/erd'],
        ['/project/p/studio/functions', '/project/p/studio/compute/functions'],
        ['/project/p/studio/functions/f1/code', '/project/p/studio/compute/functions/f1/code'],
        ['/project/p/studio/sites/s1', '/project/p/studio/compute/sites/s1'],
        ['/project/p/studio/users', '/project/p/studio/auth/users'],
        ['/project/p/studio/teams/t1', '/project/p/studio/auth/teams/t1'],
        ['/project/p/studio/messaging', '/project/p/studio/integrations/messaging'],
        ['/project/p/studio/webhooks', '/project/p/studio/integrations/webhooks'],
        ['/project/p/studio/health', '/project/p/studio/operations/health'],
        ['/project/p/studio/migrations', '/project/p/studio/operations/migrations'],
        ['/project/p/studio/backups', '/project/p/studio/operations/backups'],
        ['/project/p/studio/project-settings', '/project/p/studio/settings'],
        // §8.3 — the Agent view's singular `function` segment
        ['/project/p/agent/function/f1', '/project/p/agent/functions/f1'],
        ['/project/p/agent/function/f1/code', '/project/p/agent/functions/f1/code'],
    ];

    for (const [legacy, canonical] of cases) {
        it(`${legacy} → ${canonical ?? '(already canonical)'}`, () => {
            expect(rewriteLegacyPath(legacy)).toBe(canonical);
        });
    }

    it('returns null for already-canonical paths', () => {
        expect(rewriteLegacyPath('/project/p/studio/data/database/db1')).toBeNull();
        expect(rewriteLegacyPath('/project/p/studio/operations/health')).toBeNull();
        expect(rewriteLegacyPath('/project/p/studio/settings')).toBeNull();
        expect(rewriteLegacyPath('/project/p/studio')).toBeNull();
        expect(rewriteLegacyPath('/project/p/agent/functions/f1/code')).toBeNull();
        expect(rewriteLegacyPath('/project/p/agent')).toBeNull();
        expect(rewriteLegacyPath('/landing')).toBeNull();
        expect(rewriteLegacyPath('/')).toBeNull();
    });

    it('leaves an unknown studio segment alone so the app can redirect it', () => {
        expect(rewriteLegacyPath('/project/p/studio/nope')).toBeNull();
        expect(rewriteLegacyPath('/project/p/studio/nope/nope')).toBeNull();
    });

    it('rewrites every legacy section path exactly once', () => {
        for (const section of ALL_SECTIONS) {
            const legacy = `/project/p/studio/${section}`;
            const canonical = rewriteLegacyPath(legacy) ?? legacy;
            expect(canonical).toBe(routes.studioSection('p', section));
            expect(rewriteLegacyPath(canonical), `${canonical} must be a fixed point`).toBeNull();
        }
    });
});

describe('resolveStudioSection', () => {
    it('maps drill-down routes to their owning section', () => {
        expect(resolveStudioSection(parse('/project/p/studio/data/database/db1'))).toBe('database');
        expect(resolveStudioSection(parse('/project/p/studio/data/database/db1/collection/c1'))).toBe('database');
        expect(resolveStudioSection(parse('/project/p/studio/data/database/db1/collection/c1/document/d1'))).toBe('database');
        expect(resolveStudioSection(parse('/project/p/studio/data/storage/b1'))).toBe('storage');
        expect(resolveStudioSection(parse('/project/p/studio/data/storage/b1/file/f1'))).toBe('storage');
        expect(resolveStudioSection(parse('/project/p/studio/compute/functions/f1'))).toBe('functions');
        expect(resolveStudioSection(parse('/project/p/studio/compute/functions/f1/code'))).toBe('functions');
        expect(resolveStudioSection(parse('/project/p/studio/compute/functions/f1/execution/e1'))).toBe('functions');
        expect(resolveStudioSection(parse('/project/p/studio/compute/sites/s1'))).toBe('sites');
        expect(resolveStudioSection(parse('/project/p/studio/auth/teams/t1'))).toBe('teams');
    });

    it('maps a group path to that group\'s first section', () => {
        expect(resolveStudioSection(parse('/project/p/studio/operations/health'))).toBe('health');
        expect(resolveStudioSection(parse('/project/p/studio/operations'))).toBe('health');
        expect(resolveStudioSection(parse('/project/p/studio/data'))).toBe('database');
        expect(resolveStudioSection(parse('/project/p/studio/settings'))).toBe('project-settings');
        expect(resolveStudioSection(parse('/project/p/studio/overview'))).toBe('overview');
    });

    it('maps the bare studio route to overview', () => {
        expect(resolveStudioSection(parse('/project/p/studio'))).toBe('overview');
    });

    it('returns null for an unknown group or a section outside its group', () => {
        expect(resolveStudioSection(parse('/project/p/studio/nope/nope'))).toBeNull();
        expect(resolveStudioSection(parse('/project/p/studio/nope'))).toBeNull();
        // `health` is real, but it does not live in the `data` group
        expect(resolveStudioSection(parse('/project/p/studio/data/health'))).toBeNull();
        // a group id in the section slot is not a section
        expect(resolveStudioSection(parse('/project/p/studio/data/compute'))).toBeNull();
    });

    it('returns null for non-studio routes', () => {
        expect(resolveStudioSection(parse('/project/p/agent'))).toBeNull();
        expect(resolveStudioSection(parse('/landing'))).toBeNull();
        expect(resolveStudioSection(parse('/nonsense'))).toBeNull();
    });
});

describe('buildUrl is still the single path source', () => {
    it('remains exported and usable directly', () => {
        expect(buildUrl('studio_database', { projectId: 'p', dbId: 'db1' })).toBe('/project/p/studio/data/database/db1');
    });

    it('appends query parameters', () => {
        expect(buildUrl('projects', {}, { tab: 'all' })).toBe('/projects?tab=all');
    });

    it('falls back to / for an unknown route name', () => {
        expect(buildUrl('not-found')).toBe('/');
    });
});
