# Walkthrough: Turn on TypeScript `strict`

> **Status:** Complete
> **2026-07-31** · `main` · Plan: ./implementation_plan.md · Baseline: `9844ea3`

## What was implemented

**`tsconfig.json` now sets `"strict": true`, `"noUnusedLocals": true` and `"noUnusedParameters": true`,
and `npm run typecheck` exits 0.** The claim `CONTEXT.md` §2 had been making since the project started
is true rather than aspirational.

The headline is not the flags, though — it is what the measurement found underneath them.

- **`@types/react` and `@types/react-dom` were never installed.** React 19 bundles no types, so
  `react/jsx-runtime` resolved to nothing in 73 files, `JSX.IntrinsicElements` did not exist, and
  **every DOM element in the app was `any`** — 4013 of the 5017 `strict` errors, 84% of the total,
  from one missing dev dependency. `React.FC<Props>` was likewise `any`, meaning **60 components'
  props had never been type-checked at all**.
- **Installing four `@types/*` packages took `strict` from 5017 errors to 43** — 99.1% — with zero
  source edits. `components/Icons.tsx`'s 66 errors disappeared without the file being touched, which
  is the proof that `React.FC<IconProps>` now actually applies `IconProps`.
- **`react-icons.d.ts` is gone.** It hand-declared `className` on `IconBaseProps`, which react-icons
  already supplies via `React.SVGAttributes` — the shim existed only because `React` resolved to
  nothing. The typecheck is clean without it.
- **The remaining 43 collapsed to zero via two missing owners and ~60 small edits**, none of which
  changed behaviour (see *Decisions*).
- **`test/no-ts-suppressions.test.ts`** pins both halves of the result: the three `tsconfig.json`
  flags, and the codebase's count of **zero** `ts-ignore` / `ts-expect-error` / `ts-nocheck`
  comments. No allowlist. Seen red on both assertions before it was allowed to pass.
- **`CONTEXT.md` carries the honest caveat**: 107 `as any` casts remain (98 outside tests), and
  `strict` does not flag them — a cast silences exactly the errors these flags raise.

## Deviations from the plan

Four, each mirrored by a `Revised:` line in the plan.

1. **Phase 2's *Writes* list was wrong, and the plan said it would be.** T1.2 is a discovery task
   precisely because no phase after 1 could be sized before the install. The pre-install guess named
   `BackupsTab.tsx`, `CreateFunctionModal.tsx`, `TransferDocumentsModal.tsx`,
   `ConsolidateBucketsModal.tsx` and `backupService.ts`; the real residual implicit-`any` set was
   **almost entirely test fixtures**. The measured list replaced it before Phase 2 started.
2. **`services/appwrite.ts` gained `attributeDefault<T>()`** — not in the plan's Changes-by-File.
   30 of the 37 `strictNullChecks` errors were one shape: a deliberate `required ? null : value`
   passed to a `node-appwrite` parameter typed `T | undefined`. Details in *Decisions*.
3. **`types.ts` gained `NamedFunctionDeclaration`**, and `tools/index.ts` plus all ten
   `tools/*Tools.ts` modules now annotate their definition arrays with it. Also not in the plan's
   file list. Details in *Decisions*.
4. **T3.3's "before" state was built up first.** The plan's Done-when requires `tsc --noEmit` clean
   *both* immediately before and after collapsing the individual flags into `"strict": true`. Only
   three of the eight had been added incrementally (the other five measured 0 and were never needed),
   so all eight were written out explicitly, verified clean, and only then collapsed — otherwise the
   equivalence proof would have compared three flags against eight.

Two smaller reconciliations: `CONTEXT.md`'s §3 tree lost its `react-icons.d.ts` line (T1.4 deleted the
file), and `tools/*Tools.ts`'s now-unused `FunctionDeclaration` imports were dropped in the same edit
that introduced `NamedFunctionDeclaration`, so T3.2 did not inherit ten new `noUnusedLocals` errors.

## Decisions made

- **All five Open-Question defaults adopted** (build, 2026-07-30): full `strict`; `noUnusedParameters`
  enabled; the `as any` casts out of scope; `react-icons.d.ts` deleted; no CI added.
- **`attributeDefault<T>()` rather than 30 assertions or a flip to `undefined`.** Appwrite
  distinguishes an explicit `"default": null` from an omitted `default`; the SDK builds its payload
  with `if (typeof xdefault !== 'undefined') payload['default'] = xdefault`, verified in
  `node_modules/node-appwrite/dist/services/databases.mjs`. So passing `undefined` instead of `null`
  **sends a different request** — forbidden by the plan's §4. One documented helper in the module that
  already owns the SDK contract states the discrepancy once; it is identity at runtime.
- **`NamedFunctionDeclaration` rather than `tool.name!` at six sites.** `FunctionDeclaration.name` is
  optional upstream, but the name *is* the routing key (`availableTools[name]`) and the settings key.
  Stating that on the registry makes the compiler verify it across all ten tool modules, and clears the
  errors in `ToolConfiguration.tsx` and `geminiService.ts` **without editing either consumer**.
- **Three latent bugs were typed honestly and deliberately left unfixed**, per the plan's §4 —
  `SitesTab`'s pre-1.6 `dep.size` / `dep.buildTime`, `migrationService`'s `sourceDeployment.commands`,
  and `useChatSession`'s reach into the private `Chat#history`. The first two got optional legacy-field
  declarations so the code type-checks while doing exactly what it does today; the third moved to the
  public `getHistory()`, which returns a structured clone of the same history and is equivalent here.
  All three are logged in the plan's §12.
