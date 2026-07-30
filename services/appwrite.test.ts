import { describe, it, expect } from 'vitest';
import { normalizeEndpoint, getConsoleUrl, listAll } from './appwrite';
import type { AppwriteProject } from '../types';

const project: AppwriteProject = {
    $id: 'doc-1',
    name: 'Test Project',
    endpoint: 'https://appwrite.example.com/v1',
    projectId: 'proj-1',
    apiKey: 'secret',
};

describe('normalizeEndpoint', () => {
    it('returns an empty string for a falsy endpoint', () => {
        expect(normalizeEndpoint('')).toBe('');
    });

    it('adds the https:// protocol when missing', () => {
        expect(normalizeEndpoint('appwrite.example.com')).toBe('https://appwrite.example.com/v1');
    });

    it('appends /v1 when missing', () => {
        expect(normalizeEndpoint('https://appwrite.example.com')).toBe('https://appwrite.example.com/v1');
    });

    it('strips trailing slashes', () => {
        expect(normalizeEndpoint('https://appwrite.example.com/v1///')).toBe('https://appwrite.example.com/v1');
    });

    it('leaves an already-normalized endpoint alone', () => {
        expect(normalizeEndpoint('https://appwrite.example.com/v1')).toBe('https://appwrite.example.com/v1');
    });
});

describe('getConsoleUrl', () => {
    it('maps https://host/v1 to https://host/console/project-default-<id>', () => {
        expect(getConsoleUrl(project)).toBe('https://appwrite.example.com/console/project-default-proj-1');
    });

    it('appends the resource path', () => {
        expect(getConsoleUrl(project, '/databases')).toBe(
            'https://appwrite.example.com/console/project-default-proj-1/databases'
        );
    });
});

describe('listAll', () => {
    it('paginates until total is reached', async () => {
        const items = Array.from({ length: 250 }, (_, i) => ({ $id: `item-${i}` }));
        const calls: string[][] = [];

        const listFn = async (queries: string[]) => {
            calls.push(queries);
            const offsetQuery = queries.find(q => q.includes('"offset"'));
            const offset = offsetQuery ? JSON.parse(offsetQuery).values[0] : 0;
            return { total: items.length, documents: items.slice(offset, offset + 100) };
        };

        const result = await listAll<{ $id: string }>(listFn, 'documents');

        expect(result).toHaveLength(250);
        expect(result[0].$id).toBe('item-0');
        expect(result[249].$id).toBe('item-249');
        expect(calls).toHaveLength(3);
    });

    it('stops early when a page comes back empty', async () => {
        const listFn = async () => ({ total: 1000, documents: [] as { $id: string }[] });
        const result = await listAll<{ $id: string }>(listFn, 'documents');
        expect(result).toHaveLength(0);
    });

    it('honours maxItems', async () => {
        const page = Array.from({ length: 100 }, (_, i) => ({ $id: `item-${i}` }));
        const listFn = async () => ({ total: 1000, documents: page });
        const result = await listAll<{ $id: string }>(listFn, 'documents', [], 150);
        expect(result).toHaveLength(200); // stops after the first page that crosses maxItems
    });
});
