import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Guard for `CONTEXT.md` §2: browser code never hand-builds an Appwrite REST
 * request. Uploads and downloads go through the `getSdk*` factories in
 * `services/appwrite.ts`, which own the endpoint, the headers and the chunking.
 *
 * The tell is the `X-Appwrite-Key` header: attaching it by hand means the code
 * built the URL by hand too, and put the admin key somewhere the SDK owner
 * cannot see.
 *
 * **The three sanctioned exceptions** are the Appwrite *Function worker source
 * templates* — JavaScript held in a template literal, deployed to Appwrite and
 * executed server-side, where our services are not importable:
 *
 *   - `services/backupService.ts`        (the backup worker)
 *   - `services/migrationService.ts`     (the migration worker)
 *   - `components/studio/ConsolidateBucketsModal.tsx` (the bucket-consolidation worker)
 *
 * They are allowed **by position, not by file**: only occurrences *inside a
 * template literal* are exempt. `services/migrationService.ts` contains both a
 * worker template and ordinary code, and this guard must still catch the latter.
 */

const ROOT = join(__dirname, '..');
const SCANNED_DIRS = ['components', 'hooks', 'services', 'tools'];
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.git']);
const SOURCE_EXTENSIONS = /\.(ts|tsx)$/;

const API_KEY_HEADER = /['"`]X-Appwrite-Key['"`]/;

/** The files permitted to carry a worker template at all. */
const WORKER_TEMPLATE_FILES = [
    'services/backupService.ts',
    'services/migrationService.ts',
    'components/studio/ConsolidateBucketsModal.tsx',
];

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (SKIPPED_DIRS.has(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            collectSourceFiles(full, acc);
        } else if (SOURCE_EXTENSIONS.test(entry) && !entry.includes('.test.')) {
            acc.push(full);
        }
    }
    return acc;
}

/** Blank out comments so documentation mentioning the header is not a hit. */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\r\n]/g, ' '))
        .replace(/\/\/[^\r\n]*/g, match => ' '.repeat(match.length));
}

/**
 * Marks each line as inside or outside a template literal, by tracking unescaped
 * backticks. A worker template is one long backtick string, so every line of it
 * reports `true`.
 */
export function templateLiteralDepthByLine(source: string): boolean[] {
    const lines = source.split(/\r?\n/);
    let inTemplate = false;
    return lines.map(line => {
        const startedInside = inTemplate;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '\\') { i++; continue; }
            if (line[i] === '`') inTemplate = !inTemplate;
        }
        // A line counts as "inside" if it began inside the literal.
        return startedInside;
    });
}

function allSourceFiles(): string[] {
    return SCANNED_DIRS.flatMap(dir => collectSourceFiles(join(ROOT, dir)));
}

function rel(file: string): string {
    return relative(ROOT, file).split(sep).join('/');
}

interface Hit { file: string; line: number; text: string; inWorkerTemplate: boolean; }

function findApiKeyHeaders(): Hit[] {
    const hits: Hit[] = [];
    for (const file of allSourceFiles()) {
        const raw = readFileSync(file, 'utf8');
        const stripped = stripComments(raw);
        const lines = stripped.split(/\r?\n/);
        const rawLines = raw.split(/\r?\n/);
        const insideTemplate = templateLiteralDepthByLine(stripped);

        lines.forEach((line, idx) => {
            if (!API_KEY_HEADER.test(line)) return;
            hits.push({
                file: rel(file),
                line: idx + 1,
                text: rawLines[idx].trim(),
                inWorkerTemplate: insideTemplate[idx],
            });
        });
    }
    return hits;
}

describe('browser code never hand-builds an Appwrite REST request', () => {
    it('attaches no X-Appwrite-Key header outside a deployed worker template', () => {
        const offenders = findApiKeyHeaders()
            .filter(h => !h.inWorkerTemplate)
            .map(h => `${h.file}:${h.line}  ${h.text}`);

        expect(
            offenders,
            'Use the getSdk* factories in services/appwrite.ts — they own the endpoint, the ' +
            'headers and chunked upload (CONTEXT.md §2).\n' + offenders.join('\n')
        ).toEqual([]);
    });

    it('exempts only the three known worker templates', () => {
        const exempted = [...new Set(findApiKeyHeaders().filter(h => h.inWorkerTemplate).map(h => h.file))];
        expect(exempted.sort()).toEqual([...WORKER_TEMPLATE_FILES].sort());
    });

    it('scans a non-empty set of source files', () => {
        expect(allSourceFiles().length).toBeGreaterThan(50);
    });

    it('would still catch a hand-built request (the detector is not vacuous)', () => {
        const source = [
            "const a = 1;",
            "const res = await fetch(url, {",
            "    headers: { 'X-Appwrite-Key': project.apiKey },",
            "});",
            "const worker = `",
            "    headers: { 'X-Appwrite-Key': destKey },",
            "`;",
        ].join('\n');

        const inside = templateLiteralDepthByLine(source);
        const flagged = source.split('\n')
            .map((line, i) => ({ line, i }))
            .filter(({ line, i }) => API_KEY_HEADER.test(line) && !inside[i])
            .map(({ i }) => i + 1);

        // Line 3 is real code and must be caught; line 6 sits in the worker template.
        expect(flagged).toEqual([3]);
    });
});
