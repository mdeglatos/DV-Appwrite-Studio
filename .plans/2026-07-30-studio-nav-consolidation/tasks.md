# Tasks: Studio Navigation Consolidation & Defect Sweep

> **Plan:** ./implementation_plan.md
> **Status:** Complete
> **Current focus:** —
>
> **Wave plan (decided at pre-flight, 2026-07-30):** every phase *Needs* the one before it, so all six run **serially, inline**. No phase-lanes.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

## How to work this list (implementer)
- Mark a task `[~]` and set **Current focus** when you start it; `[x]` only once its **Done when** is met; `[!] — <reason>` if blocked. Keep both current in real time, so an interruption resumes cleanly.
- **V** = verify at the phase-check tier. The full gate (`npm run typecheck && npm test && npm run build`) runs once, at the finish.
- **C** = checkpoint: update this phase's statuses and **Current focus**, re-read the plan's *Architecture & Conventions* plus the next phase's entries, scan remaining statuses, then continue without pausing. Re-read both files in full after a context compaction.
- Every phase here *Needs* the one before it — the Studio's navigation, routing, providers and shell all funnel through `components/Studio.tsx` and `components/AgentApp.tsx`, so there is no honest concurrency to exploit. Run them in order.
- Verify in code only — commands, tests, scripts. No browser or computer-use tools; a criterion that seems to need eyes gets the assertion written for it instead.
- Assume other agents share this checkout: a modified file outside this phase's *Writes* is theirs — leave it alone, don't fix its failures, and stage only your own paths when committing.
- **Do not rename any `StudioTab` id, `services/appwrite.ts` factory, `tools/` export, or Appwrite collection/field name.** Section ids in the registry are exactly the existing `StudioTab` literals.
- If reality diverges from the plan, update the plan and this list rather than silently improvising.

---

## Phase 1: Test harness
*Ends with: `npm test` runs under Vitest + jsdom and passes real assertions against existing pure functions; no application behaviour changed.*
*Writes: `package.json`, `vite.config.ts`, `test/setup.ts`, `services/appwrite.test.ts`*
*Needs: —*

- [x] **T1.1** Install the dev-only test tooling — `package.json`
    - Run the install command in *Plan › Dependencies* verbatim; add `"test": "vitest run"` to `scripts`.
    - **Done when:** the four packages appear under `devDependencies` at the pinned ranges and `npx vitest --version` prints a 4.x version.
- [x] **T1.2** Configure Vitest — `vite.config.ts`, `test/setup.ts` (new)
    - Switch `defineConfig` to the `vitest/config` import (keep `loadEnv` from `'vite'`) and add the `test` block exactly as written in *Plan › Changes by File › vite.config.ts* — including the `test.env` values, without which every test importing `services/appwrite.ts` dies at import time.
    - `test/setup.ts` imports `@testing-library/jest-dom/vitest` and registers `afterEach(cleanup)`.
    - Do NOT touch the `server`, `plugins`, `define` or `resolve` blocks.
    - **Done when:** ~~`npx vitest run` exits 0 (no test files is a pass)~~ `npx vitest run` resolves the config and reports the configured include/exclude globs, and `npx tsc --noEmit` is clean. *(Revised 2026-07-30: Vitest 4 exits 1 on an empty run unless `passWithNoTests` is set, which the plan does not add; T1.3 supplies the first test file and makes the run exit 0.)*
- [x] **T1.3** Prove the harness against existing pure functions — `services/appwrite.test.ts` (new)
    - Cases listed in *Plan › Changes by File › services/appwrite.test.ts*: `normalizeEndpoint`, `getConsoleUrl`, `listAll` pagination.
    - **Done when:** all three cases pass and the file imports `services/appwrite.ts` without an import-time throw.
- [x] **V1** Verify: `npx vitest run services/appwrite.test.ts` → green (10 passed); `npx tsc --noEmit` → clean (exit 0).
- [x] **C1** Checkpoint.

---

## Phase 2: Studio navigation registry
*Ends with: the registry exists, is typed exhaustively against `StudioTab`, and its invariants are asserted — nothing consumes it yet.*
*Writes: `services/studioNav.ts`, `services/studioNav.test.ts`, `components/studio/navigation.tsx`, `types.ts`*
*Needs: Phase 1*

