# Tasks: Fill the app's remaining gaps

> **Plan:** ./implementation_plan.md
> **Status:** Complete
> **Current focus:** —
>
> **Wave plan:** all five phases run inline in document order (this session may not dispatch
> subagents). Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` dropped

## How to work this list (implementer)
- Mark a task `[~]` and set **Current focus** when you start it; `[x]` only once its **Done when** is met; `[!] — <reason>` if blocked. Keep both current in real time, so an interruption resumes cleanly.
- **V** = verify at the phase-check tier. The full gate runs at the finish (*Plan › Testing & Verification*).
- **C** = checkpoint: update this phase's statuses and **Current focus**, re-read the plan's guardrails plus the next phase's entries, scan remaining statuses, then continue without pausing. Re-read both files in full after a context compaction.
- Phases with disjoint *Writes* that don't *Need* each other may be built concurrently — the headers state this so you don't have to work it out. **Phases 2 and 4 are such a pair**; Phase 3's header explains its one soft dependency on Phase 2 and what changes if you start it early anyway.
- Verify in code only — commands, tests, scripts. No browser or computer-use tools; a criterion that seems to need eyes gets the assertion written for it instead.
- Assume other agents share this checkout: a modified file outside this plan's *Writes* is theirs — leave it alone, don't fix its failures, and stage only your own paths when committing.
- If reality diverges from the plan, update the plan and this list rather than silently improvising.
- **Do not touch the three Appwrite Function worker source templates** named in *Plan › §2 Non-Goals*. Their raw `fetch` calls are correct.

## Phase 1: The three shared pieces
*Ends with: `ListState`, `ErrorBanner` and the section-refresh registry exist, are unit-tested, and the registry is wired into `Studio.tsx` — with nothing registered yet, so behaviour is unchanged.*
*Writes: `components/studio/ui/ListState.tsx`, `components/studio/ui/ListState.test.tsx`, `components/ErrorBanner.tsx`, `components/studio/hooks/useSectionRefresh.tsx`, `components/studio/hooks/useSectionRefresh.test.tsx`, `components/Studio.tsx`*
*Needs: —*

- [x] **T1.1** Create the list-state component — `components/studio/ui/ListState.tsx` (new)
    - Props verbatim from *Plan › Changes by File › ListState.tsx*; branch order **loading → error → empty → `null`**.
    - Emits no table markup, no width/layout class, no `children`. Style after `HealthTab`'s scope-error panel and the existing empty rows.
    - **Done when:** it compiles and is importable; nothing consumes it yet.
- [x] **T1.2** Create the app-shell error banner — `components/ErrorBanner.tsx` (new)
    - Move the markup from `MainContent.tsx` :97–:107 verbatim; prop `{ message: string }`.
    - Doc comment states the split from `ListState` (*Plan › §6*). `MainContent` is **not** edited here — that is T4.1.
    - **Done when:** it compiles and renders the message; `MainContent` still renders its own copy.
- [x] **T1.3** Create the section-refresh registry — *also exports `useSectionRefreshStore`; see the plan's 2026-07-30 revision* — `components/studio/hooks/useSectionRefresh.tsx` (new)
    - Provider + `useRegisterSectionRefresh` + `useSectionRefreshRunner`, signatures in *Plan › Changes by File*.
    - Register on mount / withdraw on unmount; the runner `Promise.allSettled`s. Reading a hook outside the provider throws a named error, as `useToast` does.
    - **Done when:** compiles and is importable; T1.5 asserts its behaviour.
- [x] **T1.4** Wire the registry into the Studio and absorb the Backups escape hatch — `components/Studio.tsx`
    - Wrap the content area in `<SectionRefreshProvider>` so it encloses `<ActivePanel>`; `handleStudioRefresh` also awaits the runner.
    - Delete `backupsRefreshRef` and `registerBackupsRefresh`; `notifyBackupsChanged` becomes the runner (keep the name and keep passing it as `useStudioActions`' 7th argument).
    - Leave `sectionProps`' `onRegisterRefresh` entry in place for now — T2.10 removes it together with the prop.
    - Do NOT touch the deep-link effect, the keyboard handler, or the panel dispatch.
    - **Done when:** `npx tsc --noEmit` is clean and `StudioShell.test.tsx` still passes unchanged.
- [x] **T1.5** Test the two new primitives — `components/studio/ui/ListState.test.tsx` (new), `components/studio/hooks/useSectionRefresh.test.tsx` (new)
    - `ListState`: loading wins over empty; the error branch shows the message + Retry and **not** `No items found.`; Retry calls `onRetry` once; the empty branch shows `emptyMessage`; all-clear renders nothing.
    - `useSectionRefresh`: a registered callback runs when the runner fires, stops running after unmount, and either hook used outside the provider throws the named error.
    - **Done when:** `npx vitest run components/studio/ui/ListState.test.tsx components/studio/hooks/useSectionRefresh.test.tsx` is green.
- [x] **V1** Verify: `npx tsc --noEmit` clean; `npx vitest run components/studio/ui/ListState.test.tsx components/studio/hooks/useSectionRefresh.test.tsx components/studio/StudioShell.test.tsx` green. → **exit 0; 3 files, 36 tests passed.**
- [x] **C1** Checkpoint.

## Phase 2: The Studio's sections
*Ends with: every list in the Studio distinguishes loading / failed / empty, every section responds to Sync, and the tab-local dead ends are closed.*
*Writes: `components/studio/ui/ResourceTable.tsx`, `components/studio/tabs/UsersTab.tsx`, `components/studio/tabs/TeamsTab.tsx`, `components/studio/tabs/DatabasesTab.tsx`, `components/studio/tabs/StorageTab.tsx`, `components/studio/tabs/FunctionsTab.tsx`, `components/studio/tabs/SitesTab.tsx`, `components/studio/tabs/MessagingTab.tsx`, `components/studio/tabs/WebhooksTab.tsx`, `components/studio/tabs/ProjectSettingsTab.tsx`, `components/studio/tabs/HealthTab.tsx`, `components/studio/tabs/ErdTab.tsx`, `components/studio/tabs/MigrationsTab.tsx`, `components/studio/tabs/BackupsTab.tsx`, `components/Studio.tsx`, `components/studio/StudioShell.test.tsx`*
*Needs: Phase 1 (consumes `ListState` and the registry).*

- [x] **T2.1** Teach `ResourceTable` the three states — `components/studio/ui/ResourceTable.tsx`
    - Add the four optional props and route the `data.length === 0` branch through `<ListState>` (*Plan › Changes by File › ResourceTable.tsx*).
    - **Seen red first:** before wiring any call site, add the `ListState.test.tsx` case that renders `ResourceTable` with `error` set and asserts the message is shown and `No items found.` is not — confirm it fails against the pre-change component, then make it pass.
    - Behaviour with no new props must be identical to today.
    - **Done when:** that case goes red→green and `StudioShell.test.tsx` still passes.
- [x] **T2.2** Feed the six pagination-backed tables — `UsersTab.tsx` :54, `TeamsTab.tsx` :58 and :196, `DatabasesTab.tsx` :240 and :359, `StorageTab.tsx` :249
    - Pass `isLoading` / `error` / `onRetry={…refresh}` from the same pagination object that already feeds `PaginationFooter`. Add no fetch. Leave the non-paginated tables listed in *Plan › §3 call-site inventory* untouched.
    - **Done when:** type-checks clean; no other prop changed.
- [x] **T2.3** Feed the Functions tables and the Sites lists — `FunctionsTab.tsx` :219 and :318, `SitesTab.tsx` :156, :345, :465
    - Same for the two Functions tables. In `SitesTab` replace the three bare empty divs with `<ListState>`, keeping today's copy as `emptyMessage`; the sites list keeps its "Create Your First Site" action, so render `ListState` there only when `isLoading || error`.
    - **Done when:** type-checks clean.
- [x] **T2.4** Make "Change Email" reachable — `components/studio/tabs/UsersTab.tsx`
    - Add the button to `renderExtraActions` (:94) calling `onUpdateEmail?.(u)`, titled "Change Email", rendered only when the prop is present, mirroring the adjacent `onUpdateName` button.
    - **Done when:** a `StudioShell.test.tsx` render of the `users` section finds a control with that title.
- [x] **T2.5** Rework the Messaging tab — `components/studio/tabs/MessagingTab.tsx`
    - Drop the two `.catch(() => …)` swallows for an `error` state + `ListState` + retry; render `<TabShell>` unconditionally; `useRegisterSectionRefresh(loadMessagingData)`.
    - Add the read-only "Recent Campaigns" card (`listMessages`, `Query.limit(10)`, refreshed after a successful broadcast) per *Plan › Changes by File*.
    - Remove the unused `ExternalLinkIcon` import and the unused `response` assignment.
    - **Done when:** type-checks clean and the section's `StudioShell.test.tsx` marker is its title, not a loading string.
- [x] **T2.6** Rework the Webhooks tab — `components/studio/tabs/WebhooksTab.tsx`
    - Error state + `ListState` + retry; `<TabShell>` unconditional; `useRegisterSectionRefresh(loadWebhooks)`.
    - Add the custom-event input (trim, no blanks, no duplicates) with non-preset events shown as removable chips; show `enabled` and the masked `signatureKey` with a `CopyButton`.
    - Remove the unused `ExternalLinkIcon` import.
    - **Done when:** type-checks clean; a test render finds the custom-event input.
- [x] **T2.7** Rework the Project Settings tab — `components/studio/tabs/ProjectSettingsTab.tsx`
    - Replace the four `.catch()` swallows with one tab-level `error` state rendered through `ListState` in the three tables and the auth panel, `onRetry={loadSettings}`; `<TabShell>` unconditional; `useRegisterSectionRefresh(loadSettings)`.
    - Add the `CopyButton` on the API-key secret; render the fetched-but-hidden auth settings read-only (limit, duration, password history, password dictionary, enabled providers as chips).
    - Remove the unused `ExternalLinkIcon` import.
    - **Done when:** type-checks clean; a test render finds the session-limit value and a copy control in the keys table.
- [x] **T2.8** Register refresh for Health, ERD and Migrations — `HealthTab.tsx`, `ErdTab.tsx`, `MigrationsTab.tsx`
    - Health: `useRegisterSectionRefresh(runDiagnostics)`; move the loading branch inside `<TabShell>`; drop the unused `VerifiedIcon`/`ExternalLinkIcon`/`HealthStatus` imports; keep the scope-error panel as is.
    - ERD: extract the effect body into a `useCallback` `loadCollections`, give it an `error` state rendered by `ListState` in the diagram area, register it.
    - Migrations: register a callback that re-checks `hasCheckpoint`, no-op while `step === 'executing'`.
    - **Done when:** type-checks clean; Health's marker is its title.
- [x] **T2.9** Correct the messaging scopes list — `components/studio/tabs/ProjectSettingsTab.tsx`
    - Replace `messaging.read`/`messaging.write` in `ALL_SCOPES` with `providers.*`, `topics.*`, `subscribers.*`, `messages.*`, `targets.*` (read+write each) per *Plan › §12 Q1*.
    - **Done when:** `ALL_SCOPES` contains no `messaging.` entry and the list stays alphabetically grouped as it is today.
- [x] **T2.10** Rework the Backups tab — `components/studio/tabs/BackupsTab.tsx`, `components/Studio.tsx`
    - Delete the `onRegisterRefresh` prop and its wiring in `Studio.tsx`'s `sectionProps`; register through `useRegisterSectionRefresh(fetchBackups)`.
    - `fetchBackups` sets an `error` state; the `ResourceTable` gets `isLoading`/`error`/`onRetry`.
    - Replace both raw `fetch`es with `getSdkStorage(activeProject).createFile(...)` and `.getFileDownload(...)` (→ `Blob` → object URL → click → **revoke**); the download's `catch` reports through `toast.error`.
    - **Done when:** no `fetch(` and no `X-Appwrite-Key` remain in the file, and `npx tsc --noEmit` is clean.
- [x] **T2.11** Sweep the remaining pagination-backed table — `components/studio/tabs/BackupsTab.tsx` is done in T2.10; confirm no `<ResourceTable>` from *Plan › §3's inventory* was missed
    - Re-run the inventory search (`<ResourceTable` across `components/`) and check each of the 15 sites against the plan's Covered/Left-alone split.
    - **Done when:** the list is recorded in the checkpoint note and matches the plan, or the plan is corrected with a `Revised:` line.
- [x] **T2.12** Update the shell test's markers and add the Sync case — `components/studio/StudioShell.test.tsx`
    - Replace the four loading-string markers with the titles those tabs now paint immediately (this is a **stronger** assertion — do not weaken any case to get green).
    - Add: a probe registered via `useRegisterSectionRefresh` inside the Studio tree is invoked when `Shift+R` fires.
    - **Done when:** `npx vitest run components/studio/StudioShell.test.tsx` is green with all 14 section cases plus the new one.
- [x] **V2** Verify: `npx tsc --noEmit` clean; `npx vitest run components/studio/StudioShell.test.tsx components/studio/ui/ListState.test.tsx` green.
- [x] **C2** Checkpoint.

## Phase 3: Actions, tools and services
*Ends with: no browser code builds an Appwrite REST URL or holds an API key, every bulk operation reports why an item failed, and file preview works for a private bucket — with a guard test that would have caught all of it.*
*Writes: `test/no-raw-appwrite-fetch.test.ts`, `components/studio/hooks/useStudioActions.ts`, `components/studio/hooks/useStudioActions.test.ts`, `components/studio/ui/FilePreview.tsx`, `tools/storageTools.ts`, `services/migrationService.ts`*
*Needs: Phase 2 — only so the guard added in T3.1 is red for exactly the four sites this phase fixes. If Phase 2 has not landed, T3.1's red list additionally contains `BackupsTab.tsx`; that is expected and does not change this phase's work.*

- [x] **T3.1** Add the raw-REST guard, and see it red — `test/no-raw-appwrite-fetch.test.ts` (new)
    - Scan `.ts`/`.tsx` under `components/`, `hooks/`, `services/`, `tools/` for the literal `X-Appwrite-Key`, with an explicit allowlist of the three worker-template files (each entry commented with why). Mirror `test/no-native-dialogs.test.ts`, including a third case proving the detector is not vacuous.
    - **Done when:** run against the current tree it **fails**, listing exactly `components/studio/hooks/useStudioActions.ts`, `tools/storageTools.ts`, `services/migrationService.ts` (plus `components/studio/tabs/BackupsTab.tsx` if T2.10 has not landed) — and that list is recorded before any fix.
- [x] **T3.2** Route the Studio's upload and download through the SDK — `components/studio/hooks/useStudioActions.ts`
    - `handleUploadFile` → `getSdkStorage(activeProject).createFile(bucketId, ID.unique(), file)`; `handleDownloadFile` → `.getFileDownload(...)` → `Blob` → object URL → revoke.
    - Report per-file failures instead of `console.error`, and only call `notify.success` when nothing failed — same shape as the existing `handleBulkDeleteUsers`.
    - Drop `normalizeEndpoint` from the import if it becomes unused.
    - **Done when:** neither function references `fetch` or an endpoint string; `npx tsc --noEmit` clean.
- [x] **T3.3** Route the AI upload tool through the SDK — `tools/storageTools.ts`
    - `writeFile` → `getSdkStorage(context.project).createFile(finalBucketId, fileIdToUse, fileToUpload, permissions)`; delete the now-false "not browser-compatible" comment; keep `handleApiError` and the return shape.
    - **Done when:** no `fetch` remains in the file and the tool still returns the `Models.File` shape.
- [x] **T3.4** Route the migration's direct file copy through the SDK — `services/migrationService.ts`
    - `migrateFiles` (~:569) → `this.destStorage.createFile(targetBucketId, file.$id, fileObj, file.$permissions)`. Keep the surrounding `try/catch`, the cursor bookkeeping and the cloud-worker branch. **Do not touch the worker template at ~:351.**
    - **Done when:** the only `fetch` left in the file is inside the worker template string.
- [x] **T3.4b** Route the two function-deployment uploads through the SDK — `tools/functionsTools.ts`
    - *Added 2026-07-30 during the build: the plan's §3 inventory missed this seventh raw-REST site, and the T3.1 guard flags it. Both call sites now use `getSdkFunctions(...).createDeployment(...)`; the dead `appwriteFetch` helper is deleted.*
    - **Done when:** no `fetch` and no `X-Appwrite-Key` remain in the file. ✔
- [x] **T3.5** Make file preview work for a private bucket — `components/studio/ui/FilePreview.tsx` (new), `components/studio/hooks/useStudioActions.ts`
    - New component fetches bytes via `getSdkStorage(project).getFileView(...)`, renders an object URL (`<img>` for `image/*`, otherwise metadata + "Open in New Tab"), owns its loading/error state through `ListState`, and **revokes the URL on unmount**.
    - `handlePreviewFile` opens it through `openCustomModal(file.name, <FilePreview …/>, '3xl')`; the hand-built preview/view URLs are deleted.
    - **Done when:** no `?project=` URL remains in `useStudioActions.ts`, and a unit render of `FilePreview` with a stubbed SDK calls `getFileView` and revokes on unmount.
- [x] **T3.6** Report per-item failures in the four remaining bulk operations — `components/studio/hooks/useStudioActions.ts`
    - `handleBulkUpdateDocuments`, `handleBulkDeleteDocuments`, `handleBulkDeleteBuckets`, `handleBulkDeleteFiles`: collect failure messages and report through `notify`, replacing each `console.error`.
    - **Done when:** no `console.error` remains in the file.
- [x] **T3.7** Extend the actions test — `components/studio/hooks/useStudioActions.test.ts`
    - Add: a rejecting bulk operation surfaces its message through the toast layer; upload/download call the SDK stub's `createFile`/`getFileDownload` and never call global `fetch`.
    - **Done when:** `npx vitest run components/studio/hooks/useStudioActions.test.ts` green.
- [x] **V3** Verify: `npx tsc --noEmit` clean; `npx vitest run components/studio/hooks/useStudioActions.test.ts test/no-raw-appwrite-fetch.test.ts` green — the guard that was red in T3.1 now passes.
- [x] **C3** Checkpoint.

## Phase 4: The app shell
*Ends with: connection and project errors are visible in both views, no settings save fails silently, and no component imports `react-icons` directly.*
*Writes: `components/AgentApp.tsx`, `components/MainContent.tsx`, `components/LeftSidebar.tsx`, `components/LeftSidebar.test.tsx`, `components/studio/ui/ToolConfiguration.tsx`, `components/Header.tsx`*
*Needs: Phase 1 (consumes `ErrorBanner`). Disjoint from Phases 2 and 3 — may run alongside them.*

- [x] **T4.1** Show the error in both views — `components/AgentApp.tsx`, `components/MainContent.tsx`
    - Render `<ErrorBanner message={error} />` under `<Header>`, above the `viewMode` branch; remove `MainContent`'s `error` prop and its inline banner.
    - **Done when:** `MainContentProps` no longer has `error`, `npx tsc --noEmit` is clean, and the banner markup exists in exactly one place.
- [x] **T4.2** Stop the "No Project Selected" flash — `components/AgentApp.tsx`
    - Destructure `isLoading` from `useProjects` and render a spinner in the Studio branch's `!activeProject` case while it is true.
    - **Done when:** the empty state is unreachable while projects are loading (assert via the `isLoading` branch in a render test or by inspection of the single condition — no new fetch).
- [x] **T4.3** Delete the dead composite setter — `components/AgentApp.tsx`
    - Remove `setError` and any `setXError` destructures it alone justified.
    - **Done when:** `setError` appears nowhere in the file and `npx tsc --noEmit` is clean.
- [x] **T4.4** Report a failed Gemini-settings save — `components/LeftSidebar.tsx`
    - Wrap the `await onSaveGeminiSettings(...)` in `try/catch` and report via `useToast().error(...)`.
    - **Done when:** the new `LeftSidebar.test.tsx` case (T4.7) passes.
- [x] **T4.5** Report a failed tool-preference save and stabilise the ids — `components/studio/ui/ToolConfiguration.tsx`
    - Route all five `onToolsChange(...)` call sites through one local helper that catches and toasts; replace the `Math.random()` id with `React.useId()`.
    - **Done when:** no `Math.random()` remains in the file and no `onToolsChange` call is unguarded.
- [x] **T4.6** Use the icon wrapper — `components/Header.tsx`, `components/MainContent.tsx`
    - Replace the direct `react-icons/ri` imports with `BotIcon` from `./Icons` at both use sites in `Header.tsx` and the one in `MainContent.tsx`.
    - **Done when:** neither file imports from `react-icons` and the rendered icon is unchanged.
- [x] **T4.7** Extend the sidebar test — `components/LeftSidebar.test.tsx`
    - Add: a rejecting `onSaveGeminiSettings` puts its message in the document and produces no unhandled rejection. **Seen red first** against the pre-T4.4 handler.
    - **Done when:** the case goes red→green and `npx vitest run components/LeftSidebar.test.tsx` is green.
- [x] **V4** Verify: `npx tsc --noEmit` clean; `npx vitest run components/LeftSidebar.test.tsx` green.
- [x] **C4** Checkpoint.

## Phase 5: Documentation and the gate
*Ends with: `CONTEXT.md` describes the new owners and rules, and the full gate is green.*
*Writes: `CONTEXT.md`*
*Needs: Phases 2, 3 and 4 (this is the join of the concurrent lanes).*

- [x] **T5.1** Update the project context — `CONTEXT.md`
    - §2 forbidden table: hand-built Appwrite REST `fetch` in browser code → use the `getSdk*` factories, enforced by `test/no-raw-appwrite-fetch.test.ts`.
    - §3 tree: add `ListState.tsx`, `FilePreview.tsx`, `ErrorBanner.tsx`, `useSectionRefresh.tsx`, `test/no-raw-appwrite-fetch.test.ts`.
    - §6 "Adding a New Studio Section": a section that loads its own data calls `useRegisterSectionRefresh` and renders `ListState` — never a full-page spinner.
    - **Done when:** each of the three edits is present and the file's existing structure is otherwise unchanged.
- [x] **T5.2** Disposition the coverage matrix — *Plan › §7*
    - Walk all 30 rows against the actual diff (not against these checkboxes); a Covered row with no working implementation means the build is not done.
    - **Done when:** every row is verified in the source, or the plan carries a `Revised:` line saying what changed.
- [x] **V5** Gate: `npm run typecheck && npm test && npm run build` → typecheck clean, all tests pass, build succeeds with **only** the pre-existing ">500 kB chunk" warning.
- [x] **C5** Checkpoint.
