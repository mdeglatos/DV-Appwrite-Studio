# Walkthrough: Fill the app's remaining gaps

> **Status:** Complete
> **2026-07-30** · `main` · Plan: ./implementation_plan.md · Baseline: `922e2c1`

## What was implemented

**Thirty gaps closed, five of them by creating or reclaiming an owner rather than patching a site.**

- **A failed list no longer looks like an empty one.** `usePaginatedQuery` had produced an `error`
  field all along with **zero consumers**; `ResourceTable` printed "No items found." while loading
  *and* after a failure. A new `ListState` (loading → failed+Retry → empty → nothing) is now the only
  thing a list renders in place of rows, and all **12** list sites feed it — the 9 pagination-backed
  tables plus `SitesTab`'s three hand-rolled lists. Seven `.catch(() => [])` swallows are gone, so an
  API key missing `webhooks.read` says so instead of reporting "No webhooks registered."
- **Sync and `Shift+R` now reach all 14 sections.** `refreshCurrentView`'s switch covered 7. A
  `SectionRefreshProvider` + `useRegisterSectionRefresh` registry absorbs `BackupsTab`'s private
  `onRegisterRefresh` prop — the missing owner in single-use form — and seven self-loading tabs
  register through it.
- **No browser code hand-builds an Appwrite REST request any more.** All seven raw sites now use the
  SDK factories. The comment in `storageTools.ts` claiming the SDK "isn't browser-compatible" was
  false for v17 and is deleted; large uploads get chunking for free. `test/no-raw-appwrite-fetch.test.ts`
  keeps it that way.
- **Nine silent failures now reach the user**, including the two that were unhandled promise
  rejections (saving Gemini settings, toggling a tool). Every `console.error` in `useStudioActions`
  is gone; bulk operations name the reason per item and withhold the success toast when nothing
  succeeded.
- **The app-shell error is visible in both views.** `useProjects`/`useAppContext` errors — including
  "Connection Failed / likely CORS" — were rendered only inside `MainContent`, which the Studio never
  mounts. Extracted as `ErrorBanner` and rendered once under `<Header>`.
- **Seven dead ends closed:** "Change Email" has a button; a new API key's secret has a copy control;
  webhooks accept events outside the 11 presets and show `enabled` + a masked signature key; the
  fetched-but-hidden auth settings (session limit, duration, password history, dictionary, enabled
  OAuth providers) are rendered; a broadcast has a "Recent Campaigns" outcome; "No Project Selected"
  no longer flashes while projects load; `AgentApp.setError` is gone.
- Plus: file preview works in a **private** bucket (bytes through the SDK, object URL revoked on
  unmount) instead of a broken image and a 401'ing link; `ToolConfiguration`'s ids come from
  `useId()` rather than `Math.random()` on every render; `Header`/`MainContent` use `BotIcon` instead
  of importing `react-icons` directly.

## Deviations from the plan

Three, each mirrored by a `Revised:` line in the plan header.

1. **The plan's raw-transfer inventory was incomplete — it missed a seventh site.**
   `tools/functionsTools.ts` had a private `appwriteFetch()` helper (URL building + `X-Appwrite-Key`)
   backing two function-deployment uploads. The guard the plan specifies flags it, and R11 cannot
   hold while it stands — so leaving it would have meant weakening the guard. Both call sites now use
   `getSdkFunctions(project).createDeployment(...)` (same browser-safe `chunkedUpload` path as
   `createFile`, signature verified in `functions.d.ts:135`), and the dead helper is removed. Added
   as task **T3.4b**.
2. **`SectionRefreshProvider` gained an optional `store` prop**, plus a `useSectionRefreshStore()`
   export. `Studio` *renders* the provider, so it cannot read the context it supplies — yet it needs
   `runAll` for the Sync button and the `Shift+R` handler. It creates the store and passes it down.
   Both hook signatures the plan specifies are unchanged.
3. **Added `components/studio/ui/FilePreview.test.tsx`.** T3.5's Done-when requires asserting
   `getFileView` is called and the object URL is revoked on unmount — a component render, and
   `useStudioActions.test.ts` is a `.ts` file with no DOM harness.

Two smaller reconciliations: `BackupsTab`'s `ResourceTable` drops the `loadingMessage` the plan's
prose implied (the specified prop set is four, not five), and `LeftSidebar.test.tsx`'s existing
renders are now wrapped in `ToastProvider`, since the component reads the toast owner.

## Decisions made

- **All five Open-Question defaults adopted** (build, 2026-07-30): `ALL_SCOPES`' `messaging.read`/
  `messaging.write` replaced by the five per-resource pairs (`providers`/`topics`/`subscribers`/
  `messages`/`targets` × read+write); the read-only "Recent Campaigns" card included; `OverviewTab`'s
  API-key copy button left alone; `tsconfig.json` untouched; the ops-orchestrator plan's revision left
  out of scope.
- **The guard exempts worker templates by position, not by file.** `services/migrationService.ts`
  holds *both* a worker template (:353, sanctioned) and ordinary code (:571, a real defect). A
  file-level allowlist — the literal reading of the plan — would have blinded the guard to exactly
  the site Phase 3 exists to fix. It tracks unescaped backticks instead, and a separate case asserts
  the exempted set is precisely the three known templates.
