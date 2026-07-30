# Tasks: Turn on TypeScript `strict`

> **Plan:** ./implementation_plan.md
> **Status:** Complete
> **Current focus:** —
>
> **Wave plan (decided at pre-flight, 2026-07-30):** all three phases write `tsconfig.json`, so the
> dependency graph is a single chain — **Phase 1 → Phase 2 → Phase 3, serial, no phase-lanes.**

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

## How to work this list (implementer)
- Mark a task `[~]` and set **Current focus** when you start it; `[x]` only once its **Done when** is met; `[!] — <reason>` if blocked. Keep both current in real time, so an interruption resumes cleanly.
- **V** = verify at the phase-check tier. The full gate runs at the finish — and once more at the end of Phase 1, which is the only phase that changes `node_modules` (*Plan › §10*).
- **C** = checkpoint: update this phase's statuses and **Current focus**, re-read the plan's guardrails plus the next phase's entries, scan remaining statuses, then continue without pausing. Re-read both files in full after a context compaction.
- **All three phases write `tsconfig.json`, so they are strictly serial.** There is no concurrency to exploit — do **not** dispatch phase-lanes.
- **Phase 1 is a measurement gate.** Every error count in the plan is a *pre-install* number. T1.2 re-measures and writes the real numbers into the plan; Phase 2 and 3 are scoped from **those**, not from the plan's §1 table. If T1.2's numbers differ materially, revise the plan (with a `Revised:` line) before continuing — that is expected, not a divergence.
- **This is a refactor: behaviour must not change.** Fix types, never logic. A strict error that reveals a real bug gets an honest type and a §12 follow-up entry — not a fix. The 184-test suite is the behaviour pin and must stay green at every V.
- **Never** use `as any`, `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` to clear an error. The repo has zero of them today and Phase 3 makes that permanent.
- Verify in code only — commands, tests, scripts. No browser or computer-use tools.
- Assume other agents share this checkout: a modified file outside this plan's *Writes* is theirs — leave it alone, don't fix its failures, and stage only your own paths when committing.

## Phase 1: Supply React's types
*Ends with: `@types/react`, `@types/react-dom`, `@types/pako` and `@types/tar-js` installed; `npm run typecheck` clean under **today's** (non-strict) settings; component props genuinely enforced for the first time; the real per-flag error counts recorded in the plan. No strict flag enabled yet.*
*Writes: `package.json`, `package-lock.json`, `react-icons.d.ts` (delete), `.plans/2026-07-30-typescript-strict/implementation_plan.md`, plus whatever files T1.3's fallout names*
*Needs: —*

- [x] **T1.1** Install the four type packages — `package.json`, `package-lock.json`
    - `npm install --save-dev @types/react@^19.2.17 @types/react-dom@^19.2.3 @types/pako@^2.0.4 @types/tar-js@^0.3.5` (block verbatim in *Plan › §6 › package.json*).
    - Add nothing to `dependencies`; bump no runtime version.
    - **Done when:** the four appear in `devDependencies`, `node_modules/@types/react/` exists, and `git diff package.json` shows no other change.
