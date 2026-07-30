import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppwriteProject } from '../../../types';

const createMembership = vi.fn(async () => ({}));
const deleteTeam = vi.fn(async () => ({}));
const deleteUser = vi.fn(async () => ({}));

vi.mock('../../../services/appwrite', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/appwrite')>();
    const empty = { total: 0, documents: [], users: [], teams: [] };
    const stub = new Proxy({}, { get: () => vi.fn(async () => empty) });
    return {
        ...actual,
        getSdkTeams: () => ({ createMembership, delete: deleteTeam }),
        getSdkUsers: () => ({ delete: deleteUser }),
        getSdkDatabases: () => stub,
        getSdkStorage: () => stub,
        getSdkFunctions: () => stub,
        getSdkSites: () => stub,
        createProjectAdminClient: () => ({}),
    };
});

const { useStudioActions } = await import('./useStudioActions');

const project: AppwriteProject = {
    $id: 'p1',
    name: 'Test Project',
    endpoint: 'https://appwrite.example.com/v1',
    projectId: 'proj-1',
    apiKey: 'secret',
};

/** Minimal stand-ins for the two hooks `useStudioActions` consumes. */
function makeHarness(selectedTeam: any = { $id: 'team-1', name: 'Ops' }) {
    const pagination = () => ({ items: [], total: 0, refresh: vi.fn() });
    const data = {
        selectedDb: null, setSelectedDb: vi.fn(),
        selectedCollection: null, setSelectedCollection: vi.fn(),
        selectedBucket: null, setSelectedBucket: vi.fn(),
        selectedFunction: null, setSelectedFunction: vi.fn(),
        selectedTeam,
        selectedSite: null, setSelectedSite: vi.fn(),
        attributes: [],
        usersPagination: pagination(), teamsPagination: pagination(),
        collectionsPagination: pagination(), documentsPagination: pagination(),
        filesPagination: pagination(), deploymentsPagination: pagination(),
        executionsPagination: pagination(), membershipsPagination: pagination(),
        siteDeploymentsPagination: pagination(), siteLogsPagination: pagination(),
        fetchCollectionMeta: vi.fn(), fetchVariables: vi.fn(), fetchSiteVariables: vi.fn(),
    };

    // Auto-accept confirmations and auto-submit forms with the supplied values.
    // The handlers are fire-and-forget, so the callbacks' promises are collected
    // and `flush()` lets a test await the work they kicked off.
    const formValues: Record<string, any> = { email: 'new@example.com', roles: 'member', name: 'New Member' };
    const pending: Promise<unknown>[] = [];
    const modals = {
        confirmAction: vi.fn((_t: string, _m: string, onConfirm: () => any) => {
            pending.push(Promise.resolve().then(onConfirm));
        }),
        openForm: vi.fn((_t: string, _f: any[], onConfirm: (d: any) => any) => {
            pending.push(Promise.resolve().then(() => onConfirm(formValues)));
        }),
        setModalLoading: vi.fn(), setModal: vi.fn(), openCustomModal: vi.fn(), closeModal: vi.fn(),
    };

    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), toasts: [], addToast: vi.fn(), removeToast: vi.fn() };

    const actions = useStudioActions(project, data, modals, vi.fn(), vi.fn(), toast);
    const flush = () => Promise.all(pending);
    return { actions, data, modals, toast, flush };
}

beforeEach(() => {
    createMembership.mockClear();
    deleteTeam.mockClear();
    deleteUser.mockClear();
});

describe('handleCreateMembership', () => {
    it('sends the invitation back to the deploy origin', async () => {
        const { actions, flush } = makeHarness();
        actions.handleCreateMembership();
        await flush();

        expect(createMembership).toHaveBeenCalledTimes(1);
        const [teamId, roles, url, email] = createMembership.mock.calls[0] as unknown as any[];
        expect(teamId).toBe('team-1');
        expect(roles).toEqual(['member']);
        expect(url).toBe(window.location.origin);
        expect(email).toBe('new@example.com');
    });

    it('never passes the bare hardcoded localhost URL', async () => {
        const { actions, flush } = makeHarness();
        actions.handleCreateMembership();
        await flush();
        // jsdom's own origin happens to be a localhost URL, so assert on the exact
        // literal the defect used rather than on the substring.
        const args = (createMembership.mock.calls[0] as unknown as any[]).map(String);
        expect(args).not.toContain('http://localhost');
    });

    it('does not appear as a literal anywhere in the module', () => {
        const source = readFileSync(join(__dirname, 'useStudioActions.ts'), 'utf8');
        expect(source).not.toContain("'http://localhost'");
    });
});

describe('bulk delete handlers', () => {
    it('are exported by useStudioActions, not declared in Studio.tsx', () => {
        const { actions } = makeHarness();
        expect(typeof actions.handleBulkDeleteUsers).toBe('function');
        expect(typeof actions.handleBulkDeleteTeams).toBe('function');

        const studioSource = readFileSync(join(__dirname, '..', '..', 'Studio.tsx'), 'utf8');
        expect(studioSource).not.toContain('const handleBulkDeleteUsers');
        expect(studioSource).not.toContain('const handleBulkDeleteTeams');
    });

    it('report per-item failures through the toast layer instead of console.error', async () => {
        const { actions, toast, flush } = makeHarness();
        deleteUser.mockRejectedValueOnce(new Error('user is protected'));

        actions.handleBulkDeleteUsers(['u1', 'u2']);
        await flush();

        expect(deleteUser).toHaveBeenCalledTimes(2);
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('user is protected'));
        expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('1 of 2'));
        expect(toast.success).toHaveBeenCalledWith('Deleted 1 users.');
    });

    it('reports team deletion failures the same way', async () => {
        const { actions, toast, flush } = makeHarness();
        deleteTeam.mockRejectedValueOnce(new Error('team in use'));

        actions.handleBulkDeleteTeams(['t1']);
        await flush();

        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('team in use'));
        expect(toast.success).not.toHaveBeenCalled();
    });
});
