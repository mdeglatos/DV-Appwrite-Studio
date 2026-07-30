import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { StudioTab, AppwriteProject } from '../../types';

// The shell must never reach the SDK. Keep the module's pure helpers (Query,
// consoleLinks, listAll, normalizeEndpoint) real and stub only the factories.
const emptyList: Record<string, unknown> = {
    total: 0,
    documents: [], collections: [], files: [], functions: [], users: [], teams: [],
    sites: [], deployments: [], executions: [], memberships: [], variables: [],
    attributes: [], indexes: [], databases: [], buckets: [],
};
const execution = {
    $id: 'exec1',
    $createdAt: '2026-07-30T10:00:00.000Z',
    functionId: 'fn1',
    status: 'completed',
    responseStatusCode: 200,
    duration: 0.42,
    trigger: 'http',
    requestMethod: 'GET',
    requestPath: '/',
    requestHeaders: [] as unknown[],
    logs: 'ok',
    errors: '',
};

// One stable mock per method, so call counts survive across renders — the Sync
// case below counts re-fetches.
const sdkMethods = new Map<string, ReturnType<typeof vi.fn>>();
const sdkStub = new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => {
        if (!sdkMethods.has(prop)) {
            sdkMethods.set(prop, vi.fn(async () => (prop === 'getExecution' ? execution : emptyList)));
        }
        return sdkMethods.get(prop);
    },
});

vi.mock('../../services/appwrite', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../services/appwrite')>();
    return {
        ...actual,
        getSdkDatabases: () => sdkStub,
        getSdkStorage: () => sdkStub,
        getSdkFunctions: () => sdkStub,
        getSdkUsers: () => sdkStub,
        getSdkTeams: () => sdkStub,
        getSdkSites: () => sdkStub,
        getSdkMessaging: () => sdkStub,
        getSdkHealth: () => sdkStub,
        createProjectAdminClient: () => ({}),
    };
});

const { Studio } = await import('./../Studio');
const { Modal } = await import('./../Modal');
const { RouterProvider, resolveStudioSection, routes, matchRoute } = await import('../../services/router');
const { ToastProvider } = await import('../../hooks/useToast');
const { ConfirmProvider } = await import('../../hooks/useConfirm');
const { STUDIO_SECTION_UI } = await import('./navigation');
const { SECTION_TO_GROUP } = await import('../../services/studioNav');

const project: AppwriteProject = {
    $id: 'p1',
    name: 'Test Project',
    endpoint: 'https://appwrite.example.com/v1',
    projectId: 'proj-1',
    apiKey: 'secret',
};

/**
 * The first-paint marker each panel puts on screen. This is what proves the
 * registry rendered *that* section's panel and not another.
 */
const SECTION_MARKERS: Record<StudioTab, string> = {
    'overview': 'Project Overview',
    'database': 'Browse databases, collections, attributes, indexes and documents.',
    'storage': 'Manage storage buckets and the files they hold.',
    'erd': 'Entity-Relationship Visualizer (ERD)',
    'functions': 'Deploy and run serverless functions, and inspect their executions and variables.',
    'sites': 'Host web applications on Appwrite with automatic SSL, CDN and custom domains.',
    'users': 'Browse, search and manage the accounts registered against this project.',
    'teams': 'Group users into teams and manage their memberships and roles.',
    // These four used to be the tabs' loading strings, because each replaced its
    // whole page with a spinner. They now paint their frame immediately, so the
    // marker is the title — a stronger assertion, not a weaker one.
    'messaging': 'Unified Messaging Suite',
    'webhooks': 'Webhooks Plane',
    'health': 'Infrastructure Diagnostics',
    'migrations': 'Migration Setup',
    'backups': 'Project Snapshots',
    'project-settings': 'Project Settings Dashboard',
};

function renderStudio(activeTab: StudioTab, extra?: { path?: string; databases?: any[]; children?: React.ReactNode }) {
    window.history.replaceState(null, '', extra?.path ?? routes.studioSection('p1', activeTab));
    const onTabChange = vi.fn();
    const view = render(
        <RouterProvider>
            <ToastProvider>
                <ConfirmProvider>
                    <Studio
                        activeProject={project}
                        projects={[project]}
                        databases={extra?.databases ?? []}
                        buckets={[]}
                        functions={[]}
                        refreshData={vi.fn()}
                        onCreateFunction={vi.fn()}
                        activeTab={activeTab}
                        onTabChange={onTabChange}
                        onEditCode={vi.fn()}
                        logCallback={vi.fn()}

                    />
                    {extra?.children}
                </ConfirmProvider>
            </ToastProvider>
        </RouterProvider>
    );
    return { view, onTabChange };
}