- **Write-only state was renamed, not deleted.** `_progress`, `_allItems`, `_execute`, `_events` have
  setters that *are* called, so deleting the state would delete real re-renders. TypeScript exempts
  `_`-prefixed destructured bindings (verified with a probe file before relying on it). Where neither
  the value nor the setter was used (`selectedDestProjId`, `totalEstimated`) the state was deleted
  outright; where only the setter was unused, the setter alone was dropped.
- **The guard builds its own search strings from fragments** (`AT + 'ts-ignore'`), so the file is not
  a match for its own detector. That is what lets it scan `test/` — including itself — with no
  allowlist at all, and it is why comments are *not* stripped here as the sibling guards do (a
  suppression **is** a comment; stripping would make the detector vacuous).
- **`TransferDocumentsModal` keeps its unused `projects` prop in the interface.** Removing it would
  mean editing three call sites in `DatabasesTab.tsx` for no type benefit; the dead prop is logged
  instead.

## Verification evidence

- **Final gate:** `npm run typecheck` → exit 0, clean, with `"strict": true` · `npm test` →
  **188 passed across 16 files**, exit 0 · `npm run build` → exit 0, `✓ built in 14.51s`,
  `dist/assets/index-q3kBlheM.js 1,335.74 kB`.
- **Pre-existing failures:** none at `9844ea3`, none introduced. The build's only warning is the
  ">500 kB chunk" one the plan names as a Non-Goal. Test count went 184 → 188 (+4, the guard's cases).
- **The measurement, taken standalone per flag** (T1.2 — full table in the plan's §1). Post-install,
  each figure includes a shared baseline of 5 errors that the install itself surfaced:

  | Flag | Reported | Net | Was |
  |---|---:|---:|---:|
  | `strict` | 43 | **38** | 5017 |
  | `noImplicitAny` | 22 | **17** | 5000 |
  | `strictNullChecks` | 54 | **49** | 47 |
  | `strictFunctionTypes` | 5 | **0** | 2 |
  | the other five strict flags | 5 each | **0** each | 0 |
  | `noUnusedLocals` / `noUnusedParameters` | 61 / 6 | **56 / 1** | 53 / 1 |

  `TS7026` went 4013 → **0**; no `TS7016` remains for `react`, `react/jsx-runtime`, `react-dom`,
  `react-dom/client`, `pako` or `tar-js`. Both §11 predictions held: `strictNullChecks` got *worse*
  (47 → 49) because values that were `any` acquired real nullable types, and
  `strictPropertyInitialization` cost 0. `strictFunctionTypes`' two `CodeViewerSidebar.tsx` errors
  resolved themselves once the array element type stopped being `unknown` — that file was never
  edited. The implicit-`children` landmine did not fire.
- **`strict` (43) measured *fewer* than `strictNullChecks` alone (54)**, because `noImplicitAny` gives
  several values a type precise enough that the null error collapses into an already-counted one —
  so the plan's ordering was not just cheaper but strictly less work.
- **The collapse is proven equivalent** (T3.3): `npx tsc --noEmit` exited 0 with all eight strict flags
  written out individually, and again after replacing them with `"strict": true` alone.
- **The guard was seen red first, on both assertions:**
  - Case 1 — `"strict": true` removed from `tsconfig.json` → `1 failed | 3 passed`, reporting
    `strict: undefined` against `strict: true`. Restored; green.
  - Case 2 — a real `@ts-nocheck` comment written to the top of `services/auditLogService.ts` →
    `1 failed | 3 passed`, reporting `services/auditLogService.ts:1`. Reverted; `git status` confirms
    the file is unmodified; green.
  - Case 4 asserts the detector is not vacuous independently: it flags all three suppression forms and
    spares both ordinary code and prose that names the rule without the `@`.
- **Behavioural pin:** every phase V ran the full 184-test suite (V1, V2) or the full gate (V1, V3),
  all green, and **zero `as any` was introduced** — `git diff | grep '^+' | grep -c 'as any'` → `0`.
- **The diff is 48 files, +219/−138** with no line-ending churn and no reformatting of untouched code.
- No check was left for a human; no browser was opened; no dev server was started.

## Follow-ups / known gaps

The plan's §12 now carries the full list. In short:

- [ ] **107 `as any` casts remain** and `strict` cannot see them. This is the honest limit of the
  work: the flags are on, the code is not yet fully typed. Worth its own plan — and worth doing *now*
  rather than before, because with `strict` on, removing a cast produces a useful error instead of a
  cascade.
- [ ] **Three latent bugs typed but not fixed** — `SitesTab`'s size/build-time chips never render
  against an Appwrite ≥ 1.6 server (`FunctionsTab` and `cleanupConfigs` already read `totalSize`);
  `migrationService`'s `sourceDeployment.commands` is a dead first operand; `useChatSession` no longer
  depends on a private field.
- [ ] **Four unfinished features surfaced by `noUnusedLocals`** — `ConsolidateBucketsModal`'s progress
  counter, `CleanupModal`'s `allItems`, and `CreateFunctionModal`'s execute-permissions and events
  lists are all written and never read.
- [ ] **`TransferDocumentsModal`'s external-destination fields cannot be edited** — four setters were
  never called, so those inputs are constants.
- [ ] **No CI runs `npm run typecheck`.** The guard test is the substitute (it runs under `npm test`),
  per the plan's adopted default. A real CI workflow is still its own decision.
- [ ] **The 1.34 MB single bundle** — unchanged, still its own plan.
