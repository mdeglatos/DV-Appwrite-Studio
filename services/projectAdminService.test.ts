import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppwriteProject } from '../types';

const call = vi.fn();

vi.mock('./appwrite', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./appwrite')>();
    return {
        ...actual,
        createProjectAdminClient: () => ({
            call,
            config: { endpoint: 'https://appwrite.example.com/v1', project: 'proj-1' },
        }),
    };
});

const { getProjectUsage } = await import('./projectAdminService');

const project: AppwriteProject = {
    $id: 'p1',
    name: 'Test Project',
    endpoint: 'https://appwrite.example.com/v1',
    projectId: 'proj-1',
    apiKey: 'secret',
};

beforeEach(() => {
    call.mockReset();
});

describe('getProjectUsage', () => {
    it('returns the reported figures when the endpoint answers', async () => {
        call.mockResolvedValue({ bandwidth: 1024, storage: 2048, users: 7, databases: 2, functions: 1 });
        await expect(getProjectUsage(project)).resolves.toEqual({
            bandwidth: 1024, storage: 2048, users: 7, databases: 2, functions: 1,
        });
    });

    it('defaults missing fields to zero rather than inventing them', async () => {
        call.mockResolvedValue({});
        await expect(getProjectUsage(project)).resolves.toEqual({
            bandwidth: 0, storage: 0, users: 0, databases: 0, functions: 0,
        });
    });

    it('resolves to null — never to a number — when the call rejects', async () => {
        call.mockRejectedValue(new Error('missing scope: projects.read'));
        const result = await getProjectUsage(project);
        expect(result).toBeNull();
    });

    it('is deterministic across repeated failures (no fabricated values)', async () => {
        call.mockRejectedValue(new Error('boom'));
        const a = await getProjectUsage(project);
        const b = await getProjectUsage(project);
        expect(a).toBeNull();
        expect(b).toBeNull();
        expect(a).toEqual(b);
    });
});