beforeEach(() => {
    window.history.replaceState(null, '', '/');
});

afterEach(() => {
    vi.clearAllMocks();
    sdkMethods.clear();
});

describe('Studio registry dispatch', () => {
    it('covers every registered section with a marker', () => {
        expect(Object.keys(SECTION_MARKERS).sort()).toEqual(Object.keys(STUDIO_SECTION_UI).sort());
    });

    for (const section of Object.keys(STUDIO_SECTION_UI) as StudioTab[]) {
        it(`renders the panel registered for "${section}"`, () => {
            const { view } = renderStudio(section);
            expect(screen.getByText(SECTION_MARKERS[section])).toBeInTheDocument();
            view.unmount();
        });
    }

    it('renders the group chips and the active group\'s sub-nav', () => {
        renderStudio('health');
        expect(screen.getByText('Operations')).toBeInTheDocument();
        // Operations is an expanded group, so its three sections are offered
        expect(screen.getByText('Health')).toBeInTheDocument();
        expect(screen.getByText('Migrations')).toBeInTheDocument();
        expect(screen.getByText('Backups')).toBeInTheDocument();
    });

    it('renders no sub-nav for a collapsed group', () => {
        const { view } = renderStudio('overview');
        // 'Overview' appears once as the group chip; there is no sub-nav row to repeat it
        expect(view.container.querySelector('nav')).toBeNull();
    });
});

describe('unknown studio segments', () => {
    it('cannot be expressed as a registry section', () => {
        expect(Object.prototype.hasOwnProperty.call(STUDIO_SECTION_UI, 'nope')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(SECTION_TO_GROUP, 'nope')).toBe(false);
    });

    it('resolve to Overview through the expression AgentApp uses', () => {
        // `resolveStudioSection(route) ?? 'overview'` — the replacement for the
        // old hand-written route-name -> tab switch.
        for (const path of ['/project/p1/studio/nope', '/project/p1/studio/nope/nope', '/project/p1/studio/data/health']) {
            const { name, params } = matchRoute(path);
            const resolved = resolveStudioSection({ name, path, params, queryParams: {} });
            expect(resolved).toBeNull();
            expect(resolved ?? 'overview').toBe('overview');
        }
    });
});

describe('deep-linked modal', () => {
    const fn = { $id: 'fn1', name: 'worker', enabled: true, runtime: 'node-18.0' } as any;

    function studioTree(extraKey: number) {
        return (
            <RouterProvider>
                <ToastProvider>
                    <ConfirmProvider>
                        <Studio
                            activeProject={project}
                            projects={[project]}
                            databases={[]}
                            buckets={new Array(extraKey).fill(null).map((_, i) => ({ $id: `b${i}` })) as any}
                            functions={[fn]}
                            refreshData={vi.fn()}
                            onCreateFunction={vi.fn()}
                            activeTab="functions"
                            onTabChange={vi.fn()}
                            onEditCode={vi.fn()}
                            logCallback={vi.fn()}

                        />
                    </ConfirmProvider>
                </ToastProvider>
            </RouterProvider>
        );
    }

    it('is created once, and survives re-renders without duplicating', async () => {
        window.history.replaceState(null, '', routes.studioExecution('p1', 'fn1', 'exec1'));
        const view = render(studioTree(0));

        expect(await screen.findByText('Execution Details')).toBeInTheDocument();

        // Re-render repeatedly with unrelated prop churn.
        for (let i = 1; i <= 3; i++) {
            await act(async () => { view.rerender(studioTree(i)); });
        }

        expect(screen.getAllByText('Execution Details')).toHaveLength(1);
        view.unmount();
    });
});