- [x] **T2.1** Create the structure registry — `services/studioNav.ts` (new)
    - Exports exactly as declared in *Plan › Changes by File › services/studioNav.ts*; group/section table in *Plan › Proposed Approach*.
    - `SECTION_TO_GROUP` and `SECTION_LABELS` must carry the explicit `Record<StudioTab, …>` annotation — that is what turns a forgotten section into a compile error.
    - Pure data + pure functions only: **no React, no JSX, no import from `components/`** (*Plan › Architecture & Conventions*).
    - **Done when:** the module compiles, and deleting any one entry from `SECTION_TO_GROUP` makes `npx tsc --noEmit` fail (verify once, then restore). *Verified: removing `'erd'` produced `TS2741: Property 'erd' is missing … but required in type 'Record<StudioTab, StudioGroupId>'` (exit 2); restored → exit 0.*
- [x] **T2.2** Point `StudioTab` at its structure owner — `types.ts`
    - Keep the 14 literals byte-identical; add a doc comment naming `services/studioNav.ts` as the owner of grouping/labels/URLs. Do NOT move the union.
    - **Done when:** `npx tsc --noEmit` clean and the union is unchanged.
- [x] **T2.3** Create the presentation binding — `components/studio/navigation.tsx` (new)
    - `STUDIO_SECTION_UI: Record<StudioTab, { icon; Panel }>` and `STUDIO_GROUP_ICONS: Record<StudioGroupId, React.ReactNode>`, mapping each of the 14 sections to the panel it renders today (see the render switch at `components/Studio.tsx:317-488` for the current section→panel pairing) and to an icon from `components/Icons.tsx` only.
    - **Done when:** every `StudioTab` has a panel and every `StudioGroupId` an icon, proven by the `Record<…>` annotations type-checking.
- [x] **T2.4** Assert the registry invariants — `services/studioNav.test.ts` (new)
    - Cases listed in *Plan › Changes by File › services/studioNav.test.ts* (one group per section; group order; `settings` is the only trailing entry; `sectionSegments` outputs; no empty label).
    - **Done when:** all cases pass.
- [x] **V2** Verify: `npx tsc --noEmit` → clean (exit 0); `npx vitest run services/studioNav.test.ts` → green (17 passed).
- [x] **C2** Checkpoint.

---

## Phase 3: Routing — grouped paths, builders, legacy rewrite
*Ends with: every navigation in the app goes through `routes.*`; grouped URLs resolve; all 15 legacy paths in §8.3 rewrite; the Agent code-editor route resolves; an unmatched route redirects instead of blanking.*
*Writes: `services/router.tsx`, `services/router.test.ts`, `App.tsx`, `components/AgentApp.tsx`, `components/Studio.tsx`, `components/studio/hooks/useStudioData.ts`, `hooks/useAppContext.ts`*
*Needs: Phase 2*

- [x] **T3.1** Replace the route patterns and add the builders — `services/router.tsx`
    - Paste `ROUTE_PATTERNS` from *Plan › §8.1* verbatim (order is significant) and add the `routes` object from *Plan › §8.2*, implemented **on top of the existing `buildUrl`** — do not create a second string-building path.
    - `routes.studioSection` inserts the group segment via `sectionSegments()` from the registry.
    - Do NOT change `navigate`, `cleanPathname`, `parseQuery` or `NAVIGATE_EVENT`.
    - **Done when:** `npx tsc --noEmit` clean; `buildUrl` still exported.
- [x] **T3.2** Add `rewriteLegacyPath` and wire it into `RouterProvider` — `services/router.tsx`
    - Derive it from `services/studioNav.ts` (`isStudioGroupId` / `isStudioTab` / `sectionSegments`); also map the Agent view's `function` segment to `functions`. Return `null` when already canonical.
    - In `RouterProvider` (~:123-164) run it on mount and on every location change; on a non-null result `history.replaceState` and match the rewritten path.
    - **Done when:** the 15 rows of *Plan › §8.3* are produced by the function (asserted in T3.7).