- **`ToolConfiguration.applyTools` handles both a throw and a rejected promise.** `onToolsChange` is
  typed as returning `void`, but `useSettings.handleToolsChange` is `async` and rethrows, so the real
  failure arrives as a rejection.
- **`MigrationsTab`'s refresh no-ops while `step === 'executing'`**, per the plan — re-reading the
  checkpoint mid-run would fight the migration in flight.
- **`HealthTab` keeps its scope-error panel** rather than routing it through `ListState`; it is a
  page-level state, not a list's, and the plan says so explicitly.

## Verification evidence

- **Final gate:** `npm run typecheck` → exit 0, clean · `npm test` → **184 passed across 15 files**,
  exit 0 · `npm run build` → exit 0, `built in 10.74s`, `dist/assets/index-*.js 1,335.96 kB`.
- **Pre-existing failures:** none at `922e2c1`, none introduced. The build's only warning is the
  ">500 kB chunk" one the plan names as a Non-Goal. Test count went 149 → 184 (+35).
- **Guards demonstrated red before the fix**, as the plan required:
  - `test/no-raw-appwrite-fetch.test.ts` listed **exactly** the four sites Phase 3 fixes before any
    of them changed — `useStudioActions.ts:640`, `useStudioActions.ts:668`, `migrationService.ts:571`,
    `storageTools.ts:174` — and passes now. Its worker-template case passed independently throughout,
    proving the exemption is scoped to the three templates. A fourth case proves the detector is not
    vacuous by flagging real code and sparing template code in the same fixture.
  - `ListState.test.tsx`'s `ResourceTable` cases: the error and loading cases failed against the
    pre-change component (`2 failed | 10 passed`) while the "unchanged with no props" and "renders
    rows" cases passed — then all green.
  - `LeftSidebar.test.tsx`'s failed-save case: reverting the `try/catch` turned it red; restored → 7
    passed.
  - `StudioShell.test.tsx`'s Sync case: commenting out `useRegisterSectionRefresh(fetchBackups)`
    turned it red. `backups` is not one of the seven sections `refreshCurrentView` knows, so the
    registration is the only thing that can re-fetch it.
- **Behavioural checks** (each look-and-see criterion converted to an assertion):
  - *"a failed list shows the failure"* → `ListState.test.tsx`, 12 cases: branch precedence
    (loading beats error beats empty), Retry fires exactly once, `No items found.` is absent whenever
    there is an error.
  - *"every section renders its panel, now with its header during load"* → `StudioShell.test.tsx`'s
    14-section loop, with the four loading-string markers replaced by the tab **titles** — a stronger
    assertion, not a weakened one. The marker map is still asserted to cover exactly the registry's keys.
  - *"a section stops refreshing once it unmounts"* → same file, asserted on the real call count.
  - *"Change Email is reachable"* → `StudioShell.test.tsx` renders `UsersTab` with one user, clicks
    the control and asserts the handler receives that user; a second case asserts it is absent when
    no handler is passed.
  - *"transfers go through the SDK"* → `useStudioActions.test.ts`: `createFile`/`getFileDownload` are
    called, global `fetch` is spied and asserted **not** called, the object URL is revoked, and the
    module source contains neither `X-Appwrite-Key` nor `/storage/buckets/`.
  - *"preview works for a private bucket"* → `FilePreview.test.tsx`: `getFileView` is called with the
    bucket and file id, the `<img>` src is the object URL, the URL is revoked on unmount, and a
    rejected fetch renders the reason instead of a broken image.
  - *"a failed save reaches the user"* → `LeftSidebar.test.tsx` asserts the message is in the
    document and that a successful save reports nothing.
  - *"bulk failures name the reason"* → `useStudioActions.test.ts` covers users, teams and files.
  - No check was left for a human; no browser was opened.
- **Coverage disposition:** all **30 requirements (R1–R30) verified in the source at the finish**, row
  by row, against the diff rather than against the checkboxes. 0 deferred. Two residual
  `X-Appwrite-Key` matches were confirmed benign: `ConsolidateBucketsModal.tsx:176` (a sanctioned
  worker template) and an assertion string inside the test itself.

## Follow-ups / known gaps

Unchanged from *Plan › §12* — none were in scope:

- [ ] **`tsconfig.json` has no `strict` and no `noUnusedLocals`,** though `CONTEXT.md` §2 claims
  "strict types". The four files' unused imports were removed by hand (R28, labelled a patch in the
  plan's §3a); enabling either flag across 26 k lines is an unmeasured change and its own plan.
- [ ] **The 1.34 MB single bundle.** Genuine code-splitting is its own plan.
- [ ] **`OverviewTab.tsx` copies the project's admin API key to the clipboard** behind a masked
  display. A product decision, flagged and left.
- [ ] **`services/backupService.ts`'s restore path** — owned by `.plans/2026-07-21-ops-orchestrator/` §13.
- [ ] **`.plans/2026-07-21-ops-orchestrator/` still needs a revision note.** Its Studio-tab tasks
  assume the seven-place registration the previous plan removed.
- [ ] **`ALL_SCOPES`' new messaging scope names should be confirmed against the target server's
  version.** The documented list for Appwrite ≥ 1.4 was adopted per the plan's default; a server that
  rejects them would need the change reverted.
