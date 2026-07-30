# Implementation Plan — Fill the app's remaining gaps

> **Status:** Complete
> **Type:** Multi-defect sweep / quality pass (+ bug fix)
> **Baseline:** `main` @ `922e2c1`
> **Date:** 2026-07-30
> **Related:** `.plans/2026-07-30-studio-nav-consolidation/` (the nav consolidation this continues; its
> *Follow-ups* list is dispositioned in §12 below)
>
> **Revised:** 2026-07-30 — **§3's raw-transfer inventory was incomplete: it missed a seventh site.**
> `tools/functionsTools.ts` had a private `appwriteFetch()` helper (URL building + `X-Appwrite-Key`)
> backing two function-deployment uploads (~:110, ~:431). The guard T3.1 specifies flags it, and R11
> ("no browser code builds an Appwrite REST URL") cannot hold while it stands, so both call sites now
> use `getSdkFunctions(project).createDeployment(functionId, file, activate, entrypoint, commands)` —
> browser-safe via the same `chunkedUpload` path as `createFile` — and the dead helper is removed.
> Same approach, one more file; recorded as task **T3.4b**.
>
> **Revised:** 2026-07-30 — added `components/studio/ui/FilePreview.test.tsx`. T3.5's Done-when
> requires asserting `getFileView` is called and the object URL is revoked on unmount; that is a
> component render, and `useStudioActions.test.ts` is a `.ts` file with no DOM harness.
>
> **Revised:** 2026-07-30 — `useSectionRefresh.tsx` additionally exports `useSectionRefreshStore()`
> and `SectionRefreshProvider` takes an optional `store` prop. `Studio` *renders* the provider, so it
> cannot read the context it supplies, yet it needs `runAll` for the Sync button and the `Shift+R`
> handler. It creates the store and passes it down. Both hook signatures in §6 are unchanged.

---

## 1. Summary

A read of every screen in the app found **30 gaps** — places where the UI lies, swallows a failure,
offers a control that does nothing, or fetches data it never shows. They are not thirty unrelated
bugs; they cluster into **five concepts that no module owns**:

| # | Nobody owns… | Sites |
|---|---|---|
| A | how a resource list reports **loading and failure** | 11 paginated lists + 7 swallowed `catch`es |
| B | what "**refresh this section**" means | 6 of 14 sections ignore Sync / Shift+R |
| C | how the browser **transfers a file** to Appwrite | 6 hand-built `fetch` calls, 3 endpoint styles |
| D | where a **failed user action** is reported | 9 sites that bypass the toast owner |
| E | — (dead ends: wired but unreachable, fetched but unrendered) | 7 one-off defects |

The plan creates **three small owners** (a list-state component, an error banner, a section-refresh
registry), routes the file transfers through the **SDK factory owner that already exists**
(`services/appwrite.ts` — `node-appwrite@17`'s `createFile`/`getFileDownload` are browser-safe, so
the six raw `fetch`es are unnecessary, not unavoidable), routes the stray failures through the
**toast owner that already exists**, and then fixes the seven isolated dead ends directly.

No new dependency, no new pattern, no architectural change. Roughly 25 files touched, 3 new
components, 1 new hook.

## 2. Goals / Non-Goals

**Goals**
- Every resource list distinguishes *loading*, *failed* and *empty* — and offers a retry when it failed.
- Every Studio section responds to the Sync button and `Shift+R`.
- No browser code hand-builds an Appwrite REST URL or attaches an API key header.
- Every failed action reaches the user through `useToast()`; nothing fails only into `console`.
- Every control that is wired is reachable; every value that is fetched is shown or not fetched.
- The gate stays green: `npm run typecheck && npm test && npm run build`.

**Non-Goals** — explicitly *not* in this plan:
- **Bundle splitting.** The 1.33 MB chunk warning stays. That is its own plan.
- **Enabling TypeScript `strict` / `noUnusedLocals`.** `tsconfig.json` is untouched (see §11 R28).
- **New Appwrite surfaces the app does not already have:** user detail pages, membership role
  editing, messaging-provider CRUD, function/site deployment upload from the Studio, webhook editing.
- **`services/backupService.ts`'s restore path** — already owned by `.plans/2026-07-21-ops-orchestrator/` §13.
- **The three Appwrite Function *worker source templates*** (`services/backupService.ts` ~:207,
  `services/migrationService.ts` ~:351, `components/studio/ConsolidateBucketsModal.tsx` ~:172). Their
  raw `fetch` calls run **server-side inside a deployed Appwrite Function**, where our services are not
  importable. They are correct as written. **Do not "fix" them.**
- Any change to the group/section navigation structure landed by the previous plan.

## 3. Current State & Research