- [x] **T1.2** Re-measure every flag and record the real numbers — `.plans/2026-07-30-typescript-strict/implementation_plan.md`
    - **This is a discovery task; it produces the authoritative work list for Phases 2 and 3.** Run each of: `npx tsc --noEmit` · `--strict` · `--noImplicitAny` · `--strictNullChecks` · `--strictFunctionTypes` · `--noUnusedLocals` · `--noUnusedParameters`, and capture the count each reports.
    - For `--noImplicitAny`, also capture the breakdown by error code and by file.
    - Write the results into the plan as a `> **Revised:** <date> — post-install measurement` block beside §1's table, keeping the pre-install numbers for comparison.
    - **Done when:** the new table is in the plan, and it records that **TS7026 is now 0** and that no TS7016 remains for `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `pako` or `tar-js`. If TS7026 is *not* 0, stop and diagnose before any further task — the plan's central premise is wrong and Phases 2–3 need rescoping.
- [x] **T1.3** Fix the fallout under today's settings — files named by the run below
    - `npm run typecheck` now enforces the props of the 60 `React.FC` components for the first time, so it may report genuine mismatches that were invisible while `React.FC` was `any`. Fix them.
    - Follow *Plan › §4*: annotation-level fixes only; no control-flow, no runtime change, no `as any`.
    - **Done when:** `npm run typecheck` exits 0 with `tsconfig.json` **unchanged** from `9844ea3`.
- [x] **T1.4** Retire the react-icons shim — `react-icons.d.ts` (delete)
    - Delete it, then re-run `npm run typecheck`. react-icons' own `IconBaseProps extends React.SVGAttributes<SVGElement>` already supplies `className` once React is typed (*Plan › §3a*).
    - If the typecheck goes red without it, restore it and record the reason in the plan's §12 instead.
    - **Done when:** either the file is gone and `npm run typecheck` is clean, or it is retained with a written reason.
- [x] **V1** Verify — **full gate**, because this is the only phase that changes `node_modules` and so the only one that can affect the build or the test compile: `npm run typecheck && npm test && npm run build` → typecheck clean, **184 tests passing**, build succeeds with only the pre-existing ">500 kB chunk" warning.
- [x] **C1** Checkpoint. *(V1 observed: typecheck exit 0 clean · 184/184 tests across 15 files · build `✓ built in 11.85s`, `dist/assets/index-CnVmyaGj.js 1,335.98 kB`, only the pre-existing >500 kB warning.)*

## Phase 2: Make the types honest
*Ends with: `"noImplicitAny": true`, `"strictNullChecks": true` and `"strictPropertyInitialization": true` in `tsconfig.json`, with `npx tsc --noEmit` clean.*
*Writes: `tsconfig.json`, `tools/databaseTools.ts`, `components/studio/hooks/useStudioActions.ts`, `components/studio/hooks/useStudioActions.test.ts`, `components/studio/ui/ToolConfiguration.tsx`, `services/backupService.ts`, `services/geminiService.ts`, `components/studio/tabs/BackupsTab.tsx`, `components/CreateFunctionModal.tsx`, `components/studio/TransferDocumentsModal.tsx`, `components/studio/ConsolidateBucketsModal.tsx` — **plus every file T1.2's by-file breakdown names**·*
*Needs: Phase 1 (its measurement defines this phase's work list; its types remove most of the pre-install 5000).*

> **Revised:** 2026-07-31 — *Writes* replaced by T1.2's actual by-file measurement. The pre-install
> guess above is superseded: the residual implicit anys are **almost entirely test fixtures**, and
> `BackupsTab.tsx` / `CreateFunctionModal.tsx` / `TransferDocumentsModal.tsx` /
> `ConsolidateBucketsModal.tsx` / `backupService.ts` no longer appear at all.
> **Actual Writes:** `tsconfig.json` · `components/studio/hooks/useStudioActions.test.ts` ·
> `components/studio/hooks/useSectionRefresh.test.tsx` · `components/studio/StudioShell.test.tsx` ·
> `hooks/useToast.test.tsx` · `services/migrationService.ts` · `tools/databaseTools.ts` ·
> `components/studio/hooks/useStudioActions.ts` · `components/studio/ui/ToolConfiguration.tsx` ·
> `services/geminiService.ts` · `components/ActionMessage.tsx`

- [x] **T2.1** Clear the residual implicit anys — files per T1.2's by-file breakdown
    - Work the codes T1.2 recorded: TS7031 (binding element), TS7006 (parameter), and the ~26 TS7018/7053/7010/7011 stragglers.
    - Fix at the root where a shared declaration should have carried the type (*Plan › §4*) rather than annotating each call site; the same error repeated across files usually means one under-typed export.
    - **Done when:** `npx tsc --noEmit --noImplicitAny` exits 0.
- [x] **T2.2** Enable `noImplicitAny` — `tsconfig.json`
    - Add `"noImplicitAny": true` to `compilerOptions`. Change nothing else; do not reformat existing keys.
    - **Done when:** `npm run typecheck` exits 0 with the flag in the file.
- [x] **T2.3** Make nullability honest — the files in this phase's *Writes*
    - Pre-install this was 47 errors (TS2345 ×29, TS2339 ×7, TS2538 ×6, TS2322 ×3, TS2783, TS2464), concentrated in `tools/databaseTools.ts` (18) and `useStudioActions.ts` (8). **Expect it to have grown** — values that were `any` now have real, nullable types. Use T1.2's number, not this one.
    - Prefer widening a declaration to `T | undefined` and keeping the existing runtime guard over adding new guards or non-null assertions (`!`). Do not introduce a runtime check that changes behaviour.
    - **Done when:** `npx tsc --noEmit --noImplicitAny --strictNullChecks --strictPropertyInitialization` exits 0.
- [x] **T2.4** Enable `strictNullChecks` and `strictPropertyInitialization` — `tsconfig.json`
    - Add both to `compilerOptions`.
    - **Done when:** `npm run typecheck` exits 0 with all three flags now in the file.
- [x] **V2** Verify: `npm run typecheck` clean; `npx vitest run` green (**184 tests** — the behaviour pin, which matters here because T2.3's null handling is the one part of this plan that can touch runtime code).
- [x] **C2** Checkpoint. *(V2 observed: `npm run typecheck` exit 0 with `noImplicitAny` + `strictNullChecks` + `strictPropertyInitialization` on · `npx vitest run` 184/184 across 15 files. T2.3 went 37 → 3 errors on two root fixes alone; see the plan's §3a and §6 Revised notes.)*

## Phase 3: The rest, and make it official
*Ends with: `tsconfig.json` carrying `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`; the whole gate green; `CONTEXT.md` true; and a guard that keeps it that way.*
*Writes: `tsconfig.json`, `components/CodeViewerSidebar.tsx`, `test/no-ts-suppressions.test.ts` (new), `CONTEXT.md`, plus the files carrying unused locals*
*Needs: Phase 2.*

- [x] **T3.1** Clear `strictFunctionTypes` and confirm the four zero-cost flags — `components/CodeViewerSidebar.tsx`
    - Pre-install this was 2 errors, both in `CodeViewerSidebar.tsx` (~:112 `sort((a: TreeNode, b: TreeNode) => …)`, ~:152 `children.map((child: TreeNode) => …)`): a typed comparator passed where `(a: unknown, b: unknown)` is expected. They may already be gone — re-check first, since the `unknown` came from a value that is now typed.
    - `strictBindCallApply`, `noImplicitThis`, `alwaysStrict` and `useUnknownInCatchVariables` all measured **0**; confirm each is still 0 rather than assuming.
    - **Done when:** `npx tsc --noEmit --strict` exits 0.
- [x] **T3.2** Clear the unused locals and parameters — files reported by the flags
    - Pre-install: 53 unused locals, 1 unused parameter. Delete genuinely dead symbols; for a deliberately-unused callback parameter, rename it with a leading underscore (TypeScript exempts those) rather than disabling the flag.
    - This retires the hand-deletion patch the previous plan made under protest (*Plan › §3a*) — prefer deleting the symbol over silencing the flag.
    - **Done when:** `npx tsc --noEmit --strict --noUnusedLocals --noUnusedParameters` exits 0.
- [x] **T3.3** Collapse to `"strict": true` — `tsconfig.json`
    - Replace the individually-added strict entries with the single `"strict": true`, and add `"noUnusedLocals": true` and `"noUnusedParameters": true`. Final block verbatim in *Plan › §6 › tsconfig.json*.
    - **Done when:** `npx tsc --noEmit` exits 0 **both** immediately before and immediately after the collapse — proving the umbrella flag is equivalent to the individual ones and that nothing was quietly dropped.
- [x] **T3.4** Add the guard, and see it red — `test/no-ts-suppressions.test.ts` (new)
    - Assert `tsconfig.json` has `strict`, `noUnusedLocals` and `noUnusedParameters` all `true`; assert no `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` under `components/`, `hooks/`, `services/`, `tools/`, `test/` (the count is 0 today — no allowlist). Mirror `test/no-raw-appwrite-fetch.test.ts`'s structure, including a third case proving the detector is not vacuous.
    - **Done when:** it goes red→green on **both** assertions — temporarily remove `"strict"` from `tsconfig.json` and confirm case 1 fails, restore it; confirm case 2 flags a fixture line containing a suppression comment. Then `npx vitest run test/no-ts-suppressions.test.ts` is green.
- [x] **T3.5** Make the docs true — `CONTEXT.md`
    - §2 Forbidden table: add a row banning `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`, enforced by `test/no-ts-suppressions.test.ts`. §3 tree: add that file.
    - Record the honest caveat beside the "Strict types" claim (~:30): **102 `as any` casts remain, and `strict` does not flag them.**
    - **Done when:** all three edits are present and the file's existing structure is otherwise unchanged.
- [x] **V3** Gate: `npm run typecheck && npm test && npm run build` → typecheck clean with `"strict": true`, all tests pass (184 + the guard's cases), build succeeds with **only** the pre-existing ">500 kB chunk" warning.
- [x] **C3** Checkpoint. *(V3 observed: `npm run typecheck` exit 0 with `"strict": true` · `npm test` **188 passed across 16 files** (184 + the guard's 4) · `npm run build` `✓ built in 14.51s`, `1,335.74 kB`, only the pre-existing >500 kB warning.)*
