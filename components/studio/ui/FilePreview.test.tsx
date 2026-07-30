import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { AppwriteProject } from '../../../types';

const getFileView = vi.fn(async () => new ArrayBuffer(8));

vi.mock('../../../services/appwrite', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/appwrite')>();
    return { ...actual, getSdkStorage: () => ({ getFileView }) };
});

const { FilePreview } = await import('./FilePreview');

const project: AppwriteProject = {
    $id: 'p1',
    name: 'Test Project',
    endpoint: 'https://appwrite.example.com/v1',
    projectId: 'proj-1',
    apiKey: 'secret',
};

const imageFile = { $id: 'f1', name: 'shot.png', mimeType: 'image/png', sizeOriginal: 2048 } as any;

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
    getFileView.mockClear();
    createObjectURL = vi.fn(() => 'blob:stub-url');
    revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('FilePreview', () => {
    it('fetches the bytes through the SDK rather than an unauthenticated URL', async () => {
        await act(async () => {
            render(<FilePreview project={project} bucketId="b1" file={imageFile} />);
        });

        expect(getFileView).toHaveBeenCalledWith('b1', 'f1');
        const img = await screen.findByAltText('shot.png');
        expect(img).toHaveAttribute('src', 'blob:stub-url');
    });

    it('revokes the object URL on unmount, so the preview cannot leak', async () => {
        let view: ReturnType<typeof render>;
        await act(async () => {
            view = render(<FilePreview project={project} bucketId="b1" file={imageFile} />);
        });
        expect(createObjectURL).toHaveBeenCalledTimes(1);

        act(() => { view!.unmount(); });
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:stub-url');
    });

    it('reports a failure instead of rendering a broken image', async () => {
        getFileView.mockRejectedValueOnce(new Error('user_unauthorized_scope'));

        await act(async () => {
            render(<FilePreview project={project} bucketId="b1" file={imageFile} />);
        });

        expect(await screen.findByText(/user_unauthorized_scope/)).toBeInTheDocument();
        expect(screen.queryByAltText('shot.png')).not.toBeInTheDocument();
    });
});