describe('Escape key and open dialogs', () => {
    const databases = [{ $id: 'db1', name: 'Main DB', enabled: true }];
    const drillDownPath = '/project/p1/studio/data/database/db1';

    it('deselects the current resource when no dialog is open', async () => {
        renderStudio('database', { path: drillDownPath, databases });
        expect(window.location.pathname).toBe(drillDownPath);

        await act(async () => {
            fireEvent.keyDown(window, { key: 'Escape' });
        });

        expect(window.location.pathname).toBe(routes.studioSection('p1', 'database'));
    });

    it('leaves the selection intact while a dialog is registered', async () => {
        renderStudio('database', {
            path: drillDownPath,
            databases,
            children: <Modal isOpen title="A tab's own modal" onClose={vi.fn()}>body</Modal>,
        });
        expect(window.location.pathname).toBe(drillDownPath);

        await act(async () => {
            fireEvent.keyDown(window, { key: 'Escape' });
        });

        // Escape belongs to the dialog on top — the drill-down URL is untouched.
        expect(window.location.pathname).toBe(drillDownPath);
    });

    it('ignores a bare "r" and only refreshes on Shift+R', async () => {
        const refreshData = vi.fn();
        window.history.replaceState(null, '', routes.studioSection('p1', 'overview'));
        render(
            <RouterProvider>
                <ToastProvider>
                    <ConfirmProvider>
                        <Studio
                            activeProject={project}
                            projects={[project]}
                            databases={[]}
                            buckets={[]}
                            functions={[]}
                            refreshData={refreshData}
                            onCreateFunction={vi.fn()}
                            activeTab="overview"
                            onTabChange={vi.fn()}
                            onEditCode={vi.fn()}
                            logCallback={vi.fn()}

                        />
                    </ConfirmProvider>
                </ToastProvider>
            </RouterProvider>
        );

        await act(async () => { fireEvent.keyDown(window, { key: 'r' }); });
        expect(refreshData).not.toHaveBeenCalled();

        await act(async () => { fireEvent.keyDown(window, { key: 'R', shiftKey: true }); });
        expect(refreshData).toHaveBeenCalled();
    });
});

describe('section refresh registry', () => {
    it('re-fetches a self-loading section on Shift+R', async () => {
        // `backups` is not one of the seven sections `refreshCurrentView` knows,
        // so its own registration is the only thing that can re-fetch it.
        const { view } = renderStudio('backups');
        expect(await screen.findByText('Project Snapshots')).toBeInTheDocument();

        const listFiles = sdkMethods.get('listFiles')!;
        const before = listFiles.mock.calls.length;
        expect(before).toBeGreaterThan(0);

        await act(async () => { fireEvent.keyDown(window, { key: 'R', shiftKey: true }); });

        expect(listFiles.mock.calls.length).toBeGreaterThan(before);
        view.unmount();
    });

    it('stops re-fetching a section once it unmounts', async () => {
        const { view } = renderStudio('backups');
        expect(await screen.findByText('Project Snapshots')).toBeInTheDocument();
        const listFiles = sdkMethods.get('listFiles')!;
        view.unmount();

        const after = listFiles.mock.calls.length;
        await act(async () => { fireEvent.keyDown(window, { key: 'R', shiftKey: true }); });
        expect(listFiles.mock.calls.length).toBe(after);
    });
});

describe('UsersTab row actions', () => {
    const user = {
        $id: 'u1',
        name: 'Ada',
        email: 'ada@example.com',
        status: true,
        emailVerification: true,
        labels: [],
        registration: '2026-07-30T10:00:00.000Z',
    } as any;

    /** A `PaginatedState` stand-in — the tab only reads these members. */
    const pagination = {
        items: [user], total: 1, isLoading: false, error: null,
        searchQuery: '', setSearch: vi.fn(), refresh: vi.fn(),
        page: 0, pageSize: 25, totalPages: 1, hasNextPage: false, hasPrevPage: false,
        pageInfo: '1–1 of 1', nextPage: vi.fn(), prevPage: vi.fn(), setPageSize: vi.fn(),
    } as any;

    it('offers Change Email, the handler that was wired but unreachable', async () => {
        const { UsersTab } = await import('./tabs/UsersTab');
        const onUpdateEmail = vi.fn();

        render(
            <ToastProvider>
                <UsersTab
                    activeProject={project}
                    users={[user]}
                    onCreateUser={vi.fn()}
                    onDeleteUser={vi.fn()}
                    onUpdateEmail={onUpdateEmail}
                    pagination={pagination}
                />
            </ToastProvider>
        );

        const button = screen.getByTitle('Change Email');
        fireEvent.click(button);
        expect(onUpdateEmail).toHaveBeenCalledWith(user);
    });

    it('omits it when no handler is supplied', async () => {
        const { UsersTab } = await import('./tabs/UsersTab');
        render(
            <ToastProvider>
                <UsersTab
                    activeProject={project}
                    users={[user]}
                    onCreateUser={vi.fn()}
                    onDeleteUser={vi.fn()}
                    pagination={pagination}
                />
            </ToastProvider>
        );
        expect(screen.queryByTitle('Change Email')).not.toBeInTheDocument();
    });
});