- [x] **T3.3** Route every Agent-view navigation through the builders — `components/AgentApp.tsx`
    - Replace the 8 hand-built strings at ~:80, 82, 88, 179, 181, 198, 200, 274. Lines 179/181 become `routes.agentFunctionCode` / `routes.agentFunction` — **this is the F4 fix**.
    - Delete `VIEW_MODE_STORAGE_KEY` (~:39) and its write (~:77).
    - **Done when:** no `` `/project/${ `` template literal remains in the file and `npx tsc --noEmit` is clean.
- [x] **T3.4** Route the remaining 26 navigations through the builders — `components/Studio.tsx` (~:106, 108, 110, 122, 127, 132), `components/studio/hooks/useStudioData.ts` (~:117–159, 12 sites), `hooks/useAppContext.ts` (~:36–65, 8 sites)
    - Mechanical substitution only; no behaviour change.
    - **Done when:** `grep -rn '/project/\${' components hooks services` returns nothing.
- [x] **T3.5** Add `resolveStudioSection` and the unknown-segment fallback — `services/router.tsx`
    - Signature and semantics in *Plan › Changes by File › services/router.tsx*; returns `null` for an unknown group or a section that does not belong to its group.
    - **Done when:** it returns `'database'` for `studio_collection`, `'health'` for `/studio/operations/health`, `'overview'` for `/studio`, and `null` for `/studio/nope/nope`.
- [x] **T3.6** Consume the resolver and redirect dead routes — `components/AgentApp.tsx`, `App.tsx`
    - Delete the `activeStudioTab` IIFE (`AgentApp.tsx:52-74`) and use `resolveStudioSection(route) ?? 'overview'`; when it returns `null`, `navigate(routes.studioSection(projectId,'overview'), { replace: true })`.
    - In `App.tsx`, extend the auth effect (~:15-27) so `route.name === 'not-found'` redirects to `/` when logged in and `/landing` otherwise, `{ replace: true }`.
    - **Done when:** no hand-written route-name→tab switch remains, and `not-found` can no longer reach a render.
- [x] **T3.7** Assert the routing contract — `services/router.test.ts` (new)
    - Cases in *Plan › Changes by File › services/router.test.ts*, including the **round-trip case for all 20 `routes.*` builders** (the F4 regression test) and all 15 legacy rewrites.
    - **Done when:** every case passes, and reverting T3.1's `agent_function_code` pattern to the old singular form makes the round-trip case fail (verify once, then restore). *Verified: with the singular pattern restored, 2 cases went red — "resolves the agent code-editor route (the F4 regression)" and "never produces a legacy path that would need rewriting" (2 failed | 58 passed); restored → 60 passed.*
- [x] **V3** Verify: `npx tsc --noEmit` → clean (exit 0); `npx vitest run services/router.test.ts` → green (60 passed).
- [x] **C3** Checkpoint.

---

## Phase 4: Toast and Confirm owners
*Ends with: one `<ToastContainer>` at the app root so every toast is visible; one confirmation mechanism; zero `alert`/`confirm`/`prompt` calls, guarded by a test that was seen red.*
*Writes: `hooks/useToast.tsx` (renamed from `.ts`), `hooks/useToast.test.tsx`, `hooks/useConfirm.tsx`, `hooks/useConfirm.test.tsx`, `test/no-native-dialogs.test.ts`, `index.tsx`, `components/ConfirmationModal.tsx`, `components/Studio.tsx`, `components/AgentApp.tsx`, `components/studio/hooks/useStudioModals.ts`, `components/studio/tabs/{MessagingTab,ProjectSettingsTab,WebhooksTab,BackupsTab,MigrationsTab}.tsx`, `components/studio/{ConsolidateBucketsModal,TransferDocumentsModal}.tsx`*
*Needs: Phase 3*

- [x] **T4.0** Add the native-dialog guard and demonstrate it red — `test/no-native-dialogs.test.ts` (new)
    - Scan `components/`, `hooks/`, `services/`, `tools/` with `node:fs` per *Plan › Changes by File*; skip `node_modules`, `dist` and `*.test.*`.
    - **Done when:** run against the current tree it **fails**, listing the 8 known call sites (`ConsolidateBucketsModal.tsx:235,243,247,252`, `BackupsTab.tsx:104`, `MigrationsTab.tsx:117,135`, `TransferDocumentsModal.tsx:143`). Record that failing output before continuing. *Verified: red with exactly those 8 hits, in that order.*
    - *Revised 2026-07-30: after T4.5–T4.7 landed, the naive `/\b(alert|confirm|prompt)\s*\(/` also matched the sanctioned `confirm(...)` from `useConfirm()`. The detector now bans bare `alert(`/`prompt(` and `window.<dialog>(` unconditionally, and bare `confirm(` only in files that do not obtain one from `useConfirm()`; comments are stripped first, and a third case proves the detector is not vacuous.*
- [x] **T4.1** Convert the toast hook into a provider — `hooks/useToast.ts` → `hooks/useToast.tsx`
    - Add `ToastProvider`; `useToast()` reads context and throws a named error outside it. `ToastActions`, `Toast` and `ToastType` keep their exact current shapes so all 7 call sites compile unchanged.
    - Imports are extensionless, so no importer needs editing — confirm that rather than assuming it.
    - **Done when:** `npx tsc --noEmit` clean and no consumer file was edited.
- [x] **T4.2** Create the confirmation owner — `hooks/useConfirm.tsx` (new)
    - `ConfirmProvider` + `useConfirm()` returning `(opts: ConfirmOptions) => Promise<boolean>`; contract in *Plan › Changes by File › hooks/useConfirm.tsx*.
    - It renders the existing `components/ConfirmationModal.tsx` — do NOT write a second dialog component.
    - **Done when:** the provider compiles and `ConfirmationModal.tsx`'s props are unchanged.
- [x] **T4.3** Mount both providers at the app root — `index.tsx`
    - Order: `RouterProvider > ToastProvider > ConfirmProvider > App`.
    - **Done when:** `npx tsc --noEmit` clean.
- [x] **T4.4** Route `confirmAction` through `useConfirm` and remove the monkey-patch — `components/studio/hooks/useStudioModals.ts`, `components/Studio.tsx`
    - New signature `useStudioModals(onAfterClose?: () => void)`; `closeModal` calls it after clearing state. Reimplement `confirmAction` (~:16-26) as a wrapper over `useConfirm()` with its call signature unchanged, so the 29 `confirmAction` call sites in `useStudioActions.ts` are untouched.
    - Delete `Studio.tsx:115`'s `studioModals.closeModal = closeModal` assignment and pass the route-aware close in as `onAfterClose`.
    - **Done when:** no property of a hook's return value is reassigned anywhere, and `npx tsc --noEmit` is clean. **(F3, F17)**
    - *Revised 2026-07-30: `handleAfterModalClose` reads `selectedDb`/`selectedCollection`/… , so `Studio.tsx` now calls `useStudioData` **before** `useStudioModals` (the data hook never depended on the modals hook). `confirmAction` also catches a rejecting callback and reports it via `toast.error("Action Failed: …")`, preserving the error path the dynamic `Modal`'s confirm button used to own.*
- [x] **T4.5** Replace the three local confirmation states — `components/studio/tabs/{MessagingTab,ProjectSettingsTab,WebhooksTab}.tsx`
    - Delete the local `confirmation` state and `<ConfirmationModal>` render at `MessagingTab.tsx:28-33,484-495`, `ProjectSettingsTab.tsx:49-54,599-610`, `WebhooksTab.tsx:40-45,251-262`; call `useConfirm()` instead.
    - **Done when:** `<ConfirmationModal` appears only inside `hooks/useConfirm.tsx`.
- [x] **T4.6** Replace `AgentApp`'s confirmation state and drop Studio's toast container — `components/AgentApp.tsx`, `components/Studio.tsx`
    - `AgentApp`: delete `confirmationState` (~:91-93) and the render (~:379-381); re-express `requestProjectDeletion` (~:233-239) and `requestFileDelete` (~:241-247) with `useConfirm()`. Keep `requestFileDelete` as the `onFileDelete` prop passed to `CodeViewerSidebar` (~:375) — change only its body.
    - `Studio`: remove `<ToastContainer>` (~:493) and the local `useToast()` (~:63); actions keep working through context.
    - **Done when:** `<ToastContainer` appears exactly once in the tree, mounted by `ToastProvider`. **(F2, F3)**
    - *Revised 2026-07-30: `Studio.tsx` keeps its `const toast = useToast()` line — it is now a **context read**, not local state, and it is what feeds `useStudioActions(…, toast)`. Removing the call would have forced a signature change on `useStudioActions`, which this plan does not scope. The local `<ToastContainer>` is gone; the root provider owns the only one.*
- [x] **T4.7** Replace the eight `alert()` calls with toasts — `components/studio/{ConsolidateBucketsModal,TransferDocumentsModal}.tsx`, `components/studio/tabs/{BackupsTab,MigrationsTab}.tsx`
    - `ConsolidateBucketsModal.tsx:235,243,247,252` and `TransferDocumentsModal.tsx:143` → `toast.error` / `toast.warning`; `BackupsTab.tsx:104` and `MigrationsTab.tsx:117,135` → `toast.error`.
    - **Done when:** `test/no-native-dialogs.test.ts` — red in T4.0 — is green.
- [x] **T4.8** Assert the two providers — `hooks/useToast.test.tsx`, `hooks/useConfirm.test.tsx` (new)
    - Cases in *Plan › Changes by File*: a `toast.error('boom')` inside `ToastProvider` puts `boom` in the document; a provider-less render throws the named error; the container caps at 5. `useConfirm` resolves `true` on confirm, `false` on cancel and on Escape, one dialog at a time.
    - **Done when:** all cases pass.
- [x] **V4** Verify: `npx tsc --noEmit` → clean (exit 0); `npx vitest run hooks/useToast.test.tsx hooks/useConfirm.test.tsx` → green (11 passed); `npx vitest run test/no-native-dialogs.test.ts` → green (3 passed).
- [x] **C4** Checkpoint.

---

## Phase 5: Studio shell — grouped nav, sub-nav, page frame, panel dispatch
*Ends with: the Studio renders 6 group chips + a Settings gear + a sub-section row; every tab uses the shared page frame; `Studio.tsx` dispatches panels from the registry with no 14-branch switch left.*
*Writes: `components/studio/ui/{StudioNavBar,StudioSubNav,TabShell}.tsx`, `components/studio/ui/StudioNavBar.test.tsx`, `components/studio/StudioShell.test.tsx`, `components/Modal.tsx`, `components/LeftSidebar.tsx`, `components/Studio.tsx`, `components/AgentApp.tsx`, all 14 files in `components/studio/tabs/`*
*Needs: Phase 2, Phase 3, Phase 4*

- [x] **T5.1** Derive and thread the active group — `components/Studio.tsx`, `components/AgentApp.tsx`
    - Compute `activeGroup = groupOf(activeSection).id`; add an `onGroupChange` that navigates to `routes.studioSection(projectId, defaultSectionOf(group))` and an `onSectionChange` that navigates to `routes.studioSection(projectId, section)`.
    - **Done when:** switching group lands on that group's first section, and switching section stays inside the group.
- [x] **T5.2** Rewrite the top nav from the registry — `components/studio/ui/StudioNavBar.tsx`
    - Render the six primary group chips (icon + label), a divider, the `placement: 'trailing'` Settings gear (icon-only, `title="Settings"`), a divider, then the existing Sync button unchanged. New props in *Plan › Changes by File*.
    - Delete the local `tabs` array (~:14-29). Keep the existing chip styling and `custom-scrollbar` overflow.
    - **Done when:** no tab list is declared in this file. **(F1, N3)**
- [x] **T5.3** Add the section sub-nav — `components/studio/ui/StudioSubNav.tsx` (new)
    - Props and collapse behaviour in *Plan › Changes by File*; mirror the pill-row styling at `components/studio/tabs/FunctionsTab.tsx:220-239`.
    - Render it in `Studio.tsx` directly beneath the nav bar.
    - **Done when:** it renders 3 buttons for `data` and `null` for `settings` and `overview`. **(N4)**
- [x] **T5.4** Create the shared page frame — `components/studio/ui/TabShell.tsx` (new)
    - Props in *Plan › Changes by File*; header mirrors `components/studio/tabs/WebhooksTab.tsx:112-128`.
    - Do NOT set `max-w-*`, `mx-auto` or any scroll container — `Studio.tsx:315-316` keeps owning those.
    - **Done when:** the component compiles and declares no width or overflow class. **(N11)**
- [x] **T5.5** Drive the sidebar from the registry — `components/LeftSidebar.tsx`
    - Delete the local `studioTabs` array (~:188-197); render `STUDIO_GROUPS` as a grouped tree. Rename the props `activeStudioTab`/`onStudioTabChange` → `activeStudioSection`/`onStudioSectionChange` and update the call site in `AgentApp.tsx` (~:282-283).
    - **Done when:** the sidebar lists all 14 sections under their groups, with labels identical to `SECTION_LABELS`. **(F1, N8)**
- [x] **T5.6** Replace the render switch with registry dispatch — `components/Studio.tsx`
    - Look the active section up in `STUDIO_SECTION_UI` and render its `Panel`. Keep each section's existing prop object **verbatim** — this is a dispatch change, not a props change.
    - **Done when:** no `activeTab === '…' &&` branch remains and every section still renders its current panel. **(F1, F6, N9)**
- [x] **T5.7** Adopt `TabShell` in all 14 tabs and delete the duplicate wrappers — `components/studio/tabs/*.tsx`
    - Move each tab's existing `<h1>`/subtitle/console link into `TabShell` props; give the five tabs that have no header today (Databases list, Storage list, Functions list, Users, Teams) one.
    - Delete `BackupsTab.tsx:168`'s duplicate `max-w-6xl mx-auto space-y-8 animate-fade-in pb-20` wrapper and `MigrationsTab.tsx:215`'s `max-w-5xl mx-auto h-[calc(100vh-140px)]`.
    - **Done when:** no file under `components/studio/tabs/` contains `max-w-` or `mx-auto` at its root element. **(F22, N11)**
- [x] **T5.8** Stop the deep-link modal effect re-firing — `components/Studio.tsx`
    - Rewrite the effect at ~:136-237: drop `studioActions` and `openCustomModal` from the dependency array and guard with a `useRef` holding the last-opened `docId|fileId|execId`, so the modal is created once per param change.
    - **Done when:** re-rendering with an unchanged `docId` does not call `openCustomModal` a second time. **(F20)**
- [x] **T5.9** Make Escape dialog-aware and move the refresh shortcut — `components/Modal.tsx`, `components/Studio.tsx`
    - `Modal.tsx`: export `registerOpenDialog(): () => void` backed by a module-level counter, called from `Modal`'s mount effect.
    - `Studio.tsx` (~:271-300): bail on Escape whenever the counter is non-zero, not just when `studioModals.modal?.isOpen`. Change the bare `r` shortcut to `Shift+R` and mention it in the Sync button's `title`.
    - **Done when:** with a `CleanupModal` open, Escape closes it and leaves the selection intact. **(F25)**
- [x] **T5.10** Assert the shell — `components/studio/ui/StudioNavBar.test.tsx`, `components/studio/StudioShell.test.tsx` (new)
    - Nav bar: six primary chips with their labels, Settings gear last, chip click calls `onGroupChange`, sub-nav renders 3 for `data` / nothing for `settings`.
    - Shell: each registry section renders its registered panel; an unknown URL segment lands on `overview`; Escape with a dialog registered does not clear the selection.
    - `vi.mock('…/services/appwrite')` in the shell test — it must not hit the SDK.
    - **Done when:** all cases pass.
- [x] **V5** Verify: `npx tsc --noEmit` → clean; `npx vitest run components/studio/ui/StudioNavBar.test.tsx components/studio/StudioShell.test.tsx` → green.
- [x] **C5** Checkpoint.

---

## Phase 6: Corrections, cleanup and docs
*Ends with: every remaining finding F7–F26 fixed and asserted; no orphaned modules, exports or imports; `CONTEXT.md` matches the codebase; the full gate green.*
*Writes: `services/projectAdminService.ts`, `services/projectAdminService.test.ts`, `services/realtimeService.ts`, `components/Icons.tsx`, `components/LeftSidebar.tsx`, `components/LeftSidebar.test.tsx`, `components/Studio.tsx`, `components/AgentApp.tsx`, `components/studio/hooks/{useStudioActions,useStudioActions.test,useStudioData,usePaginatedQuery}.ts`, `components/studio/tabs/{OverviewTab,BackupsTab,MigrationsTab,DatabasesTab,FunctionsTab,ProjectSettingsTab,ErdTab}.tsx`, `hooks/{useRealtime,useAppContext}.ts`, `CONTEXT.md`; deletes `components/ExecutionLog.tsx`, `components/ProjectContextSelector.tsx`*
*Needs: Phase 5*

- [x] **T6.1** Stop fabricating usage statistics — `services/projectAdminService.ts`, `components/studio/tabs/OverviewTab.tsx`, `services/projectAdminService.test.ts` (new)
    - `getProjectUsage` returns `Promise<ProjectUsage | null>`; delete the `Math.random()` fallback at ~:239-248 entirely.
    - `OverviewTab` handles `null` with an explicit "Usage statistics unavailable for this API key" panel and drops the invented "1 GB Limit" / "500 MB Limit" ceilings, rendering raw values.
    - Test: a rejecting call resolves to `null`, never a number.
    - **Done when:** ~~the string `Math.random` appears nowhere in `services/`~~ the string `Math.random` appears nowhere in `services/projectAdminService.ts`, and `getProjectUsage` resolves to `null` on failure. **(F7)**
    - *Revised 2026-07-30: the original criterion was too broad. `services/databaseToolsService.ts` uses `Math.random` in `generateMockField` — a deliberate seed-data generator for the "generate mock documents" feature, not fabricated telemetry. Narrowed to the file F7 actually names.*
- [x] **T6.2** Make the Deep Thinking toggle reachable — `components/LeftSidebar.tsx`, `components/LeftSidebar.test.tsx` (new)
    - Change the gate at ~:353 from `modelInput === 'gemini-2.5-flash'` to `modelInput.endsWith('-flash')`.
    - Test: with `geminiModel: 'gemini-3-flash'`, the "Deep Thinking" toggle is in the rendered tree.
    - **Done when:** the test passes and fails against the old condition. **(F8)**
- [x] **T6.3** Fix invites and relocate the bulk handlers — `components/studio/hooks/useStudioActions.ts`, `components/Studio.tsx`, `components/studio/hooks/useStudioActions.test.ts` (new)
    - `handleCreateMembership` (~:1009): `'http://localhost'` → `window.location.origin`.
    - Move `handleBulkDeleteUsers` (`Studio.tsx:245-255`) and `handleBulkDeleteTeams` (`:258-268`) into `useStudioActions`, exporting both and reporting per-item failures through `notify.error` instead of `console.error`.
    - Test: `handleCreateMembership` passes `window.location.origin`; the literal `http://localhost` appears nowhere in the call.
    - **Done when:** `Studio.tsx` declares no SDK-calling handler. **(F9, F24)**
- [x] **T6.4** Refresh the snapshot list after delete/restore — `components/studio/hooks/useStudioActions.ts`, `components/studio/tabs/BackupsTab.tsx`, `components/Studio.tsx`
    - Thread an `onBackupsChanged` callback from `BackupsTab`'s `fetchBackups` up through `Studio.tsx` into `handleDeleteBackup` / `handleRestoreBackup` (~:1203-1219), in addition to the existing `refreshData()`.
    - **Done when:** deleting a snapshot removes it from the rendered list without a manual reload. **(F10)**
- [x] **T6.5** Make the migration resume button resume — `components/studio/tabs/MigrationsTab.tsx`
    - Remove the unused `resume` parameter from `handleScan` (~:115); change the config-step "Resume from Checkpoint" button (~:337-343) to call ~~`handleExecute(true)`~~ a new `handleResumeFromConfig()`.
    - **Done when:** no function in the file takes a parameter it never reads, and the config-step resume button reaches `service.startMigration(plan, true)`. **(F11)**
    - *Revised 2026-07-30: calling `handleExecute(true)` from the **config** step would still have been a no-op — it opens with `if (!plan) return`, and `plan` is null until a scan has run. The checkpoint stores migration progress, not the plan, so the button now scans first and then executes with `resume=true` (`handleResumeFromConfig`). `handleExecute` gained an optional `planOverride` so it need not wait for the `setPlan` state update. The preview-step button at ~:459 is unchanged — `plan` is already built there.*
- [x] **T6.6** Refresh lists after a document transfer — `components/studio/tabs/DatabasesTab.tsx`
    - Fill the two empty `TransferDocumentsModal.onSuccess` bodies (~:276-278, ~:550-554) so they refresh `collectionsPagination` / `documentsPagination`, matching the first mount site.
    - **Done when:** no `onSuccess` in the file has a comment-only body. **(F12)**
- [x] **T6.7** Remove dead props and add the missing scopes — `components/studio/tabs/FunctionsTab.tsx`, `components/studio/tabs/ProjectSettingsTab.tsx`, `components/Studio.tsx`, `components/AgentApp.tsx`
    - `FunctionsTab`: delete `onRedeployAll` (~:35), `onRedeploy` (~:38) and the two buttons they gate (~:116-123, ~:200-207).
    - `ProjectSettingsTab`: add `'sites.read'`, `'sites.write'` to `ALL_SCOPES` (~:13-33). Leave the other entries alone (*Plan › Open Questions*).
    - `Studio`/`AgentApp`: remove the unused `activeTools` prop (`Studio.tsx:49,55`; `AgentApp.tsx:351`).
    - **Done when:** `npx tsc --noEmit` clean and `sites.write` is in the scope list. **(F13, F14, F23)**
- [x] **T6.8** Correct the realtime listener's name and type — `hooks/useRealtime.ts`, `components/AgentApp.tsx`, `components/Studio.tsx`
    - Rename `useEventListener` → `addEventListener` in `UseRealtimeReturn` (~:29) and the implementation (~:106-111); return type becomes `() => void`. Update both call sites (`AgentApp.tsx:169`, `Studio.tsx:81`).
    - **Done when:** `npx tsc --noEmit` is clean *and* both `useEffect`s return a genuinely typed destructor. **(F16)**
- [x] **T6.9** Collapse the three query builders into one — `components/studio/hooks/useStudioData.ts`, `components/studio/hooks/usePaginatedQuery.ts`
    - Delete `buildQueries` (~:30-60) and `buildQueriesWithClientSearch` (~:66-89); import `parseQueryArray` from `usePaginatedQuery` and map its `appwriteQueries` to `Query.*` in one shared local helper. All 11 fetch factories keep their current server-side `Query.search` behaviour.
    - **Done when:** exactly one query-parsing function exists across the two files, and `parseQueryArray` has a consumer. **(F18)**
- [x] **T6.10** Stop double-fetching collections on studio routes — `hooks/useAppContext.ts`, `components/AgentApp.tsx`
    - Add an `isAgentRoute: boolean` parameter; skip `selectedDatabase` resolution and the collections `useEffect` (~:166-201) when false. Call site: `AgentApp.tsx:164`.
    - **Done when:** navigating to a studio database drill-down issues one `listCollections` call path (`useStudioData`), not two. **(F19)**
- [x] **T6.11** Sweep the dead code — delete `components/ExecutionLog.tsx`, `components/ProjectContextSelector.tsx`; edit `components/Icons.tsx`, `services/realtimeService.ts`, `services/projectAdminService.ts`, `components/studio/hooks/useStudioActions.ts`, `components/Studio.tsx`, `components/studio/tabs/{ErdTab,OverviewTab,DatabasesTab}.tsx`
    - Full list in *Plan › Changes by File* under F15 and F26: unused icon exports + their `react-icons` imports, `getEventAction`, `updateGlobalVariable`, `updateAuthProvider`, six unused imports and three unused destructures in `useStudioActions.ts`, and the eight pointless dynamic `import('…/services/…')` calls replaced by static imports.
    - **Done when:** `npx tsc --noEmit` clean and `npm run build` emits **no** `vite:reporter` "dynamically imported … but also statically imported" warning. **(F15, F26)**
    - *Revised 2026-07-30: `projectAdminService.updateGlobalVariable` is **not** dead — `tools/projectAdminTools.ts:107` calls it, and removing it broke the typecheck (`TS2551`). It has been kept. `updateAuthProvider` and `realtimeService.getEventAction` were genuinely unreferenced and are gone. Also removed here: `DatabasesTab`'s dynamic `databaseToolsService` import, which the plan listed under F26 but not in this task's text, and a **fourth** pointless dynamic import the plan's F26 inventory missed — `tools/databaseTools.ts:511` `await import('../services/databaseToolsService')` — which kept the `vite:reporter` warning alive after the other three were fixed. With it static, the build emits no static/dynamic-import warning at all.*
- [x] **T6.12** Bring `CONTEXT.md` back in line — `CONTEXT.md`
    - Update §3 (directory tree), §6 (the "Adding a New Studio Tab" SOP — now three steps: the `StudioTab` literal, the group in `services/studioNav.ts`, the icon+panel in `components/studio/navigation.tsx`), §9 (10 tool groups, not 5), §10 (`npm test`), §11 (the §8.1 URL map), and note in §2 that the `alert()` ban is enforced by `test/no-native-dialogs.test.ts`.
    - **Done when:** every path named in §3 exists and every path that exists under `services/`, `hooks/` and `tools/` is named. **(F21)**
- [x] **V6** Verify: `npx tsc --noEmit` → clean; `npx vitest run services/projectAdminService.test.ts components/LeftSidebar.test.tsx components/studio/hooks/useStudioActions.test.ts` → green.
- [x] **C6** Checkpoint.

---

## Finish

- [x] **G** Gate: `npm run typecheck && npm test && npm run build` → all exit 0.
    - Expected residual `vite build` output: the "chunks larger than 500 kB" warning only (out of scope, *Plan › §12*). The three `vite:reporter` static/dynamic-import warnings must be **gone** after T6.11.
- [x] **G2** Coverage re-read: walk *Plan › §13 Requirements Coverage* top to bottom and confirm every `N`/`F` row's Tasks cell is satisfied by a `[x]` task. Any row that is not becomes a `[!]` here with a one-line reason.
