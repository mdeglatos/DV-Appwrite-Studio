import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Guard for `CONTEXT.md` §2: TypeScript runs in `strict` mode, and nobody opts out of it.
 *
 * Two things decay a strict migration, and this pins both:
 *
 *  1. **The flags themselves.** `tsconfig.json` is the owner of what "strict types" means. If
 *     `strict`, `noUnusedLocals` or `noUnusedParameters` is removed or flipped to `false`, the
 *     claim in `CONTEXT.md` silently becomes false again.
 *  2. **Per-line escapes.** The `ts-ignore` / `ts-expect-error` / `ts-nocheck` comments switch the
 *     compiler off for a line or a file. The codebase has **zero** of them, so this pins that
 *     baseline rather than grandfathering anything — there is no allowlist.
 *
 * The comment names are assembled from fragments below so that this file, which is itself
 * scanned, does not match its own detector.
 *
 * Note that this guard says nothing about `as any` casts, which defeat the same flags and are
 * *not* counted here — see the plan at `.plans/2026-07-30-typescript-strict/`.
 */

const ROOT = join(__dirname, '..');
const SCANNED_DIRS = ['components', 'hooks', 'services', 'tools', 'test'];
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.git']);
const SOURCE_EXTENSIONS = /\.(ts|tsx)$/;

/** The compiler options this project refuses to lose. */
const REQUIRED_FLAGS = ['strict', 'noUnusedLocals', 'noUnusedParameters'] as const;

const AT = '@';
const SUPPRESSION_NAMES = ['ts-ignore', 'ts-expect-error', 'ts-nocheck'];
const SUPPRESSION = new RegExp(`${AT}(${SUPPRESSION_NAMES.join('|')})\\b`);

/**
 * Unlike the other guards in this directory, test files are **included**: they are part of the
 * `tsc` program and must satisfy the same flags, so a suppression there counts.
 */
function collectSourceFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (SKIPPED_DIRS.has(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            collectSourceFiles(full, acc);
        } else if (SOURCE_EXTENSIONS.test(entry)) {
            acc.push(full);
        }
    }
    return acc;
}

function allSourceFiles(): string[] {
    return SCANNED_DIRS.flatMap(dir => collectSourceFiles(join(ROOT, dir)));
}

function rel(file: string): string {
    return relative(ROOT, file).split(sep).join('/');
}

function findSuppressions(): string[] {
    const hits: string[] = [];
    for (const file of allSourceFiles()) {
        readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, idx) => {
            if (SUPPRESSION.test(line)) hits.push(`${rel(file)}:${idx + 1}  ${line.trim()}`);
        });
    }
    return hits;
}

describe('TypeScript strict mode cannot be silently switched off', () => {
    it('keeps strict, noUnusedLocals and noUnusedParameters enabled in tsconfig.json', () => {
        const tsconfig = JSON.parse(readFileSync(join(ROOT, 'tsconfig.json'), 'utf8'));
        const actual = Object.fromEntries(
            REQUIRED_FLAGS.map(flag => [flag, tsconfig.compilerOptions?.[flag]])
        );
        const expected = Object.fromEntries(REQUIRED_FLAGS.map(flag => [flag, true]));

        expect(
            actual,
            'tsconfig.json is the owner of what "strict types" means (CONTEXT.md §2). ' +
            'Turning one of these off makes that claim false.'
        ).toEqual(expected);
    });

    it('contains no compiler-suppression comment anywhere it scans', () => {
        const hits = findSuppressions();
        expect(
            hits,
            'Suppression comments are banned (CONTEXT.md §2) — the count is 0 and there is no ' +
            'allowlist. Give the value an honest type, or `unknown` plus a narrowing check.\n' +
            hits.join('\n')
        ).toEqual([]);
    });

    it('scans a non-empty set of source files, test files included', () => {
        const files = allSourceFiles();
        expect(files.length).toBeGreaterThan(50);
        expect(files.some(f => f.includes('.test.'))).toBe(true);
    });

    it('would still catch a suppression (the detector is not vacuous)', () => {
        const flagged = SUPPRESSION_NAMES.map(name => `// ${AT}${name} — silence this line`)
            .filter(line => SUPPRESSION.test(line));
        expect(flagged).toHaveLength(SUPPRESSION_NAMES.length);

        // …while ordinary code and prose about the rule are not flagged.
        for (const line of ['const x: unknown = load();', '// ts-ignore is banned in this repo']) {
            expect(SUPPRESSION.test(line), `${line} should not be flagged`).toBe(false);
        }
    });
});
