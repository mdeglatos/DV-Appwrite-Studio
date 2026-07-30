import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Guard for `CONTEXT.md` §2: the native `alert()` / `confirm()` / `prompt()`
 * dialogs are banned. Messages go through `useToast()`, confirmations through
 * `useConfirm()`.
 *
 * `alert` and `prompt` are never shadowed in this codebase, so any bare call is
 * the global. A bare `confirm(` is the global too — *unless* the file obtains
 * one from `useConfirm()`, which is the sanctioned replacement; `window.confirm(`
 * is banned unconditionally.
 */

const ROOT = join(__dirname, '..');
const SCANNED_DIRS = ['components', 'hooks', 'services', 'tools'];
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.git']);
const SOURCE_EXTENSIONS = /\.(ts|tsx)$/;

const NATIVE_ALERT_OR_PROMPT = /(?<![.\w$])(alert|prompt)\s*\(/;
const WINDOW_DIALOG = /window\s*\.\s*(alert|confirm|prompt)\s*\(/;
const BARE_CONFIRM = /(?<![.\w$])confirm\s*\(/;
/** The file gets its `confirm` from the app-wide confirmation owner. */
const USES_CONFIRM_HOOK = /useConfirm\s*\(\s*\)/;

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

/** Blank out comments so documentation mentioning `confirm()` is not a hit. */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\r\n]/g, ' '))
        .replace(/\/\/[^\r\n]*/g, match => ' '.repeat(match.length));
}

function allSourceFiles(): string[] {
    return SCANNED_DIRS.flatMap(dir => collectSourceFiles(join(ROOT, dir)));
}

function findNativeDialogCalls(): string[] {
    const hits: string[] = [];
    for (const file of allSourceFiles()) {
        const raw = readFileSync(file, 'utf8');
        const hookProvidesConfirm = USES_CONFIRM_HOOK.test(raw);
        const lines = stripComments(raw).split(/\r?\n/);
        const rawLines = raw.split(/\r?\n/);

        lines.forEach((line, idx) => {
            const banned =
                NATIVE_ALERT_OR_PROMPT.test(line) ||
                WINDOW_DIALOG.test(line) ||
                (!hookProvidesConfirm && BARE_CONFIRM.test(line));
            if (banned) {
                hits.push(`${relative(ROOT, file).split(sep).join('/')}:${idx + 1}  ${rawLines[idx].trim()}`);
            }
        });
    }
    return hits;
}

describe('native dialogs are banned', () => {
    it('finds no alert() / confirm() / prompt() call under components, hooks, services or tools', () => {
        const hits = findNativeDialogCalls();
        expect(hits, `Native dialogs are banned (CONTEXT.md §2). Use useToast() for messages and useConfirm() for confirmations.\n${hits.join('\n')}`).toEqual([]);
    });

    it('scans a non-empty set of source files', () => {
        expect(allSourceFiles().length).toBeGreaterThan(50);
    });

    it('would still catch a native dialog (the detector is not vacuous)', () => {
        const sample = [
            'alert("boom");',
            'window.confirm("boom");',
            'prompt("boom");',
            'if (!confirm("boom")) return;',
        ];
        for (const line of sample) {
            const banned =
                NATIVE_ALERT_OR_PROMPT.test(line) ||
                WINDOW_DIALOG.test(line) ||
                BARE_CONFIRM.test(line);
            expect(banned, `${line} should be flagged`).toBe(true);
        }
        // …while the sanctioned replacements are not flagged
        for (const line of ['toast.error("boom");', 'const ok = await confirm({ title: "t", message: "m" });']) {
            expect(NATIVE_ALERT_OR_PROMPT.test(line) || WINDOW_DIALOG.test(line)).toBe(false);
        }
    });
});
