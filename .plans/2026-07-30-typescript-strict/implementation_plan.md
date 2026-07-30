# Implementation Plan — Turn on TypeScript `strict` (and the unused-code flags)

> **Status:** Complete
> **Type:** Refactor + Infra/build tooling (measurement-driven)
> **Baseline:** `main` @ `9844ea3`
> **Date:** 2026-07-30
> **Related:** `.plans/2026-07-30-fill-app-gaps/` — its walkthrough flagged this as the follow-up
> ("`tsconfig.json` has no `strict` and no `noUnusedLocals`, though `CONTEXT.md` §2 claims *strict
> types*… an unmeasured change and its own plan"). This plan is that measurement.

---

## 1. Summary

`CONTEXT.md` §2 line 30 states the language convention is **"Strict types, no `any` unless
unavoidable."** `tsconfig.json` sets **none** of the eight `strict` flags. Turning `strict` on today
produces **5017 errors**.

That number is why the previous plan refused to promise this one. Measured properly, it is not what
it looks like:

| Flag (measured standalone at `9844ea3`) | Errors |
|---|---:|
| **`strict`** (all eight together) | **5017** |
| ├ `noImplicitAny` | **5000** |
| ├ `strictNullChecks` | 47 |
| ├ `strictFunctionTypes` | 2 |
| ├ `strictBindCallApply` | 0 |
| ├ `strictPropertyInitialization` | 0 |
| ├ `noImplicitThis` | 0 |
| ├ `alwaysStrict` | 0 |
| └ `useUnknownInCatchVariables` | 0 |
| `noUnusedLocals` *(not part of `strict`)* | 53 |
| `noUnusedParameters` *(not part of `strict`)* | 1 |

And `noImplicitAny`'s 5000 break down by error code:

| Code | Count | Meaning |
|---|---:|---|
| **TS7026** | **4013** | *JSX element implicitly has type `any` because no interface `JSX.IntrinsicElements` exists* |
| TS7031 | 442 | Binding element implicitly has an `any` type |
| TS7006 | 356 | Parameter implicitly has an `any` type |
| TS7016 | 163 | Could not find a declaration file for module |
| TS7018/7053/7010/7011/2339 | 26 | Misc. implicit `any` |

**One missing dev dependency causes ~84% of it.** `@types/react` and `@types/react-dom` are **not
installed** — not in `package.json`, not in `node_modules/@types/`, and present in
`package-lock.json` only as an *optional peer* of `@testing-library/react`. React 19 ships no bundled
types. So:

- `react/jsx-runtime` has no declarations in **73 files** → no `JSX.IntrinsicElements` → **every DOM
  element in the app is `any`** (the 4013).
- `react` has no declarations in **86 files** → `React` is `any` → **`React.FC<Props>` is `any`** →
  the props of the **60 files** that declare components that way are **not type-checked at all**, and
  their destructured props have no contextual type (most of the 798 TS7031+TS7006).

So the honest goal is not "fix 5017 errors". It is **supply the types the project never installed**,
then walk the flags on in ascending cost. The plan is sequenced so the single highest-value step is
also the first, and so the user can stop after Phase 1 having banked most of the benefit.

> **Revised:** 2026-07-31 — **post-install measurement (T1.2).** Taken after `npm install --save-dev`
> of the four `@types/*` packages, with `tsconfig.json` **unchanged**. The pre-install tables above are
> kept for comparison; **the table below is the authoritative work list for Phases 2 and 3.**
>
> The premise is confirmed: **`TS7026` is now 0** (was 4013) and **no `TS7016` remains** for `react`,
> `react/jsx-runtime`, `react-dom`, `react-dom/client`, `pako` or `tar-js` (was 163). `strict` fell
> from **5017 → 43**, a 99.1% reduction, from one `npm install` and zero source edits.
>
> Installing the types is not purely subtractive: with no flag enabled at all, `npx tsc --noEmit` now
> reports **5 errors** where it reported 0 — real defects that were invisible while `React.FC` was
> `any`. Every per-flag figure below therefore includes that shared baseline of 5, so the third column
> is the number that actually belongs to the flag.
>
> | Flag (measured standalone, post-install) | Reported | Baseline | **Net** | Was |
> |---|---:|---:|---:|---:|
> | *(no flag — today's `tsconfig.json`)* | 5 | — | **5** | 0 |
> | **`strict`** (all eight) | 43 | 5 | **38** | 5017 |
> | ├ `noImplicitAny` | 22 | 5 | **17** | 5000 |
> | ├ `strictNullChecks` | 54 | 5 | **49** | 47 |
> | ├ `strictPropertyInitialization` † | 54 | 5 | **0** | 0 |
> | ├ `strictFunctionTypes` | 5 | 5 | **0** | 2 |
> | ├ `strictBindCallApply` | 5 | 5 | **0** | 0 |
> | ├ `noImplicitThis` | 5 | 5 | **0** | 0 |
> | ├ `alwaysStrict` | 5 | 5 | **0** | 0 |
> | └ `useUnknownInCatchVariables` | 5 | 5 | **0** | 0 |
> | `noUnusedLocals` | 61 | 5 | **56** | 53 |
> | `noUnusedParameters` | 6 | 5 | **1** | 1 |
>
> † `strictPropertyInitialization` cannot be measured alone — `tsc` rejects it without `strictNullChecks`
> (TS5052). Measured as `--strictNullChecks --strictPropertyInitialization`: identical to
> `strictNullChecks` alone, so it costs **0**, as predicted.
>
> **The two predictions in §11 both held.** `strictNullChecks` did get *worse* (47 → 49 net) because
> values that were `any` now have real nullable types. `strictFunctionTypes`' 2 errors in
> `CodeViewerSidebar.tsx` **resolved themselves** — the array element type stopped being `unknown` —
> exactly as §3 anticipated. And the implicit-`children` landmine did not fire: zero wrapper components
> broke.
>
> **`strict` (43) is *fewer* than `strictNullChecks` alone (54)**, because `noImplicitAny` gives several
> values a type precise enough that the null error collapses into a different, already-counted one.
> Sequencing `noImplicitAny` before `strictNullChecks` (§5) is therefore not just cheaper, it is
> strictly less work.
>
> **`noImplicitAny`'s residual 17, by code:** TS7018 ×11 (object-literal property implicitly `any[]`),
> TS7010 ×5 (function lacking a return-type annotation), plus one extra TS2339. **By file it is almost
> entirely test fixtures:** `useStudioActions.test.ts` ×10, `useSectionRefresh.test.tsx` ×4,
> `StudioShell.test.tsx` ×1, `useToast.test.tsx` ×1 — the mock objects the previous plan's tests
> introduced. Only `SitesTab.tsx` and `migrationService.ts` are production files, and both are baseline
> errors, not implicit-`any` ones. **No `Icons.tsx` entry survives** — its 66 vanished without the file
> being touched, which is the §10 assertion that component props are genuinely enforced now.
>
> **`strict`'s residual 38, by file:** `tools/databaseTools.ts` 18 · `useStudioActions.ts` 8 ·
> `ui/ToolConfiguration.tsx` 7 · `SitesTab.tsx` 4 · `geminiService.ts` 2 · `migrationService.ts` 1 ·
> `useChatSession.ts` 1 · `useStudioActions.test.ts` 1 · `ActionMessage.tsx` 1. By code: TS2345 ×26,
> TS2538 ×6, TS2339 ×5, TS2322 ×3, TS2783 ×1, TS2464 ×1, TS2341 ×1 — overwhelmingly
> `null`-vs-`undefined` (12 × *"Type 'null' is not assignable to type 'string | undefined'"*, 10 ×
> `number | undefined`, 5 × `boolean | undefined`).

**Every count in the tables above the revision block is a pre-install measurement.** Installing the types changes all of them —
downward for `noImplicitAny`, and *plausibly upward* for `strictNullChecks`, because values that are
`any` today acquire real, nullable types. Phase 1 therefore ends with a **re-measurement task** whose
output is recorded in this plan before Phase 2 is scoped. That is deliberate: no phase after 1 can be
honestly sized until Phase 1 has run.

## 2. Goals / Non-Goals

**Goals**
- `tsconfig.json` sets `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`.
- `npm run typecheck` exits 0 with all of them on.
- React, react-dom, pako and tar-js all have declarations; no module in the program is implicitly `any`.
- `CONTEXT.md` §2's "Strict types" claim becomes true rather than aspirational.
- A guard keeps it that way: `strict` cannot be silently switched off, and the codebase's **current
  count of zero `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` comments** cannot silently grow.
- `npm test` (184 tests) and `npm run build` stay green throughout; **no runtime behaviour changes.**

**Non-Goals** — explicitly *not* in this plan:
- **Removing the 102 `as any` casts** in `components/`, `hooks/`, `services/`, `tools/`. `strict` does
  not flag them — a cast silences exactly the errors these flags raise — so the suite going green does
  **not** mean the code is honestly typed. Eliminating them is a separate semantic project. Counted
  here so the win is not overstated; logged in §12.
- **`skipLibCheck: false`.** Keeping it `true` is standard and avoids owning errors inside
  `node_modules` declarations we don't control.
- **Upgrading TypeScript, React, or any runtime dependency.** Only `devDependencies` gain entries.
- **Adding `checkJs`,** or otherwise type-checking the JS this repo allows via `allowJs: true`.
- **Any runtime/behavioural change.** Where a strict error reveals a latent bug, the fix is the
  narrowest type-correct change that preserves current behaviour; anything larger is logged in §12,
  not fixed here (see the Refactor guardrail in §4).
- **CI enforcement.** The repo has no CI workflow; the guard is a vitest test, matching how this repo
  already enforces conventions.

## 3. Current State & Research

Commands (repo root): `npm run dev` · `npm run build` (`vite build`) · `npm run preview` ·
`npm run typecheck` (`tsc --noEmit`) · `npm test` (`vitest run`).

**Known state at `9844ea3`:** `npm run typecheck` → exit 0, clean. `npm test` → **184 passing across
15 files**. `npm run build` → succeeds with exactly one warning (">500 kB chunk"), which is
out of scope here and in the previous plan. No failing tests.

**Critically: `vite build` does not type-check** (esbuild strips types), and `vitest` does not either.
`npm run typecheck` is the **only** type gate this repo has — and it has been running with React
untyped for the project's whole history.

### The current `tsconfig.json` (verbatim, the file has no `include`/`exclude`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "types": ["node"],
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": { "@/*": ["./*"] },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

`tsc --noEmit --listFiles` confirms the program is **123 project files** (excluding `node_modules`) —
`components/` 73, `services/` 16, `hooks/` 12, `tools/` 11, `test/` 3, plus `index.tsx`, `types.ts`,
`vite.config.ts`, `vite-env.d.ts` and `react-icons.d.ts`. **`dist/` is not in the program**, so the
absent `exclude` costs nothing and this plan does not add one.

`"types": ["node"]` restricts only *automatic* inclusion of global `@types/*` packages. `@types/react`
is resolved as a module import, so **this array does not need to change** — verified against how
`test/setup.ts` already pulls in `@testing-library/jest-dom/vitest` by explicit import.

### The missing declarations (TS7016, by module)

| Module | Files affected | Fix |
|---|---:|---|
| `react` | 86 | `@types/react` |
| `react/jsx-runtime` | 73 | `@types/react` |
| `react-dom` | 1 | `@types/react-dom` |
| `react-dom/client` | 1 | `@types/react-dom` |
| `pako` | 1 | `@types/pako` |
| `tar-js` | 1 | `@types/tar-js` |

Installed runtimes: `react` **19.2.4**, `react-dom` **19.2.4**. Latest published types:
`@types/react` **19.2.17**, `@types/react-dom` **19.2.3**, `@types/pako` **2.0.4**,
`@types/tar-js` **0.3.5** — all verified against the registry on 2026-07-30.

### Where the errors live

**`noImplicitAny` (TS7031 + TS7006), top files:** `components/Icons.tsx` 66 · `LeftSidebar.tsx` 48 ·
`tabs/DatabasesTab.tsx` 37 · `TransferDocumentsModal.tsx` 35 · `CodeViewerSidebar.tsx` 33 ·
`ContextBar.tsx` 32 · `tabs/FunctionsTab.tsx` 30 · `tabs/MigrationsTab.tsx` 29 ·
`ConsolidateBucketsModal.tsx` 29 · `tabs/SitesTab.tsx` 27 · `Studio.tsx` 21.

`Icons.tsx` is the proof of the mechanism: its 66 errors are the destructured `{ size, className }`
parameters of components annotated `React.FC<IconProps>`. `IconProps` is a perfectly good local
interface — it simply never reaches the parameters, because `React.FC` is `any`. **Installing the
types is what fixes those 66, not editing `Icons.tsx`.**

**`strictNullChecks` (47), by file:** `tools/databaseTools.ts` 18 · `hooks/useStudioActions.ts` 8 ·
`ui/ToolConfiguration.tsx` 6 · `services/backupService.ts` 4 · `tabs/BackupsTab.tsx` 3 ·
`CreateFunctionModal.tsx` 3 · `services/geminiService.ts` 2 · one each in
`useStudioActions.test.ts`, `TransferDocumentsModal.tsx`, `ConsolidateBucketsModal.tsx`.
By code: TS2345 ×29, TS2339 ×7, TS2538 ×6, TS2322 ×3, TS2783 ×1, TS2464 ×1.

**`strictFunctionTypes` (2):** both `components/CodeViewerSidebar.tsx` (~:112, ~:152) — a
`(a: TreeNode, b: TreeNode) => number` passed where `(a: unknown, b: unknown) => number` is expected.
Both may resolve themselves once the array's element type stops being `unknown`; re-check after Phase 1.

### Two findings that shape the risk

1. **Zero suppression debt.** `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck` appear **0 times**
   across `components/`, `hooks/`, `services/`, `tools/`, `test/`. That is a clean baseline worth
   defending — the usual way a strict migration is quietly defeated is a spray of `@ts-ignore`.
2. **The implicit-`children` landmine does not apply.** `@types/react` ≥18 removed implicit `children`
   from `React.FC<P>`, which normally breaks every wrapper component. A scan of all 60 `React.FC`
   files found **no component that renders `children` without declaring it** (the single grep hit,
   `ui/ListState.tsx`, mentions the word only in a doc comment). `TabShell`, `ToastProvider` and
   `SectionRefreshProvider` all declare `children: React.ReactNode` explicitly. Phase 1 should not
   have to touch them.

## 3a. Roots, not symptoms

| Symptom | Where a patch would stop | Root — the owner that replaces it |
|---|---|---|
| 4013 JSX elements are implicitly `any`; every DOM prop is unchecked | Suppress the code, or hand-annotate | **Nobody supplies React's types.** React 19 bundles none and `@types/react` was never installed. Install it — one dependency resolves all 4013 |
| 60 components' props are unenforced because `React.FC` is `any` | Replace `React.FC` with hand-written signatures in 60 files | Same root. `React.FC` is the right annotation; it is `any` only because the package behind it has no declarations |
| 798 destructured-prop / parameter implicit anys | Annotate 798 parameters | Same root — contextual typing returns the moment the types land. `Icons.tsx`'s 66 already have a perfectly good `IconProps` |
| `react-icons.d.ts` hand-declares `className` on `IconBaseProps` | Keep the shim | Same root, in its most visible form: react-icons already declares `IconBaseProps extends React.SVGAttributes<SVGElement>`, which *has* `className` — the shim exists only because `React` resolved to nothing. Delete it once the types are real |
| `CONTEXT.md` claims "Strict types" while `tsconfig.json` sets no strict flag | Reword the doc to match the code | **The config is the owner of what "strict" means, and it says nothing.** Turn the flags on; the doc becomes true without editing the claim |
| 53 unused locals / 1 unused parameter | Delete these 54 | **No owner for "is this symbol still used?"** `noUnusedLocals`/`noUnusedParameters` are that owner. The previous plan deliberately hand-deleted four files' worth and labelled it a patch precisely because this flag was unmeasured; this plan retires that patch |
| **(found in build, T2.3)** 30 of the 37 `strictNullChecks` errors are one shape: a deliberate `required ? null : value` passed to a `node-appwrite` parameter typed `T \| undefined` | Assert at each of the ~30 call sites, or flip them to `undefined` | **Nobody owns "what does *no default* look like on the wire?"** Appwrite distinguishes an explicit `"default": null` from an omitted key — the SDK builds its payload with `if (typeof xdefault !== 'undefined')` — so flipping to `undefined` would change the request. `services/appwrite.ts`, the module that already owns the SDK contract, gained **`attributeDefault<T>()`**: one documented place stating the discrepancy, identity at runtime |
| **(found in build, T2.3)** `tool.name` is `string \| undefined` at 6 consumer sites — index expressions and a label | `tool.name!` at each site | **The registry never stated its own guarantee.** Every declaration in `tools/` supplies a name — the name *is* the routing key (`availableTools[name]`) and the settings key. `types.ts` gained **`NamedFunctionDeclaration`**, and the 10 `*ToolDefinitions` arrays plus `toolDefinitionGroups` now use it, so the compiler *verifies* the guarantee instead of consumers asserting it |
| 102 `as any` casts | — | **Patch, and stated as one.** A cast defeats these flags by design, so `strict` going green will *not* remove them. Consolidating them needs per-site semantic judgement and is its own project — §2 Non-Goals, §12 follow-up. Naming it here stops "strict is on" being read as "the code is honestly typed" |

## 4. Architecture & Conventions to Follow

- **Behaviour must not change.** This is a refactor: every fix is the narrowest *type-level* change
  that preserves today's runtime behaviour. The behaviour pin is the existing suite —
  **184 tests across 15 files** — which must stay green at every phase. If a strict error reveals a
  genuine latent bug, **do not fix the bug**: make the types honest (e.g. accept `T | undefined` and
  keep the existing guard), and log the bug in §12. Mixing behavioural fixes into a 5000-error type
  migration destroys reviewability.
- **Fix at the root, not the site.** Prefer widening a shared type in `types.ts` or a service's
  signature over annotating N call sites. If the same error repeats across many files, find the shared
  declaration that should have carried the type.
- **`as any` is not a fix**, and neither is `@ts-ignore`. The repo has **zero** suppression comments;
  Phase 3's guard makes that permanent. Where a value is genuinely unknowable, use `unknown` plus a
  narrowing check, mirroring the `catch (e: any)` → message-extraction pattern already used throughout
  `hooks/useStudioActions.ts`.
- **Prefer `interface` for object shapes and local `type` aliases for unions**, mirroring
  `types.ts` and `components/studio/hooks/usePaginatedQuery.ts` (`PaginatedState<T>` is the canonical
  example of a fully-typed shared contract in this repo).
- **Component props:** keep `React.FC<Props>` where it is already used — once the types are installed
  it is correct and enforced. Do NOT convert the 60 files to a different annotation style.
- **Tests are part of the program** (`test/` is in `tsc`'s file list) and must satisfy the same flags.
  Test files may not be excluded to make the count go down.
- **Guards live in `test/` as source-scanning vitest tests**, mirroring
  `test/no-native-dialogs.test.ts` and `test/no-raw-appwrite-fetch.test.ts`.
- **Do NOT** change `skipLibCheck`, `allowJs`, `target`, `lib`, `moduleResolution`, `paths`,
  `jsx`, or the `types` array; do NOT add `include`/`exclude`; do NOT touch `vite.config.ts`,
  `package.json`'s `dependencies` (only `devDependencies`), or any runtime dependency version.

## 5. Proposed Approach

Ascending cost, dependency-correct, each phase ending green and shippable:

1. **Phase 1 — supply the types.** Install the four `@types/*` packages, fix whatever the *current*
   (non-strict) typecheck now reports (real prop mismatches that were invisible while `React.FC` was
   `any`), drop the redundant `react-icons.d.ts`, and **re-measure every flag**. No flag is enabled
   yet. This is the root fix and the discovery step for everything after it.
2. **Phase 2 — make the types honest.** `noImplicitAny` first (fix, then enable), then
   `strictNullChecks` (fix, then enable). The order is deliberate and is why they share a phase
   rather than splitting: null-checking a value that is still `any` is meaningless, so doing it in
   the other order means doing it twice.
3. **Phase 3 — the rest, and make it official.** `strictFunctionTypes` and the four zero-cost flags,
   then `noUnusedLocals`/`noUnusedParameters`, then collapse the individual entries into
   `"strict": true`, update `CONTEXT.md`, and add the guard.

**All three phases write `tsconfig.json`, so they are strictly serial — there is no concurrency to
exploit here and the builder should not attempt phase-lanes.** The *Writes* lines say so explicitly.
Each phase's V is genuinely different work: Phase 1 runs the full gate (it is the only phase that
changes `node_modules`), Phase 2 runs the cheap typecheck-plus-suite pair, Phase 3 runs the final
gate.

## 6. Changes by File

### Modify

- **`package.json`** — add four **devDependencies** only. No `dependencies` change, no version bumps.
  ```json
  "@types/pako": "^2.0.4",
  "@types/react": "^19.2.17",
  "@types/react-dom": "^19.2.3",
  "@types/tar-js": "^0.3.5"
  ```
  Install with `npm install --save-dev` so `package-lock.json` updates in the same step.
  Do NOT add `@types/node` (already present) or any runtime package.

- **`tsconfig.json`** — the only structural change in the plan. Flags are added **incrementally**
  (Phases 2–3) and then **collapsed** in Phase 3 into the block below, which is the final intended
  state, verbatim:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "experimentalDecorators": true,
      "useDefineForClassFields": false,
      "module": "ESNext",
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "skipLibCheck": true,
      "types": ["node"],
      "moduleResolution": "bundler",
      "isolatedModules": true,
      "moduleDetection": "force",
      "allowJs": true,
      "jsx": "react-jsx",
      "paths": { "@/*": ["./*"] },
      "allowImportingTsExtensions": true,
      "noEmit": true,
      "strict": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true
    }
  }
  ```
  The collapse must be **behaviour-identical**: `npx tsc --noEmit` reports the same (zero) errors
  before and after replacing the individual entries with `"strict": true`. T3.3 verifies exactly
  that. Do NOT reorder or reformat the pre-existing keys.

- **`components/Icons.tsx`, `components/LeftSidebar.tsx`, `components/ContextBar.tsx`,
  `components/CodeViewerSidebar.tsx`, `components/Studio.tsx`, `components/CreateFunctionModal.tsx`,
  `components/studio/TransferDocumentsModal.tsx`, `components/studio/ConsolidateBucketsModal.tsx`,
  `components/studio/ui/ToolConfiguration.tsx`, `components/studio/tabs/*.tsx`,
  `components/studio/hooks/useStudioActions.ts`, `tools/databaseTools.ts`,
  `services/backupService.ts`, `services/geminiService.ts`** — annotation-only fixes, per phase.
  - These are the files the **pre-install** measurement names. **The authoritative list is
    T1.2's re-measurement**, not this one — most `Icons.tsx`-class entries are expected to vanish
    when the types land.
  - Target: add or widen type annotations only. Do NOT change control flow, add runtime guards,
    reorder statements, or "improve" logic while passing through.

- **`CONTEXT.md`** — §2's stack table (~:30) already claims *"Strict types, no `any` unless
  unavoidable"*; leave the claim and make it true. Add to the **§2 Forbidden** table a row banning
  `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` (enforced by the new guard), and note in §3's tree
  that `test/no-ts-suppressions.test.ts` exists. Record the honest caveat: **102 `as any` casts remain
  and `strict` does not flag them.**

> **Revised:** 2026-07-31 — **two owners added in Phase 2 that this section did not anticipate.** Both
> are the §4 "fix at the root, not the site" guardrail applied to error classes the pre-install
> measurement could not see; both are behaviour-identical; neither adds a dependency or a new
> dependency edge (every consumer already imported the module it now takes the symbol from).
>
> - **`services/appwrite.ts`** — new export `attributeDefault<T>(value: T | null | undefined): T |
>   undefined`. Consumed by `tools/databaseTools.ts` (18 sites, all at the `finalDefault` declaration)
>   and `components/studio/hooks/useStudioActions.ts` (8 sites). Replaces 26 would-be assertions with
>   one documented statement of an SDK typing gap. The alternative — passing `undefined` instead of
>   `null` — changes the request body and is forbidden by §4.
> - **`types.ts`** — new export `type NamedFunctionDeclaration = FunctionDeclaration & { name: string }`.
>   `tools/index.ts` and all ten `tools/*Tools.ts` modules now annotate their definition arrays with
>   it, which is what makes the guarantee compiler-checked. Clears 6 errors in
>   `components/studio/ui/ToolConfiguration.tsx` and `services/geminiService.ts` **without editing
>   either consumer**. Each tool module's now-unused `FunctionDeclaration` import was dropped in the
>   same edit, so Phase 3's `noUnusedLocals` does not inherit ten new errors.

### Create

- **`test/no-ts-suppressions.test.ts`** — *the guard that keeps this plan's result from decaying.*
  Two assertions, mirroring `test/no-raw-appwrite-fetch.test.ts`'s structure (same
  `collectSourceFiles` / `stripComments` shape, same "detector is not vacuous" third case):
  1. `tsconfig.json` parses and has `compilerOptions.strict === true`, `noUnusedLocals === true`,
     `noUnusedParameters === true`.
  2. No `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` appears under `components/`, `hooks/`,
     `services/`, `tools/`, `test/` — the count is **0 today**, so this pins the baseline rather than
     grandfathering anything. No allowlist.

  It owns "the strict settings and the no-suppression rule", which nothing owns today. It must be
  **seen red first** (T3.4).

### Delete

- **`react-icons.d.ts`** (repo root) — the module augmentation adding `className` to `IconBaseProps`.
  Redundant once `@types/react` supplies `React.SVGAttributes`, which react-icons' own
  `IconBaseProps` already extends. **Delete only if the typecheck stays clean without it** (T1.4); if
  something still needs it, keep it and record why in the plan.

## 7. Requirements Coverage

*N/A — this is a single-goal config migration, not a multi-requirement blueprint. The
Changes-by-File ↔ tasks mapping and the per-phase error-count-to-zero checks are the coverage
mechanism. §3a accounts for every finding.*

## 8. Data Model / Interfaces

*No schema, no persisted shape, no env var, no runtime contract changes.* The only contracts are the
`tsconfig.json` block and the `package.json` dependency entries, both written verbatim in §6.

## 9. Dependencies

Four **devDependencies**, exact published versions verified 2026-07-30 (§6 has the block):
`@types/react@^19.2.17` · `@types/react-dom@^19.2.3` · `@types/pako@^2.0.4` · `@types/tar-js@^0.3.5`.

`@types/react` 19.2.x matches the installed `react` 19.2.4. Both `package.json` and
`package-lock.json` change. **No runtime dependency is added, removed or upgraded.**

## 10. Testing & Verification

No new *behavioural* tests: this plan changes no behaviour, and the existing **184 tests across 15
files** are the behaviour pin. The one new test file is the config guard (§6 Create).

**Phase check** (each phase's V):
- `npx tsc --noEmit` — expected **exit 0, no output**, with that phase's flags enabled.
- `npx vitest run` for the phase that touches test files, or the specific new test file.

**Gate** (the finish): `npm run typecheck && npm test && npm run build`.
Expected: typecheck clean; **184+ tests pass** (184 existing, plus the guard's cases); build succeeds
with **only** the pre-existing ">500 kB chunk" warning.

Phase 1 additionally runs the full gate, because installing `@types/react` is the one step in this
plan that can plausibly affect the **build** and the **test** compile — it is the only phase that
changes what `node_modules` contains.

**Every criterion here is a code check.** Nothing in this plan is verified by opening the app.

| Claim | The assertion that stands for it |
|---|---|
| React is genuinely typed now | T1.2's recorded counts: `npx tsc --noEmit --noImplicitAny` no longer reports **any** TS7026, and no TS7016 for `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `pako` or `tar-js`. |
| Component props are actually enforced | Same measurement — `Icons.tsx`'s 66 TS7031/TS7006 errors are gone **without editing `Icons.tsx`**, which is only possible if `React.FC<IconProps>` now applies `IconProps`. |
| Behaviour is unchanged | `npm test` → 184 passing, at every phase V and at the gate. |
| `strict` is genuinely on, not faked | T3.3: `npx tsc --noEmit` is clean both with the eight flags listed individually and with `"strict": true` alone — the collapse changes nothing. |
| The result cannot silently decay | `test/no-ts-suppressions.test.ts`, **seen red first** (T3.4) against a tsconfig with `strict` removed, and against a fixture containing `@ts-ignore`. |

**No check in this plan requires a human, a browser, or a second device.**

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **The post-install error count is unknown, so Phases 2 and 3 cannot be sized from this document.** | Accepted and made structural: **T1.2 is a discovery task** whose only output is the re-measured table, written back into this plan as a `Revised:` note *before* Phase 2 starts. Phase 1 is independently valuable, so the user can stop there. |
| **Installing `@types/react` surfaces genuine prop errors under today's settings** — 60 components' props have never been checked. | That is the point of the change, but it lands in Phase 1's budget, not as a surprise later: T1.3 exists solely to fix that fallout, and Phase 1's V is the full gate. |
| **`strictNullChecks` gets *worse*, not better, after Phase 1** — the measured 47 was taken while most values were `any`. | Stated in §1 and §11 rather than discovered. T1.2 re-measures it; if it has grown materially, T2.3's task is re-scoped from that number, not from 47. |
| **A strict error reveals a real latent bug**, tempting a behavioural fix mid-migration. | §4 makes this a hard guardrail: make the type honest, keep the behaviour, log the bug in §12. The 184-test pin catches an accidental behaviour change. |
| **`strict` goes green while 102 `as any` casts still hide the same class of error** — the migration looks more complete than it is. | Named in §1, §2 Non-Goals, §3a as an explicit patch, and §12. The plan never claims the code is fully typed, only that the compiler flags are on. |
| **Someone re-disables `strict` or sprays `@ts-ignore` later.** | `test/no-ts-suppressions.test.ts`, seen red first. Enforcement ladder: the flag itself is the type-level owner; the guard is the test-level backstop; `CONTEXT.md` is the doc layer. |
| **`@types/react` 19 removes implicit `children` from `React.FC`** — normally breaks every wrapper. | Pre-checked: **zero** affected components (§3). If one is missed, the fix is one line — declare `children: React.ReactNode` — mirroring `TabShell`. |
| **Shared working tree.** Another agent may be editing these files. | Every phase's *Writes* is exact; stage only those paths; re-read a file immediately before editing. Phase 1 touches `package-lock.json`, which conflicts loudly rather than silently — resolve by re-running `npm install`, never by hand-editing the lockfile. |
| **Security:** none. No dependency with runtime reach is added — `@types/*` packages are declarations only and are stripped at build time. | Noted so the reviewer need not check. |

## 12. Open Questions / Review

Each carries the default the plan assumes, so it is executable unanswered.

> **All five defaults adopted — proceeding with default (build, 2026-07-30).** The user invoked
> `build` on this plan without answering any of them, which per the build skill's pre-flight is a
> choice to execute it as written.

1. **[x] Is full `strict` the goal, or only "make `CONTEXT.md` true"?** The two are the same thing here,
   since the doc claims strict types. **Default: enable all eight flags.** If the appetite is smaller,
   the natural stopping point is **after Phase 1** — it removes ~84% of the errors, makes 60
   components' props enforced for the first time, and requires no tsconfig change at all. Phases 2–3
   are then a separate decision.
2. **[x] `noUnusedParameters` (1 error).** It is not part of `strict` and can be mildly annoying for
   callback signatures. **Default: enable it** — the cost is one error, and TypeScript already exempts
   parameters named with a leading underscore, which is the standard escape.
3. **[x] The 102 `as any` casts.** **Default: out of scope**, per §2 — `strict` does not flag them and
   removing them is per-site semantic work. Worth its own plan once these flags are on, because the
   flags are what make removing a cast produce a *useful* error rather than a cascade.
4. **[x] `react-icons.d.ts`.** **Default: delete it** in T1.4 if the typecheck is clean without it. It is a
   workaround for the missing React types and should not outlive them. Kept, with a recorded reason,
   if anything still depends on it.
5. **[x] CI.** This repo has no CI workflow, so nothing runs `npm run typecheck` automatically; the guard
   test is the substitute (it runs under `npm test`). **Default: do not add CI in this plan** — that is
   an infra decision beyond a tsconfig migration.

### Latent bugs surfaced by the migration — typed honestly, *not* fixed (§4 guardrail)

Installing the React types turned three previously-`any` values into real ones, and each exposed a
pre-existing defect. Per §4 the fix here was the narrowest type-level change that preserves today's
runtime behaviour; the behaviour fix is deliberately left for a separate change.

- [ ] **`components/studio/tabs/SitesTab.tsx` reads pre-1.6 Appwrite deployment fields.**
  `dep.size` and `dep.buildTime` do not exist on `node-appwrite` v17's `Models.Deployment` (renamed to
  `sourceSize` / `buildSize` / `totalSize` / `buildDuration`). Against a ≥1.6 server both are
  `undefined`, so **the size and build-time chips silently never render.**
  `components/studio/tabs/FunctionsTab.tsx:268` and `components/studio/hooks/cleanupConfigs.tsx:941`
  already read `totalSize ?? 0` — SitesTab is the outlier. Aligning it would make a currently-invisible
  element appear, which is a behaviour change; T1.3 instead declared the legacy names optional
  (`DeploymentWithLegacyMetrics`) so the code type-checks while doing exactly what it does today.
- [ ] **`services/migrationService.ts` (~:627) reads `sourceDeployment.commands`,** also absent from
  the v17 `Models.Deployment`. The expression is `sourceDeployment?.commands || func.commands`, so the
  fallback already carries it and behaviour is unaffected — but the first operand is dead. Same
  treatment in T2.1.
- [ ] **Four pieces of state are written but never read** — found by `noUnusedLocals` in T3.2 and
  left running exactly as they are. Deleting the state would also delete the `setX(…)` calls, which
  removes real re-renders, so each unread binding was renamed with a leading underscore instead
  (TypeScript exempts those) and the behaviour is untouched:
  `ConsolidateBucketsModal.tsx` `_progress` (incremented per bucket at ~:324 — a progress bar that
  was never rendered), `CleanupModal.tsx` `_allItems`, and `CreateFunctionModal.tsx`
  `_execute` / `_events` (the "Advanced Config" execute-permissions and events lists are collected
  into state and never submitted; the modal sends the `*Input` strings instead). Each is an
  unfinished feature, not dead weight — worth finishing or removing deliberately.
- [ ] **`TransferDocumentsModal`'s external-destination fields cannot be edited.**
  `setExtEndpoint` / `setExtProjectId` / `setExtApiKey` / `setExtDatabases` were never called, so
  T3.2 dropped the setters and the four values are now visibly constants. `selectedDestProjId` and
  `totalEstimated` had neither reader nor writer and were deleted outright. The component also
  accepts a `projects` prop it never reads — left in the interface so the three call sites in
  `DatabasesTab.tsx` are untouched.
- [ ] **`hooks/useChatSession.ts` (~:58) reached into `Chat#history`, a private field** of
  `@google/genai`. Replaced with the public `getHistory()`, which returns a structured clone of the
  same comprehensive history. Equivalent here (the old chat is discarded immediately), and no longer
  dependent on a private field surviving a minor-version bump.