Commands (from `package.json`, run at the repo root): `npm run dev` · `npm run build` ·
`npm run preview` · `npm run typecheck` (`tsc --noEmit`) · `npm test` (`vitest run`, jsdom,
`test/setup.ts`, env injected by `vite.config.ts`'s `test.env` block).

**Known pre-existing state at `922e2c1`:** `npm test` → 149 passing across 11 files; `npm run build`
emits exactly one warning (">500 kB chunk"), which is a Non-Goal. No failing tests.

### The evidence, by concept

**A — list state.** `components/studio/hooks/usePaginatedQuery.ts` maintains `error: string | null`
(set at :177) and exposes it on `PaginatedState`. **Zero consumers read it** (verified by search across
`components/`). `components/studio/ui/ResourceTable.tsx` :113 renders the literal `No items found.`
whenever `data.length === 0` — during the first fetch and after a failure alike. Separately, four
self-loading tabs turn a failure into an empty list:

| File | Site | What the user sees on a 401 |
|---|---|---|
| `tabs/MessagingTab.tsx` | :48, :49 `.catch(() => ({providers: []}))` | "No third-party messaging providers configured." |
| `tabs/WebhooksTab.tsx` | :45 `.catch(() => [])` | "No webhooks registered." |
| `tabs/ProjectSettingsTab.tsx` | :69–:72 (×4) | "No administrative API keys listed." etc. |
| `tabs/BackupsTab.tsx` | :55 `catch { setBackups([]) }` | An empty snapshot table; its `isLoading` (:29) is never rendered |

Those same four tabs also `return` a bare centred spinner **outside** `<TabShell>` while loading, so
the page title and Console link vanish and reappear. `tabs/HealthTab.tsx` is the one panel that gets
this right (a dedicated scope-error state, :119) — its shape is the model to generalise.

**B — section refresh.** `useStudioData.refreshCurrentView()` (:525) is a `switch (activeTab)` with
cases for `overview · database · storage · functions · users · teams · sites` — **7 of 14**. The Sync
button in `StudioNavBar` and the `Shift+R` shortcut both call `Studio.handleStudioRefresh`, which calls
`refreshData()` (project-level DBs/buckets/functions) plus `refreshCurrentView()`. On `erd`,
`messaging`, `webhooks`, `health`, `migrations` and `project-settings` the section's own data is never
re-fetched. `BackupsTab` already invented a one-off escape hatch for exactly this — an
`onRegisterRefresh` prop (:23) that `Studio.tsx` stores in `backupsRefreshRef` (:93). That prop is the
missing owner, in single-use form.

**C — file transfer.** `node-appwrite@17.2`'s `Storage.createFile(bucketId, fileId, file: File, permissions?)`
runs `Client.chunkedUpload` → `prepareRequest`, which builds a **`FormData` with the Web `File` API and
calls `fetch`** (verified in `node_modules/node-appwrite/dist/client.mjs` :182–:254). It is fully
browser-compatible and chunks files over 5 MB, which the hand-written single-POST path does not.
`Storage.getFileDownload`/`getFileView` return an `ArrayBuffer` via `call(..., 'arrayBuffer')`. The six
browser-side raw calls are therefore all replaceable:

| Site | Endpoint handling | Note |
|---|---|---|
| `hooks/useStudioActions.ts` ~:636 upload | `normalizeEndpoint` | no chunking → large files fail |
| `hooks/useStudioActions.ts` ~:665 download | `normalizeEndpoint` | — |
| `tabs/BackupsTab.tsx` ~:135 upload | **raw `activeProject.endpoint`** | breaks on a trailing slash |
| `tabs/BackupsTab.tsx` ~:162 download | **raw `activeProject.endpoint`** | failure is `console.error` only (:175) |
| `tools/storageTools.ts` ~:170 upload | **raw `context.project.endpoint`** | comment claims the SDK "isn't browser-compatible" — false for v17 |
| `services/migrationService.ts` ~:569 upload | `.trim().replace(/\/+$/,'')` | `this.destStorage` is already in scope |

Related: `useStudioActions.handlePreviewFile` (~:687) builds `…/preview?project=<id>` **with no API
key**, so previewing a file in a non-public bucket renders a broken image and the "Open in New Tab"
link 401s.

**D — failure reporting.** The owner exists (`hooks/useToast.tsx`, mounted app-wide by the previous
plan). These sites bypass it:

- `components/LeftSidebar.tsx` :178 `await onSaveGeminiSettings(...)` — `useSettings.handleSaveGeminiSettings`
  **rethrows** (~:49); nothing catches → unhandled rejection, user sees nothing.
- `components/studio/ui/ToolConfiguration.tsx` :54/:62/:69/:103/:153 — same, via `onToolsChange`
  (`useSettings.handleToolsChange` rethrows, ~:61).
- `hooks/useStudioActions.ts` :278, :309, :652, :733, :761 — five bulk operations `console.error` each
  per-item failure and then report `notify.success("… N succeeded, M failed")`; the *reason* is lost.
  (`handleBulkDeleteUsers`/`handleBulkDeleteTeams` already do this correctly — that is the pattern.)
- `hooks/useProjects.ts` sets `error` on load/save/update/delete failure; `AgentApp` passes it to
  `MainContent`, which renders it **only in Agent view** (`MainContent.tsx` :97). In Studio view a
  bad API key or a failed project save is invisible. The same is true of `useAppContext`'s
  `contextError` — the "Connection Failed / likely CORS" message from `handleFetchError`.

**E — dead ends.**

| Symptom | Evidence |
|---|---|
| "Change Email" unreachable | `handleUpdateUserEmail` exists (`useStudioActions` :952), is wired (`Studio.tsx` :399), is declared (`UsersTab` :23) — and no element calls it. |
| A new API key's secret can't be copied | `ProjectSettingsTab` :409 renders `secret.slice(0,10)…slice(-6)` with no `CopyButton`. |
| Webhooks limited to 11 events | `WebhooksTab.COMMON_EVENTS` (:14) is the only input; no free-text event; `signatureKey`/`enabled` exist on the `Webhook` type (`types.ts` :192) and are never shown. |
| Auth settings fetched, never shown | `AuthSettings` carries `authLimit`, `authDuration`, `authPasswordHistory`, `authPasswordDictionary`, `authProviders` (`projectAdminService.ts` :143); the tab renders only `authMethods`. |
| A broadcast has no outcome | `MessagingTab.handleSendBroadcast` queues a campaign and discards the response (:178); nothing ever lists messages. `Messaging.listMessages(queries?, search?)` exists in the SDK. |
| "No Project Selected" flashes on load | `useProjects` returns `isLoading` (:139); `AgentApp` :80 does not destructure it, so the Studio's empty state renders before projects resolve. |
| Dead composite setter | `AgentApp.setError` (:216) fans one message into four error states and is never called. |

**F — conventions.** `components/Header.tsx` :7 and `components/MainContent.tsx` :4 import
`RiRobot2Line` from `react-icons/ri` directly, though `components/Icons.tsx` :22 already exports
`BotIcon` wrapping that exact icon (contra `CONTEXT.md` §6). `ToolConfiguration`'s `ToolToggle` (:20)
builds its `id` from `Math.random()` on every render. Four tabs carry unused imports.

### Verified call-site inventories

- **`<ResourceTable>`** — 15 usages. **Nine are pagination-backed** and gain the new props:
  `UsersTab` :54 · `TeamsTab` :58, :196 · `DatabasesTab` :240, :359 · `StorageTab` :249 ·
  `FunctionsTab` :219, :318 · `BackupsTab` :252 (local state, not a pagination object).
  **Six are not** and are left alone (they render arrays that `useAppContext`/`useStudioData` load in
  full, whose failure surfaces through the new `ErrorBanner`): `DatabasesTab` :141, :443, :513 ·
  `StorageTab` :118 · `FunctionsTab` :102, :366.
- **`SitesTab`** renders three hand-rolled lists (sites :156, deployments :345, logs :465) that need
  `ListState` directly.
- **`MainContent`'s `error` prop** — one consumer: `AgentApp` :313.
- **`BackupsTab.onRegisterRefresh`** — one producer: `Studio.tsx` :94/:426.
- **`STUDIO_SECTION_UI` panel props** — every change to a tab's props must also change the matching
  entry in `Studio.tsx`'s `sectionProps` map (:296), which is typed `Record<StudioTab, …>`.
- **`components/studio/StudioShell.test.tsx`'s `SECTION_MARKERS`** (:69) asserts the *first-paint text*
  of each of the 14 panels. Four of those markers are today's loading strings
  (`'Loading Messaging interface...'`, `'Loading Webhook configurations...'`,
  `'Executing system diagnostic audit...'`, `'Loading Project settings plane...'`). Making those tabs
  render their `TabShell` while loading **will** break the test until the markers are updated to the
  tab titles. This is expected, and is a task.

## 3a. Roots, not symptoms

| Symptom | Where a patch would stop | Root — the owner that replaces it |
|---|---|---|
| A failed list renders "No items found." in 11 places; 7 `catch`es turn a 401 into an empty state | Add an `if (error)` branch to each list | **No owner for "what a list looks like when it isn't a list."** One `ListState` (loading / failed+retry / empty) is the only thing any list may render in place of rows; `ResourceTable` takes `isLoading`/`error`/`onRetry` and the four self-loading tabs feed it their own state |
| Four tabs hide the page frame behind a full-page spinner | Wrap each spinner in `<TabShell>` | Same owner: with `ListState` inside the body, the loading branch stops being a whole-page `return` |
| Sync and `Shift+R` do nothing on 6 sections; `BackupsTab` has a private `onRegisterRefresh` prop | Add 6 cases to `refreshCurrentView`'s switch | **No owner for "refresh the current section."** A `SectionRefreshProvider` + `useRegisterSectionRefresh()`; any self-loading panel registers its own re-fetch, `Studio.handleStudioRefresh` runs them. `BackupsTab`'s prop is **absorbed**, not paralleled |
| Six raw `fetch`es upload/download files, with three different endpoint spellings, one of them holding the API key inside a UI component | Add `normalizeEndpoint` to the three that lack it | **The owner already exists and is bypassed.** `services/appwrite.ts`'s SDK factories: `getSdkStorage(project).createFile / getFileDownload / getFileView`. Routing through them deletes the URLs, the headers and the divergence by construction, and adds chunked upload for free. Enforced by a guard test that bans `X-Appwrite-Key` outside the three worker-template files |
| A file preview in a private bucket is a broken image | Append the key to the query string (leaks it into the DOM) | Same owner: fetch the bytes through the SDK and render an object URL (`FilePreview`) |
| Nine sites report failure to nobody — two of them as unhandled rejections | Wrap each in `try/catch` | **The owner already exists and is bypassed.** Route them through `useToast()`; for the two project-level error states (`useProjects`, `useAppContext`) extract `MainContent`'s existing banner markup into `ErrorBanner` and render it once in `AgentApp`, above **both** views |
| Four tabs carry unused imports | Delete them | **Patch, and stated as one.** The type-level owner would be `noUnusedLocals` in `tsconfig.json`, but its blast radius across 26 k lines is unbounded and unmeasured, and the plan will not promise a number it has not counted. Deleting the four is a two-minute correctness win; enabling the flag is a follow-up (§12) |
| Seven one-off dead ends (E) | — | **Genuinely isolated.** Each is one control or one render in one file, with no sibling instances found. They get direct fixes, deliberately |

## 4. Architecture & Conventions to Follow

- **Layering:** UI never calls the Appwrite SDK/REST directly — it goes through `services/` or `tools/`
  (`CONTEXT.md` §2). `getSdkStorage(project)` etc. are the only sanctioned clients; `Client` is never
  constructed outside `services/appwrite.ts`.
- **Dialogs:** `alert`/`confirm`/`prompt` are banned and enforced by `test/no-native-dialogs.test.ts`.
  Messages → `useToast()`; confirmations → `useConfirm()`. Mirror `tabs/WebhooksTab.tsx`.
- **Icons:** always via `components/Icons.tsx`; never `import … from 'react-icons/*'` in a component.
- **Studio page frame:** every section's content is wrapped in `<TabShell>`, which owns the title,
  subtitle, action slot and Console link and declares **no** width/scroll classes (`Studio.tsx` owns
  `max-w-6xl mx-auto`). Mirror `tabs/UsersTab.tsx`.
- **Pagination:** list data comes from `usePaginatedQuery`; the tab passes the same state object to
  `PaginationFooter` and (new) to `ResourceTable`. Never re-implement paging.
- **Studio sections:** the two-file registration (`services/studioNav.ts` + `components/studio/navigation.tsx`)
  is unchanged by this plan. A tab's props must stay in sync with `Studio.tsx`'s `sectionProps` map.
- **Tests:** co-located `<name>.test.tsx` next to the file under test; cross-cutting guards under
  `test/`. Mirror `components/studio/StudioShell.test.tsx` for component tests (mock only the SDK
  factories via `vi.mock('../../services/appwrite', …)`, keep the module's pure helpers real) and
  `test/no-native-dialogs.test.ts` for source-scanning guards.
- **Do NOT** introduce a state manager, a CSS system, a `fetch` wrapper, or a second toast/confirm
  surface. **Do NOT** touch `tsconfig.json`, `config.ts`, `services/geminiService.ts`, `tools/index.ts`,
  or the nav registry.

## 5. Proposed Approach

1. **Build the three shared pieces first** (Phase 1) so nothing is written twice: `ListState`,
   `ErrorBanner`, and the section-refresh registry (wired into `Studio.tsx`, with nothing registered
   yet — a no-op until Phase 2 populates it).
2. **Sweep the Studio's sections** (Phase 2): `ResourceTable` learns the three states; the nine
   pagination-backed tables and `SitesTab`'s three lists feed it; the five self-loading tabs keep their
   own `error` state, register their refresh, and stop hiding `TabShell`. The tab-local dead ends (E)
   land in the same files, in the same pass.
3. **Sweep the action and service layer** (Phase 3): the four remaining raw `fetch`es become SDK calls,
   guarded by a test written *first*; the five bulk operations report per-item failures; the file
   preview stops relying on public buckets.
4. **Sweep the app shell** (Phase 4, independent of 2 and 3): the connection/project error becomes
   visible in both views, the two unhandled rejections become toasts, the loading flash and the dead
   setter go, and the two direct `react-icons` imports are corrected.
5. **Document and gate** (Phase 5).

## 6. Changes by File

### Create

- **`components/studio/ui/ListState.tsx`** — *the only thing a resource list may render in place of
  rows.* Replaces the ad-hoc "No items found." row, the four full-page spinners and the invisible
  `pagination.error`. Emits **no table markup** (callers wrap it in `<tr><td colSpan>` where needed).
  ```ts
  export interface ListStateProps {
      isLoading: boolean;
      error?: string | null;
      isEmpty: boolean;
      /** Shown when there is no data and no failure. Default: 'No items found.' */
      emptyMessage?: string;
      /** Shown beside the spinner. Default: 'Loading…' */
      loadingMessage?: string;
      /** When given, the failed state offers a Retry button that calls this. */
      onRetry?: () => void;
  }
  ```
  Branch order is **loading → error → empty → `null`** (a refresh must show progress, not the stale
  error). The failed state shows `WarningIcon`, the message, and — only with `onRetry` — a "Retry"
  button. Styling mirrors `HealthTab`'s scope-error panel (:126) and the existing empty rows.
  Do NOT give it a `children` slot, a title, or any layout/width class.

- **`components/studio/ui/ListState.test.tsx`** — the three branches, precedence, and that Retry calls
  `onRetry` exactly once.

- **`components/studio/hooks/useSectionRefresh.test.tsx`** — a registered callback runs when the runner
  fires, stops running after unmount, and using either hook outside the provider throws the named error.

- **`components/ErrorBanner.tsx`** — *the app-shell error banner.* The markup currently inlined in
  `MainContent.tsx` :97–:107, extracted verbatim so it can be rendered above **both** views.
  `{ message: string }`. Distinct from `ListState` by scope, and stated as such in its doc comment:
  `ListState` is a *list's* substitute content; `ErrorBanner` is the *project connection*'s status.

- **`components/studio/hooks/useSectionRefresh.tsx`** — *the owner of "refresh the current section."*
  Absorbs `BackupsTab`'s `onRegisterRefresh` prop.
  ```ts
  export const SectionRefreshProvider: React.FC<{ children: React.ReactNode }>;
  /** Registers `refresh` while the calling component is mounted. Must be stable (useCallback). */
  export function useRegisterSectionRefresh(refresh: () => void | Promise<void>): void;
  /** Runs every registered refresher; resolves when all settle. */
  export function useSectionRefreshRunner(): () => Promise<void>;
  ```
  Implementation notes: a `Set` in a ref inside the provider; `useRegisterSectionRefresh` adds on mount
  and removes on unmount; the runner `Promise.allSettled`s them. Reading either hook outside the
  provider throws a named error, exactly as `useToast` does.

- **`components/studio/ui/FilePreview.tsx`** — fetches a file's bytes through
  `getSdkStorage(project).getFileView(bucketId, fileId)`, renders an object URL (an `<img>` for
  `image/*`, otherwise the metadata plus an "Open in New Tab" link), and **revokes the URL on unmount**.
  Owns its own loading/error state via `ListState`. Replaces the unauthenticated URL built in
  `useStudioActions.handlePreviewFile`.

- **`test/no-raw-appwrite-fetch.test.ts`** — cross-cutting guard. Scans every `.ts`/`.tsx` file under
  `components/`, `hooks/`, `services/`, `tools/` for the literal `X-Appwrite-Key`, with an **explicit
  allowlist of the three worker-template files** named in §2's Non-Goals (the allowlist entries carry a
  comment saying why). Fails with the offending file:line list. Mirror `test/no-native-dialogs.test.ts`'s
  structure, including a third case proving the detector is not vacuous.

### Modify — shared UI

- **`components/studio/ui/ResourceTable.tsx`** — teach it the three states.
  - New optional props: `isLoading?: boolean`, `error?: string | null`, `onRetry?: () => void`,
    `emptyMessage?: string`.
  - Target: the `data.length === 0` branch (~:113). It now renders
    `<tr><td colSpan={…}><ListState …/></td></tr>` whenever `isLoading || error || data.length === 0`.
  - Do NOT change the column layout, the selection logic, `hasActions`, or the `footer` slot.
  - Behaviour with none of the new props passed must be **identical to today** (empty → "No items found.").

- **`components/Studio.tsx`** —
  - Wrap the content area in `<SectionRefreshProvider>` (it must enclose `<ActivePanel>`; the nav bar
    may sit inside or outside).
  - `handleStudioRefresh` additionally awaits `useSectionRefreshRunner()`'s result.
  - Delete `backupsRefreshRef`, `registerBackupsRefresh` and `notifyBackupsChanged`'s ref plumbing;
    `notifyBackupsChanged` becomes the runner (keep the name and keep passing it as
    `useStudioActions`' 7th argument — its signature does not change).
  - Remove `onRegisterRefresh` from the `'backups'` entry of `sectionProps` (Phase 2, with the prop).
  - Do NOT change the deep-link effect, the keyboard handler, or the `sectionProps`/`ActivePanel` dispatch.

### Modify — Studio tabs

Common instruction for every tab below: pass `isLoading`/`error`/`onRetry` from the state that already
feeds `PaginationFooter`; **never** add a second fetch.

- **`components/studio/tabs/UsersTab.tsx`** — `ResourceTable` :54 gets the three props from
  `pagination`. **Add the missing "Change Email" control**: an `EditIcon`-style button inside
  `renderExtraActions` (:94) calling `onUpdateEmail?.(u)`, titled "Change Email", rendered only when the
  prop is present — mirroring the adjacent `onUpdateName` button. `EmailVerifiedIcon` already imported.
- **`components/studio/tabs/TeamsTab.tsx`** — both `ResourceTable`s (:58 teams, :196 memberships) get
  the props from `pagination` / `membershipsPagination`.
- **`components/studio/tabs/DatabasesTab.tsx`** — `ResourceTable` :240 (collections) and :359
  (documents) get the props from `collectionsPagination` / `documentsPagination`. Leave :141, :443, :513.
- **`components/studio/tabs/StorageTab.tsx`** — `ResourceTable` :249 (files) gets the props from
  `filesPagination`. Leave :118.
- **`components/studio/tabs/FunctionsTab.tsx`** — `ResourceTable` :219 (deployments) and :318
  (executions) get the props from their paginations. Leave :102 and :366.
- **`components/studio/tabs/SitesTab.tsx`** — replace the three bare "empty" divs with `<ListState>`:
  :156 (sites, from `sitesPagination`), :345 (deployments, from `siteDeploymentsPagination`), :465
  (logs, from `siteLogsPagination`). Keep the existing empty copy as `emptyMessage`. The sites list's
  empty state keeps its "Create Your First Site" call to action — render `ListState` only when
  `isLoading || error`.
- **`components/studio/tabs/MessagingTab.tsx`** —
  - Delete the two `.catch(() => …)` swallows (:48/:49); on failure set a new `error` state and let
    `ListState` render it with `onRetry={loadMessagingData}`.
  - Render `<TabShell>` unconditionally — the loading branch (:203) becomes `ListState` inside the body.
  - `useRegisterSectionRefresh(loadMessagingData)` (wrap it in `useCallback`).
  - **Add a "Recent Campaigns" card**: `getSdkMessaging(project).listMessages([Query.orderDesc('$createdAt'), Query.limit(10)])`,
    rendered read-only as `$id` · `providerType` · delivered/scheduled time, using `ListState` for its
    own three states, refreshed after a successful broadcast. `Models.Message` fields available:
    `$id`, `$createdAt`, `providerType`, `topics`, `users`, `targets`, `scheduledAt?`, `deliveredAt?`.
  - Remove the unused `Query` import if the campaigns card does not use it (it does — keep it), the
    unused `ExternalLinkIcon` import, and the unused `response` assignment in `handleSendBroadcast` (:178).
- **`components/studio/tabs/WebhooksTab.tsx`** —
  - Delete the `.catch(() => [])` (:45) → `error` state + `ListState` + retry.
  - `<TabShell>` unconditional; `useRegisterSectionRefresh(loadWebhooks)`.
  - **Custom event input**: a text field above the checkbox list that appends a typed event to
    `selectedEvents` (trim, ignore blanks and duplicates); selected events not in `COMMON_EVENTS` render
    as removable chips so they are visible and revocable.
  - Show `enabled` and the `signatureKey` (masked, with `CopyButton`) in the table.
  - Remove the unused `ExternalLinkIcon` import.
- **`components/studio/tabs/ProjectSettingsTab.tsx`** —
  - Delete the four `.catch()` swallows (:69–:72). Track one `error` per panel is overkill; keep a
    single `error` for the tab and render it via `ListState` in each of the three tables plus the auth
    panel, with `onRetry={loadSettings}`.
  - `<TabShell>` unconditional; `useRegisterSectionRefresh(loadSettings)`.
  - **`CopyButton` on the API-key secret** (:409) so a freshly created key can actually be used.
  - **Render the fetched-but-hidden auth settings** read-only beneath the method toggles: session limit,
    session duration, password history, password dictionary, and the enabled entries of
    `authProviders` as chips. No editing (there is no `updateAuthProvider`, deliberately).
  - Remove the unused `ExternalLinkIcon` import.
- **`components/studio/tabs/HealthTab.tsx`** — `useRegisterSectionRefresh(runDiagnostics)`; move the
  loading branch (:110) inside `<TabShell>` so the header stops disappearing. Remove the unused
  `VerifiedIcon`, `ExternalLinkIcon` imports and the unused `HealthStatus` type import. Keep the
  existing scope-error panel; do NOT replace it with `ListState` (it is a page-level state, not a list).
- **`components/studio/tabs/ErdTab.tsx`** — `useRegisterSectionRefresh` over a `useCallback`-wrapped
  collection fetch (extract the body of the `useEffect` at :30 into `loadCollections`). Give the fetch an
  `error` state and render `ListState` in the diagram area instead of only toasting.
- **`components/studio/tabs/MigrationsTab.tsx`** — `useRegisterSectionRefresh` over a callback that
  re-checks `hasCheckpoint` (the only refreshable state at the config step); no-op while `step === 'executing'`.
- **`components/studio/tabs/BackupsTab.tsx`** —
  - **Delete the `onRegisterRefresh` prop** and register through `useRegisterSectionRefresh(fetchBackups)`.
  - `fetchBackups`' `catch` sets an `error` state; the `ResourceTable` :252 receives
    `isLoading`/`error`/`onRetry={fetchBackups}` — its `isLoading` finally renders.
  - **Replace both raw `fetch`es**: upload (~:135) → `getSdkStorage(activeProject).createFile(BACKUP_BUCKET_ID, ID.unique(), file)`;
    download (~:162) → `getSdkStorage(activeProject).getFileDownload(BACKUP_BUCKET_ID, file.$id)` →
    `new Blob([buffer])` → object URL → click → **revoke**. The download's `catch` reports through
    `toast.error`, not `console.error`.
  - Do NOT change `BackupService`, the worker deployment, or the snapshot options modal.

### Modify — actions, tools, services

- **`components/studio/hooks/useStudioActions.ts`**
  - `handleUploadFile` (~:618): replace the `fetch` block with `getSdkStorage(activeProject).createFile(bucketId, ID.unique(), file)`.
    Collect each failure's message; on any failure report through `notify.warning`/`notify.error`
    (message + count), and only call `notify.success` when `errorCount === 0` — mirroring
    `handleBulkDeleteUsers`.
  - `handleDownloadFile` (~:660): `getSdkStorage(...).getFileDownload(...)` → `Blob` → object URL →
    revoke. Keep the existing `notify.error` path.
  - `handlePreviewFile` (~:685): `openCustomModal(file.name, <FilePreview project={activeProject} bucketId={…} file={file} />, '3xl')`.
    Delete the hand-built preview/view URLs.
  - `handleBulkUpdateDocuments` (~:278), `handleBulkDeleteDocuments` (~:309), `handleBulkDeleteBuckets`
    (~:733), `handleBulkDeleteFiles` (~:761): replace each `console.error` with failure collection and
    a `notify` report, same shape as above.
  - New signature: none. Do NOT change the hook's parameters, its return object, or `confirmAction`.
  - `normalizeEndpoint` becomes unused here — remove it from the import if so.
- **`tools/storageTools.ts`** — `writeFile` (~:148): replace the `fetch` with
  `getSdkStorage(context.project).createFile(finalBucketId, fileIdToUse, fileToUpload, permissions)`.
  Delete the now-false comment at :158–:160. Keep `handleApiError` as the error path and keep the
  tool's return shape (the SDK returns the same `Models.File` JSON the REST call returned).
- **`services/migrationService.ts`** — `migrateFiles` (~:569): replace the `fetch`/`FormData` block with
  `this.destStorage.createFile(targetBucketId, file.$id, fileObj, file.$permissions)`. Keep the
  surrounding `try/catch`, the cursor bookkeeping and the cloud-worker branch untouched. **Do not touch
  the worker template at ~:351.**

### Modify — app shell

- **`components/MainContent.tsx`** — remove the `error` prop and its inline banner (:97–:107); the
  banner moves to `AgentApp`. Replace the direct `RiRobot2Line` import with `BotIcon` from `./Icons`.
  New signature: `MainContentProps` without `error`.
- **`components/AgentApp.tsx`** —
  - Render `<ErrorBanner message={error} />` (when `error`) directly under `<Header>`, above the
    `viewMode` branch, so it shows in **both** views. Stop passing `error` to `MainContent`.
  - Destructure `isLoading: isProjectsLoading` from `useProjects` and render a spinner in the Studio
    branch's `!activeProject` case while it is true, instead of "No Project Selected".
  - Delete the unused `setError` composite (:216) and any now-unused `setXError` destructures.
  - Do NOT change routing, realtime wiring, or `useAppContext`'s arguments.
- **`components/LeftSidebar.tsx`** — `handleSaveGeminiSettings` (:175) wraps the `await` in
  `try/catch` and reports failure via `useToast().error(...)`. Import `useToast` from `../hooks/useToast`.
- **`components/studio/ui/ToolConfiguration.tsx`** — every `onToolsChange(...)` call site (:54, :62,
  :69, :103, :153) goes through one local helper that catches and toasts. Replace the `Math.random()`
  id (:20) with `React.useId()`.
- **`components/Header.tsx`** — replace the `react-icons/ri` import (:7) with `BotIcon` from `./Icons`
  and use it at :58 and :130.

### Modify — tests & docs

- **`components/studio/StudioShell.test.tsx`** — update the four loading-string markers in
  `SECTION_MARKERS` (:78–:83) to the titles those tabs now render immediately; add a case asserting a
  section registered through `useRegisterSectionRefresh` is invoked by `Shift+R`.
- **`components/LeftSidebar.test.tsx`** — add: a rejecting `onSaveGeminiSettings` produces a visible
  toast and no unhandled rejection.
- **`components/studio/hooks/useStudioActions.test.ts`** — add: a bulk operation whose items reject
  reports the failure through the toast layer (extend the existing harness).
- **`CONTEXT.md`** — §2 forbidden table: add "hand-built Appwrite REST `fetch` in browser code → use the
  `getSdk*` factories (enforced by `test/no-raw-appwrite-fetch.test.ts`)". §3 tree: add `ListState.tsx`,
  `FilePreview.tsx`, `ErrorBanner.tsx`, `useSectionRefresh.tsx`, `test/no-raw-appwrite-fetch.test.ts`.
  §6 SOP "Adding a New Studio Section": add step — *a section that loads its own data calls
  `useRegisterSectionRefresh` and renders `ListState`, never a full-page spinner*.

### Delete

- Nothing is deleted wholesale. Removed symbols: `AgentApp.setError`, `BackupsTab.onRegisterRefresh`,
  `Studio.backupsRefreshRef`/`registerBackupsRefresh`, and the unused imports listed per file.

## 7. Requirements Coverage

| Req | Requirement | Changes by File | Tasks | Status |
|---|---|---|---|---|
| R1 | `usePaginatedQuery.error` is rendered by every list that has one | `ListState.tsx`, `ResourceTable.tsx`, 6 tabs | T1.1, T2.1, T2.2, T2.3 | Covered |
| R2 | A list in flight shows loading, not "No items found." | `ListState.tsx`, `ResourceTable.tsx` | T1.1, T2.1 | Covered |
| R3 | MessagingTab reports provider/topic load failures | `MessagingTab.tsx` | T2.5 | Covered |
| R4 | WebhooksTab reports its list failure | `WebhooksTab.tsx` | T2.6 | Covered |
| R5 | ProjectSettingsTab reports its four load failures | `ProjectSettingsTab.tsx` | T2.7 | Covered |
| R6 | BackupsTab reports its list failure and renders `isLoading` | `BackupsTab.tsx` | T2.10 | Covered |
| R7 | No tab replaces `TabShell` with a full-page spinner | 4 tabs, `StudioShell.test.tsx` | T2.5–T2.8, T2.12 | Covered |
| R8 | Sync / `Shift+R` refreshes all 14 sections | `useSectionRefresh.tsx`, `Studio.tsx`, 6 tabs | T1.3, T1.4, T2.5–T2.10 | Covered |
| R9 | `BackupsTab.onRegisterRefresh` absorbed by the registry | `Studio.tsx`, `BackupsTab.tsx` | T1.4, T2.10 | Covered |
| R10 | The 6 browser-side raw `fetch` transfers go through the SDK | `BackupsTab.tsx`, `useStudioActions.ts`, `storageTools.ts`, `migrationService.ts` | T2.10, T3.2, T3.3, T3.4 | Covered |
| R11 | No browser code builds an Appwrite REST URL | same + guard | T3.1 | Covered |
| R12 | No UI component attaches an API-key header | `BackupsTab.tsx` + guard | T2.10, T3.1 | Covered |
| R13 | File preview works for a non-public bucket | `FilePreview.tsx`, `useStudioActions.ts` | T3.5 | Covered |
| R14 | A failed Gemini-settings save reaches the user | `LeftSidebar.tsx` | T4.4 | Covered |
| R15 | A failed tool-preference save reaches the user | `ToolConfiguration.tsx` | T4.5 | Covered |
| R16 | The 5 bulk operations report per-item failures | `useStudioActions.ts` | T3.6 | Covered |
| R17 | A backup download failure reaches the user | `BackupsTab.tsx` | T2.10 | Covered |
| R18 | Project errors are visible in Studio view | `ErrorBanner.tsx`, `AgentApp.tsx`, `MainContent.tsx` | T1.2, T4.1 | Covered |
| R19 | Connection errors are visible in Studio view | same | T1.2, T4.1 | Covered |
| R20 | "Change Email" is reachable in UsersTab | `UsersTab.tsx` | T2.4 | Covered |
| R21 | A new API key's secret can be copied | `ProjectSettingsTab.tsx` | T2.7 | Covered |
| R22 | A webhook can use an event outside the 11 presets; key/status shown | `WebhooksTab.tsx` | T2.6 | Covered |
| R23 | The fetched auth settings are rendered | `ProjectSettingsTab.tsx` | T2.7 | Covered |
| R24 | A broadcast's outcome is visible | `MessagingTab.tsx` | T2.5 | Covered |
| R25 | No "No Project Selected" flash while projects load | `AgentApp.tsx` | T4.2 | Covered |
| R26 | `AgentApp.setError` removed | `AgentApp.tsx` | T4.3 | Covered |
| R27 | No direct `react-icons` import in a component | `Header.tsx`, `MainContent.tsx` | T4.6 | Covered |
| R28 | The identified unused imports removed (patch — see §3a) | 4 tabs | T2.5–T2.8 | Covered |
| R29 | Stable DOM ids in `ToolConfiguration` | `ToolConfiguration.tsx` | T4.5 | Covered |
| R30 | `ALL_SCOPES` messaging scope names corrected | `ProjectSettingsTab.tsx` | T2.9 | Covered — default in §12 Q1 |

**30 requirements, 30 Covered, 0 Deferred.**

## 8. Data Model / Interfaces

No schema change, no persisted-shape change, no new env var. The only new contracts are the three
component/hook signatures written out verbatim in §6 (`ListStateProps`, `ErrorBanner`,
`useSectionRefresh`). SDK shapes consumed, all verified against `node_modules/node-appwrite@17.2`:

- `Storage.createFile(bucketId: string, fileId: string, file: File, permissions?: string[], onProgress?): Promise<Models.File>`
- `Storage.getFileDownload(bucketId, fileId, token?): Promise<ArrayBuffer>`
- `Storage.getFileView(bucketId, fileId, token?): Promise<ArrayBuffer>`
- `Messaging.listMessages(queries?: string[], search?: string): Promise<Models.MessageList>` with
  `Models.Message = { $id, $createdAt, $updatedAt, providerType, topics, users, targets, scheduledAt?, deliveredAt?, … }`

## 9. Dependencies

*No new dependencies.* `package.json` and `package-lock.json` are untouched.

## 10. Testing & Verification

New/changed test files: `components/studio/ui/ListState.test.tsx` (new),
`components/studio/hooks/useSectionRefresh.test.tsx` (new), `test/no-raw-appwrite-fetch.test.ts` (new),
`components/studio/StudioShell.test.tsx`, `components/LeftSidebar.test.tsx`,
`components/studio/hooks/useStudioActions.test.ts`.

**Phase check** (each phase's V — the narrowest thing proving that phase; every lane typechecks its
own writes):
- `npx tsc --noEmit`
- `npx vitest run <the test file(s) that phase touched>`

**Gate** (the finish, once all lanes have landed): `npm run typecheck && npm test && npm run build`.
Expected: typecheck clean, all tests pass, build succeeds with **only** the pre-existing ">500 kB
chunk" warning.

**Every behavioural criterion below is a code check.** No step in this plan is performed by opening
the app.

| Claim | The assertion that stands for it |
|---|---|
| A failed list shows the failure, not "No items found." | `ListState.test.tsx`: with `error` set, the message and a Retry button are in the document and the text `No items found.` is **not**; Retry calls `onRetry` once. Must be **seen red first** by rendering the pre-change `ResourceTable` path — see T2.1. |
| A list in flight shows progress | `ListState.test.tsx`: `isLoading` + `isEmpty` renders the loading message, not the empty one (branch precedence). |
| Every section still renders its own panel, now with its header during load | `StudioShell.test.tsx`'s existing 14-section loop, with the four loading-string markers replaced by the tab titles. |
| Sync refreshes a self-loading section | `StudioShell.test.tsx`: a probe component registered via `useRegisterSectionRefresh` inside the Studio tree is called when `Shift+R` fires. |
| No browser code holds an API key | `test/no-raw-appwrite-fetch.test.ts`. **Seen red first** (T3.1): before the fixes it must list exactly `useStudioActions.ts`, `storageTools.ts`, `migrationService.ts` (and `BackupsTab.tsx` if Phase 2 has not landed), and pass afterwards. Its third case proves the detector is not vacuous. |
| A failed settings save reaches the user | `LeftSidebar.test.tsx`: a rejecting `onSaveGeminiSettings` puts its message in the document; the test fails on an unhandled rejection today. |
| A bulk operation's per-item failure reaches the user | `useStudioActions.test.ts`: with the SDK stub rejecting, the toast layer receives the failure message (extends the existing `flush()` harness). |
| Uploads/downloads go through the SDK | `useStudioActions.test.ts`: the SDK stub's `createFile`/`getFileDownload` are called and global `fetch` is **not**. |

**No check in this plan requires a human, a browser, or a second device.**

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **`ResourceTable`'s new props change existing empty-state behaviour.** 15 call sites, 6 of which pass nothing. | The new props are all optional and the no-props behaviour is specified to be byte-identical (§6). `StudioShell.test.tsx` renders all 14 sections and would catch a regression. |
| **The four `SECTION_MARKERS` break mid-phase**, and the implementer "fixes" the test by weakening it. | Called out explicitly in §3 and given its own task (T2.12) that replaces them with the tab **titles** — a stronger assertion than a loading string, not a weaker one. |
| **The SDK upload behaves differently from the raw POST** (permissions arg, 409 on duplicate id, chunking headers). | `createFile`'s `permissions` parameter maps to the same `permissions[]` form fields the hand-written code built (verified in `client.mjs` `prepareRequest`). Chunking only engages above 5 MB, where the old path was already at risk. The guard test plus `useStudioActions.test.ts` pin the call. |
| **`configureClient`'s monkey-patched `call`** interferes with `arrayBuffer` responses. | It forwards `responseType` unchanged (`services/appwrite.ts` :187/:237) and only mutates GET *params*. Verified by reading; `getFileDownload` is exercised in `useStudioActions.test.ts`. |
| **A worker template gets "fixed"** into a broken state by a literal implementer. | Named as a Non-Goal in §2 with file and line, repeated in §6, and encoded as the guard test's allowlist. |
| **The refresh registry double-fetches** on sections whose data `refreshCurrentView` already covers. | Only the six self-loading sections register; the seven `useStudioData` sections do not. Stated per-tab in §6. |
| **`FilePreview` leaks object URLs.** | Revocation on unmount is part of its stated contract (§6) and of T3.5's Done-when. |
| **Security:** the API key currently reaches the DOM through the preview URL query string and lives inside two UI components. | Both are removed by R10–R13. The guard test prevents reintroduction. The plan adds no new place where a key is read. |
| **Shared working tree.** Another agent may be editing these files. | Each phase's *Writes* is exact; stage only those paths; re-read a file immediately before editing it. |

## 12. Open Questions / Review

Each carries the default the plan assumes, so it is executable unanswered.

1. **`ALL_SCOPES`' messaging entries** (`ProjectSettingsTab.tsx` :33). `messaging.read`/`messaging.write`
   do not match the per-resource scope names Appwrite uses for the Messaging API.
   **Default: replace them with `providers.read/write`, `topics.read/write`, `subscribers.read/write`,
   `messages.read/write`, `targets.read/write`.** A scope the server does not know is silently useless;
   this list is the documented one for Appwrite ≥ 1.4. Veto if your target server rejects them.
2. **The "Recent Campaigns" card** (R24) is the plan's one genuinely *new* piece of UI — everything else
   fixes something already present. **Default: include it**, read-only and capped at 10, because a
   broadcast with no visible outcome is the dead end the requirement names. Say so and it is dropped.
3. **`OverviewTab` copies the project's admin API key to the clipboard** behind a masked field
   (:103). **Default: leave it.** The key is one the user themselves registered, and the copy button is
   the only way to retrieve it from the studio. Flagged, not changed.
4. **`tsconfig.json` has no `strict` and no `noUnusedLocals`,** though `CONTEXT.md` §2 claims "strict
   types". **Default: leave the config alone** and remove only the four files' unused imports (R28,
   labelled a patch in §3a). Enabling either flag is an unbounded change this plan has not sized.
5. **`.plans/2026-07-21-ops-orchestrator/`** still has 101 open tasks written against the seven-place
   Studio-tab registration that the previous plan removed. **Default: out of scope here** — it needs its
   own revision pass, not a change inside this one.
