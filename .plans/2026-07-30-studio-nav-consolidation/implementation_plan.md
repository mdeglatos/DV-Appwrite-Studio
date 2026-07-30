# Implementation Plan: Studio Navigation Consolidation & Defect Sweep

> **Status:** Complete
> **Type:** Refactor + Multi-defect sweep
> **Created:** 2026-07-30  ·  **Baseline:** `main` @ `c5d3215`
> **Revised:** 2026-07-30 — F15's inventory corrected: `projectAdminService.updateGlobalVariable` (~:99) is **live**, called from `tools/projectAdminTools.ts:107`; it is retained. `updateAuthProvider` and `realtimeService.getEventAction` were genuinely orphaned and removed as planned.
> **Revised:** 2026-07-30 — F11's fix corrected: the config-step "Resume from Checkpoint" button calls a new `handleResumeFromConfig()` (scan, then execute with `resume=true`), because `handleExecute(true)` returns immediately when `plan` is null — which it always is at the config step. See `tasks.md` T6.5.
> **Revised:** 2026-07-30 — T1.2's Done-when corrected: Vitest 4 exits 1 on a run with no test files unless `passWithNoTests` is set (not added by this plan); T1.3 supplies the first test file.
> **Related:** `.plans/2026-07-21-ops-orchestrator/` (untouched — 101 tasks `[ ]`, 1 `[-]`; it adds *new* Studio sections, so its work must be re-expressed against the navigation registry this plan creates — see §12.)

---

## 1. Summary

The Studio has grown to **14 flat top-level tabs** with no grouping, and the tab list is hand-maintained in **seven separate places** that have already drifted apart (the left sidebar advertises 8 tabs with different labels; the top bar advertises 14). That single missing owner is also why the code-editor deep link 404s in Agent mode, why an unknown tab renders a blank page, and why every new feature must be registered in seven files.

This plan does three things. **(a)** It creates the missing owner — a navigation registry — and reorganises the 14 sections into **6 groups plus a Settings gear** (`Overview · Data · Compute · Auth · Integrations · Operations · ⚙`), with grouped URLs (`/studio/data/database/:dbId`) and registry-driven rewrites so every existing bookmark keeps working. **(b)** It creates three further missing owners that the same audit exposed: a single toast surface (today six components fire toasts that are never rendered), a single confirmation mechanism (today three competing ones plus eight banned `alert()` calls), and typed route builders (today 34 hand-concatenated path strings). **(c)** It fixes the remaining 26 audited defects — including the Overview tab displaying **fabricated random numbers** as live usage statistics.

Because the repo has no test runner, the plan adds Vitest + Testing Library so each behavioural fix is asserted rather than asserted-by-hope.

---

## 2. Goals / Non-Goals

**Goals**
- The Studio's 14 sections are reachable through 6 grouped top-level entries plus a Settings gear; **no section is removed and no panel loses functionality**.
- Exactly one module declares what sections exist, what group each belongs to, and what URL each has. Adding or moving a section is a one-file change; forgetting to register one is a compile error.
- Every pre-existing Studio and Agent URL keeps resolving, via a rewrite derived from that same registry.
- Every finding F1–F26 in §3.3 is fixed or explicitly deferred with a reason.
- `npm run typecheck`, `npm test` and `npm run build` are all green at the finish, and the behavioural fixes have assertions that were demonstrated red first.

**Non-Goals**
- **Not** adding new Studio capabilities, panels or Appwrite features. Section *contents* change only where a listed finding requires it.
- **Not** implementing `.plans/2026-07-21-ops-orchestrator/` — no agent, no ops collections, no new tabs.
- **Not** changing the Agent (chat) view's layout, the Gemini tool system, the migration/backup engines, or the workers under `workers/`.
- **Not** replacing the hand-rolled router with a routing library, nor changing the client-only SPA architecture.
- **Not** installing Tailwind via npm, adding a state manager, or introducing CSS modules (all forbidden by `CONTEXT.md` §2).
- **Not** adding runtime dependencies. The only new packages are dev-only test tooling.

---

## 3. Current State & Research

### 3.1 Repo rules and commands

| Item | Finding |
|---|---|
| Rule docs | `CONTEXT.md` at the repo root is the sole in-repo authority. No `AGENTS.md`, `CONTRIBUTING.md`, `.cursor/rules`, or `.github/copilot-instructions.md`. |
| Forbidden (CONTEXT.md §2) | Redux/Zustand/Jotai · CSS modules/styled-components · `alert()`/`confirm()` · raw `process.env.*` · raw SDK calls in UI · SSR |
| Layering (CONTEXT.md §3) | `components/` → `hooks/` → `services/` → SDK. `tools/` holds Gemini tool definitions. |
| Commands | `npm run dev` (:3000) · `npm run build` · `npm run preview` · `npm run typecheck` (`tsc --noEmit`) |
| Baseline `npm run typecheck` | **exit 0, clean** (verified 2026-07-30) |
| Baseline `npm run build` | **exit 0**, `built in 10.40s`, `dist/assets/index-*.js 1,331 kB`. Three pre-existing `vite:reporter` warnings about modules that are both statically and dynamically imported, plus one "chunks larger than 500 kB" warning. **These four warnings are pre-existing and are not a regression** (F26 removes the first three). |
| Test runner | **None.** No `test` script, no test dependency, zero test files. |

### 3.2 How Studio navigation works today

**The tab list is declared, independently, in seven places:**

| # | Location | Content | Drift |
|---|---|---|---|
| 1 | `types.ts:155` — `StudioTab` union | 14 ids | authority-by-convention only |
| 2 | `components/studio/ui/StudioNavBar.tsx:14-29` — `tabs` array | 14 entries + icons + labels | — |
| 3 | `components/LeftSidebar.tsx:188-197` — `studioTabs` array | **8 entries**, label `'Auth & Users'` for `users` | missing `erd`, `sites`, `messaging`, `webhooks`, `health`, `project-settings` |
| 4 | `services/router.tsx:17-29` — `ROUTE_PATTERNS` | per-tab drill-down patterns | uses `function` (singular) for agent, `functions` (plural) for studio |
| 5 | `components/AgentApp.tsx:52-74` — `activeStudioTab` IIFE | hand-written route-name → tab switch | falls through to `'overview'` for anything unrecognised |
| 6 | `components/studio/hooks/useStudioData.ts` — fetch gating | string literals `activeTab !== 'users'` etc. (~:179, 194, 207, 221, 233, 247, 258, 269, 284, 294, 305) | — |
| 7 | `components/Studio.tsx:317-488` — render switch | 14 `activeTab === '…' &&` branches | renders **nothing** for an unknown value |

**Route resolution today** (`services/router.tsx`): `matchRoute()` walks `ROUTE_PATTERNS` in declaration order, converting `:param` to `([^/]+)`, and returns `{ name: 'not-found', params: {} }` on no match. `buildUrl()` (~:101) is exported and has **zero consumers**; all navigation uses hand-built template literals.

**Exhaustive inventory of hand-built route strings — 34 sites** (this is the call-site inventory for the `routes.*` migration; verified via `grep -rn '/project/\${'`):

| File | Lines |
|---|---|
| `components/AgentApp.tsx` | 80, 82, 88, 179, 181, 198, 200, 274 |
| `components/studio/hooks/useStudioData.ts` | 117, 119, 125, 127, 133, 135, 141, 143, 149, 151, 157, 159 |
| `components/Studio.tsx` | 106, 108, 110, 122, 127, 132 |
| `hooks/useAppContext.ts` | 36, 38, 45, 47, 54, 56, 63, 65 |

**Toast wiring today:** `hooks/useToast.ts` is plain local `useState`. Seven components call `useToast()` — `components/Studio.tsx:63`, `studio/tabs/DatabasesTab.tsx:81`, `ErdTab.tsx:13`, `HealthTab.tsx:25`, `MessagingTab.tsx:14`, `ProjectSettingsTab.tsx:36`, `WebhooksTab.tsx:28` — but `<ToastContainer>` is rendered in exactly **one** place, `components/Studio.tsx:493`, bound to Studio's own instance. The other six instances' toasts are unreachable.

**Confirmation wiring today:** three mechanisms — `useStudioModals().confirmAction` (`components/studio/hooks/useStudioModals.ts:16`, rendered by `Studio.tsx:496`); local `confirmation` state + `<ConfirmationModal>` in `MessagingTab.tsx:485`, `ProjectSettingsTab.tsx:600`, `WebhooksTab.tsx:252`; and `AgentApp.tsx`'s `confirmationState` (~:91, rendered ~:379). Plus **eight `alert()` calls**: `studio/ConsolidateBucketsModal.tsx:235,243,247,252`, `studio/tabs/BackupsTab.tsx:104`, `studio/tabs/MigrationsTab.tsx:117,135`, `studio/TransferDocumentsModal.tsx:143`.

### 3.3 Findings inventory (the defect source for this plan)

| ID | Finding | Evidence |
|---|---|---|
| **F1** | Tab registry duplicated across 7 sites and drifted | §3.2 table |
| **F2** | Toasts from 6 components never render | §3.2; only `Studio.tsx:493` mounts `ToastContainer` |
| **F3** | 3 confirmation mechanisms + 8 `alert()` calls (banned by `CONTEXT.md` §2) | §3.2 |
| **F4** | Code-editor deep link 404s in Agent mode | `AgentApp.tsx:179,181` build `/agent/functions/:fnId/code`; `router.tsx:13-14` declares `/agent/function/:fnId/code`. Header's code button (`Header.tsx:161`) therefore navigates to `not-found`, and `isCodeViewerSidebarOpen` (`AgentApp.tsx:173`) never becomes true. |
| **F5** | `buildUrl()` dead; 34 hand-built path strings | §3.2 inventory — the direct cause of F4 |
| **F6** | Unknown tab / `not-found` renders a blank screen | `router.tsx:28` `studio_tab` matches any `:tab`; `Studio.tsx:317-488` has no fallback branch; neither `App.tsx:15-27` nor `AgentApp.tsx:195-203` redirects `not-found` |
| **F7** | Overview "Usage Statistics" shows **fabricated** numbers | `services/projectAdminService.ts:239-248` — the `catch` returns `Math.floor(Math.random()*2000000000)` bandwidth, `Math.random()*500000000` storage, and hardcoded `users: 142, databases: 3, functions: 5`. `OverviewTab.tsx:167-198` renders these as live gauges against invented "1 GB Limit" / "500 MB Limit" ceilings. |
| **F8** | "Deep Thinking" toggle is unreachable | `LeftSidebar.tsx:353` gates on `modelInput === 'gemini-2.5-flash'`; `useSettings.ts:12` `GEMINI_MODELS = ['gemini-3-flash','gemini-3-pro']`. The `geminiThinking` pref can never be changed from the UI. |
| **F9** | Team invitations point at `http://localhost` | `useStudioActions.ts:1009` passes the literal `'http://localhost'` as `createMembership`'s redirect URL |
| **F10** | Snapshot list is stale after delete/restore | `useStudioActions.ts:1203-1219` calls `refreshData()` (databases/buckets/functions) but `BackupsTab.tsx:20,40-52` owns `backups` via its local `fetchBackups`; nothing re-runs it |
| **F11** | Migration "Resume from Checkpoint" (config step) is a no-op | `MigrationsTab.tsx:115` `handleScan(resume)` never reads `resume`; the button at `:338` behaves identically to "Scan Project" |
| **F12** | `TransferDocumentsModal.onSuccess` is empty at 2 of 3 mount sites | `DatabasesTab.tsx:276-278` and `:550-554` contain comments only; lists stay stale after a transfer |
| **F13** | `FunctionsTab` "Redeploy" / "Redeploy All" never render | `onRedeploy` / `onRedeployAll` declared (`FunctionsTab.tsx:36,38`) but not passed by `Studio.tsx:373-394` |
| **F14** | `Studio`'s `activeTools` prop is unused | declared `Studio.tsx:49`, destructured `:55`, never read; passed from `AgentApp.tsx:351` |
| **F15** | Orphaned modules, exports and imports | Never imported: `components/ExecutionLog.tsx`, `components/ProjectContextSelector.tsx`. Unused exports: `Icons.tsx` `McpIcon`/`CommandLineIcon`/`CloudIcon` (`McpIcon`'s comment cites a non-existent `McpTab`), `realtimeService.ts` `getEventAction:247`, `projectAdminService.ts` `updateGlobalVariable:99`/`updateAuthProvider:202`, `usePaginatedQuery.ts` `parseQueryArray:285`. Unused in `useStudioActions.ts`: imports `Query`, `deployCodeFromString`, `downloadAndUnpackDeployment`, `CodeIcon`, `CheckIcon`, `WarningIcon`; locals `setModal:54`, `executions:52`, `siteLogsPagination:30`. `AgentApp.tsx:39` `VIEW_MODE_STORAGE_KEY` is written (`:77`) and never read. |
| **F16** | `useRealtime.useEventListener` is misnamed and its type lies | `hooks/useRealtime.ts:29` declares `(callback: RealtimeCallback) => void`; the implementation (`:106-111`) returns an unsubscribe function that both call sites rely on (`AgentApp.tsx:169-170`, `Studio.tsx:81-82`). It is also a non-hook named `use*`. |
| **F17** | `studioModals.closeModal` is monkey-patched | `Studio.tsx:115` mutates the object returned by `useStudioModals()` *after* `useStudioActions` (`:76`) captured it; correctness depends on shared-reference timing |
| **F18** | Query-builder triplicated; the "client search" path is dead | `useStudioData.ts:30-60` `buildQueries` and `:66-89` `buildQueriesWithClientSearch` are near-identical and duplicate `usePaginatedQuery.ts:285` `parseQueryArray`. `buildQueriesWithClientSearch` returns `searchTerm` "for client-side filtering", but every one of its 5 callers immediately pushes a server-side `Query.search(...)`; no client-side filtering exists anywhere. |
| **F19** | Studio database drill-down double-fetches collections | `useAppContext.ts:29,166-201` derives `selectedDatabase` from `routerParams.dbId` — which is set on *studio* routes too — and `listAll`s **every** collection, while `useStudioData.collectionsPagination` fetches the same collections paginated |
| **F20** | Deep-link modal effect re-creates its modal on every render | `Studio.tsx:136-237` depends on `studioActions` (a new object each render, `:76`) and calls `openCustomModal` inside, so any render while `docId`/`fileId`/`execId` is present re-opens the modal |
| **F21** | `CONTEXT.md` is stale | §3 tree omits `services/router.tsx`, `realtimeService.ts`, `projectAdminService.ts`, `databaseToolsService.ts`, `hooks/useToast.ts`, `hooks/useRealtime.ts`, `workers/`, and `tools/{projectAdminTools,messagingTools,healthTools,webhookTools}.ts`; §9 lists 5 tool groups where `tools/index.ts:28-39` registers 10; §10 has no test command; §11's URL map is superseded by this plan |
| **F22** | Tab page frames are inconsistent; two double-wrap the layout | `Studio.tsx:316` already applies `max-w-6xl mx-auto space-y-8 animate-fade-in pb-10`; `BackupsTab.tsx:168` re-applies the identical wrapper, and `MigrationsTab.tsx:215` applies `max-w-5xl mx-auto h-[calc(100vh-140px)]` inside an already-scrolling container (nested scrollbars). Nine tabs render an `<h1>` + Console link; five (Databases list, Storage list, Functions list, Users, Teams) render no header at all. |
| **F23** | `ALL_SCOPES` omits Sites scopes | `ProjectSettingsTab.tsx:13-33` has no `sites.read`/`sites.write`, so a key minted from the Studio cannot manage the Sites the Studio itself exposes |
| **F24** | Bulk user/team delete handlers are misplaced and swallow errors | `Studio.tsx:245-268` — every other bulk handler lives in `useStudioActions.ts`; both `catch (e) { console.error(e) }` with no user-visible error |
| **F25** | Escape closes a modal *and* deselects the resource behind it | `Studio.tsx:271-300` binds a global `keydown` and bails only when `studioModals.modal?.isOpen`. `CleanupModal`, `TransferDocumentsModal`, `ConsolidateBucketsModal` and `BackupsTab`'s config `Modal` are separate state, so Escape both closes them (`Modal.tsx:36-49`) and clears the selection underneath. The bare `r` refresh shortcut is also undiscoverable. |
| **F26** | Pointless dynamic imports produce build warnings | `Studio.tsx:153,179,205,247,262` and `ErdTab.tsx:33` dynamically `import('../services/appwrite')`, `OverviewTab.tsx:39` imports `projectAdminService`, `DatabasesTab.tsx:97` imports `databaseToolsService` — all three modules are already statically imported elsewhere, so the dynamic import buys no code-splitting and emits the three `vite:reporter` warnings recorded in §3.1 |

---

## 4. Roots, not symptoms

| Symptom | Where a patch would stop | Root — the owner that replaces it |
|---|---|---|
| F1 · 14 tabs declared 7× and already drifted (sidebar shows 8 with different labels) | Sync the sidebar array with the nav-bar array | **Nobody owns "what sections the Studio has."** `services/studioNav.ts` owns group/section structure, ids, labels, order and URL segments; `components/studio/navigation.tsx` binds each section to its icon and panel. Both are typed `Record<StudioTab, …>`, so omitting a section **fails to compile**. *(Consolidation)* |
| F6 · unknown tab renders blank | Add an `else` branch to the render switch | Same owner — `Studio.tsx` dispatches from the registry map instead of a 14-branch switch, so "unknown" is expressible only as "not in the registry" and is handled once. *(Consolidation)* |
| F4 · code editor 404s in Agent mode · F5 · 34 hand-built path strings | Fix the two `functions`/`function` typos | **Nobody owns "what the URL for X is."** `services/router.tsx` gains a typed `routes` builder object; `ROUTE_PATTERNS` stays its only pattern source, and every navigation goes through `routes.*`. `buildUrl` is absorbed, not duplicated. *(Consolidation)* |
| F2 · toasts from 6 components are invisible | Render a `ToastContainer` in each of the 6 | **Nobody owns "where toasts appear."** `hooks/useToast.tsx` becomes a `ToastProvider` + context; one `<ToastContainer>` mounts at the app root. `useToast()` keeps its exact current signature, so no call site changes. *(Consolidation — absorbs the existing hook)* |
| F3 · 3 confirm mechanisms + 8 `alert()` calls | Replace each `alert()` with a local modal | **Nobody owns "how the app asks for confirmation."** `hooks/useConfirm.tsx` provides `useConfirm()` returning a promise-returning `confirm()`; `useStudioModals().confirmAction` becomes a thin wrapper over it, and the three local `ConfirmationModal` states plus `AgentApp.confirmationState` are deleted. `ConfirmationModal.tsx` survives as the provider's presentation. A source-scanning guard test bans `alert(`/`confirm(`/`prompt(` — and must be demonstrated red first. *(Consolidation)* |
| F22 · 9 tabs have headers, 5 don't; 2 double-wrap the layout | Add a header to the 5 and delete the 2 wrappers | **Nobody owns "what a Studio page looks like."** `components/studio/ui/TabShell.tsx` owns the title / subtitle / console-link / action-slot frame; `Studio.tsx` keeps owning the outer scroll container, and no tab re-declares `max-w-*`. *(Consolidation)* |
| F18 · query builder written 3× · F19 · collections fetched twice per drill-down | Delete one of the two `useStudioData` copies | **Two owners for "pagination state → Appwrite queries", and two for "the current database's collections."** `usePaginatedQuery.parseQueryArray` becomes the single query builder (`useStudioData`'s two copies are deleted); `useAppContext` stops resolving `dbId`/fetching collections on studio routes, leaving `useStudioData` the sole owner there. *(Consolidation)* |
| F7 · Overview shows random numbers as usage | Widen the `try` block | `getProjectUsage` **is** the owner and is wrong: it fabricates on failure. Change it to return `null`, and have `OverviewTab` render an explicit unavailable state. *(Correction)* |
| F8 · thinking toggle unreachable · F9 · `localhost` invites · F10 · stale snapshot list · F11 · dead resume button · F12 · empty `onSuccess` · F13 · dead redeploy props · F16 · lying return type · F17 · monkey-patch · F20 · looping effect · F23 · missing scopes · F24 · misplaced handlers · F25 · Escape collision | — | Each has an existing, identifiable owner that is simply wrong. *(Correction)* |
| F14 · unused prop · F15 · orphaned modules/exports/imports · F21 · stale doc · F26 · pointless dynamic imports | — | Removal and doc refresh, no semantic change. *(Mechanical)* |

No row here is a **Patch** — every symptom cluster either gets an owner or corrects an existing one.

---

## 5. Architecture & Conventions to Follow

- **Layering (`CONTEXT.md` §3):** `components/` → `hooks/` → `services/`. `services/studioNav.ts` is **pure data + pure functions, no React and no JSX** precisely so `services/router.tsx` may import it; icons and panel components live in `components/studio/navigation.tsx`. A `services/*` file must never import from `components/`.
- **Appwrite access:** only through the factories in `services/appwrite.ts` (`getSdkDatabases`, `getSdkStorage`, `getSdkFunctions`, `getSdkUsers`, `getSdkTeams`, `getSdkSites`, `getSdkMessaging`, `getSdkHealth`). Do **NOT** construct `Client`/`NodeClient` anywhere else; do **NOT** call `fetch` against an Appwrite endpoint from a component (the two existing exceptions — multipart upload in `useStudioActions.handleUploadFile` and `BackupsTab.handleLocalFileUpload` — stay as they are; this plan does not add new ones).
- **Config:** every id/endpoint comes from `config.ts` / the `AppwriteProject` record. Never `import.meta.env` outside `config.ts`, never `process.env`.
- **Dialogs (`CONTEXT.md` §2):** `alert`/`confirm`/`prompt` are banned. Messages → `useToast()`. Confirmations → `useConfirm()`. Forms → `useStudioModals().openForm`.
- **Icons:** import only from `components/Icons.tsx` and add a wrapper there if one is missing — mirror `Icons.tsx:98-101`. Never import `react-icons` directly in a component (`Header.tsx:7` is a pre-existing violation; leave it, it is out of scope).
- **Styling:** Tailwind utility classes inline, matching the existing dark palette (`bg-gray-900/40`, `border-white/5`, `text-cyan-400` accents, `rounded-2xl`, `custom-scrollbar`). Mirror `components/studio/ui/StudioNavBar.tsx` for chip rows and `components/studio/tabs/WebhooksTab.tsx:112-128` for page headers. Tailwind stays CDN-loaded — do not add it to `package.json`.
- **Hooks:** `useState`/`useCallback`/`useEffect`/`useRef`/`useMemo` only; contexts where a single owner is required (this plan adds exactly two: Toast, Confirm — both alongside the existing `RouterProvider` pattern in `services/router.tsx:123`). No external state library.
- **Naming/placement:** shared Studio UI in `components/studio/ui/`; Studio hooks in `components/studio/hooks/`; panels in `components/studio/tabs/`. Tests sit **next to** the file under test as `<name>.test.ts(x)`.
- **Errors:** every async handler already funnels through `notify.*` in `useStudioActions.ts:57-62` or a local `toast.error`. Keep that; never leave an empty `catch`.
- **Do NOT** rename any `StudioTab` id value, any `tools/` export, any `services/appwrite.ts` factory, or any Appwrite collection/field name. Section ids in the registry are exactly the existing `StudioTab` literals so that `useStudioData`, `useStudioActions` and `Studio.tsx` need no string changes.

---

## 6. Proposed Approach

**Structure.** `services/studioNav.ts` declares seven groups, each with an ordered list of section ids (the existing `StudioTab` literals). A group with a single section is *collapsed*: its canonical URL omits the section segment. `settings` carries `placement: 'trailing'` so the nav bar renders it as a gear at the far right.

| Group | Label | Sections (existing `StudioTab` ids) | Canonical base path |
|---|---|---|---|
| `overview` | Overview | `overview` | `/studio/overview` (collapsed) |
| `data` | Data | `database`, `storage`, `erd` | `/studio/data/<section>` |
| `compute` | Compute | `functions`, `sites` | `/studio/compute/<section>` |
| `auth` | Auth | `users`, `teams` | `/studio/auth/<section>` |
| `integrations` | Integrations | `messaging`, `webhooks` | `/studio/integrations/<section>` |
| `operations` | Operations | `health`, `migrations`, `backups` | `/studio/operations/<section>` |
| `settings` | Settings | `project-settings` | `/studio/settings` (collapsed, trailing) |

Section **labels** are: Overview · Databases · Storage · Schema (ERD) · Functions · Sites · Users · Teams · Messaging · Webhooks · Health · Migrations · Backups · Settings.

**URLs.** Group segment is nested into the path (the reviewed decision), and a registry-driven rewrite keeps every old link working: if the first segment after `/studio/` is a known *section* id rather than a known *group* id, the path is rewritten to the canonical form and `history.replaceState`d before matching. The same rewrite normalises the Agent view's `function` segment to `functions`, which is what makes F4 impossible to reproduce.

**Rejected alternative — keep the flat paths and treat grouping as presentation only.** Cheaper, but it leaves the group unrepresented in the URL, so a deep link cannot express "the Data group with Storage selected", and the sub-nav's state would have to be recovered by a lookup on every render. The reviewed decision was the nested form; the rewrite carries the compatibility cost once, in one function.

**Rendering.** `StudioNavBar` renders the six primary groups plus the gear and the existing Sync button. `StudioSubNav` renders the active group's sections and renders nothing for a collapsed group. `Studio.tsx` looks the active section up in the registry's panel map instead of running a 14-branch switch. `LeftSidebar` renders the same registry as a grouped tree.

**Owners before fixes.** Phases 2–5 install the four owners (registry, route builders, toast, confirm) and the page frame; Phase 6 then makes the remaining corrections against a codebase where each concept has exactly one home.

---

## 7. Changes by File

### Create

- `test/setup.ts` — Vitest setup. Imports `@testing-library/jest-dom/vitest` and registers `afterEach(cleanup)` from `@testing-library/react`. Owns global test setup; nothing else may configure the DOM environment.
- `services/appwrite.test.ts` — proves the harness works against existing pure functions. Cases: `normalizeEndpoint` adds `https://` and `/v1` and strips trailing slashes; `getConsoleUrl` maps `https://h/v1` → `https://h/console/project-default-<id><path>`; `listAll` paginates until `total` is reached.
- `services/studioNav.ts` — **the owner of Studio navigation structure.** Pure data + pure functions; no React, no JSX, no imports from `components/`. Exports:
  ```ts
  export type StudioGroupId =
    'overview' | 'data' | 'compute' | 'auth' | 'integrations' | 'operations' | 'settings';

  export interface StudioGroup {
    id: StudioGroupId;
    label: string;
    sections: readonly StudioTab[];   // ordered; >= 1
    placement?: 'trailing';           // 'settings' only
  }

  export const STUDIO_GROUPS: readonly StudioGroup[];
  export const SECTION_TO_GROUP: Record<StudioTab, StudioGroupId>;
  export const SECTION_LABELS: Record<StudioTab, string>;

  export function isStudioGroupId(v: string): v is StudioGroupId;
  export function isStudioTab(v: string): v is StudioTab;
  export function groupOf(section: StudioTab): StudioGroup;
  export function isCollapsed(group: StudioGroup): boolean;         // group.sections.length === 1
  export function defaultSectionOf(group: StudioGroupId): StudioTab; // sections[0]
  /** Canonical path suffix after `/project/:id/studio`, e.g. 'data/database' or 'settings'. */
  export function sectionSegments(section: StudioTab): string;
  ```
  `SECTION_TO_GROUP` is declared as an explicit `Record<StudioTab, StudioGroupId>` literal — that annotation is what makes a forgotten section a **compile error**.
- `services/studioNav.test.ts` — registry invariants: every `StudioTab` appears in exactly one group; `STUDIO_GROUPS` order is `overview, data, compute, auth, integrations, operations, settings`; only `settings` is `placement: 'trailing'`; `sectionSegments` returns `'overview'`, `'settings'`, `'data/database'`, `'operations/health'`; `SECTION_LABELS` has no empty value.
- `services/router.test.ts` — routing contract. Cases: `matchRoute('/project/p/studio/data/database/db1/collection/c1')` → `studio_collection` with all three params; `matchRoute('/project/p/agent/functions/f1/code')` → `agent_function_code`; `rewriteLegacyPath` maps `/project/p/studio/database/db1` → `/project/p/studio/data/database/db1`, `/project/p/studio/health` → `/project/p/studio/operations/health`, `/project/p/studio/project-settings` → `/project/p/studio/settings`, `/project/p/agent/function/f1/code` → `/project/p/agent/functions/f1/code`, and returns `null` for an already-canonical path; **all 20** `routes.*` builders round-trip through `matchRoute` to the expected route name (**this round-trip case is the F4 regression test**).
- `components/studio/navigation.tsx` — **the presentation binding.** Exports `STUDIO_SECTION_UI: Record<StudioTab, { icon: React.ReactNode; Panel: React.ComponentType<any> }>` and `STUDIO_GROUP_ICONS: Record<StudioGroupId, React.ReactNode>`. Icons come from `components/Icons.tsx` only. Because both are `Record<…>`, a section without a panel does not compile. Owns nothing structural — group membership, order and labels stay in `services/studioNav.ts`.
- `components/studio/ui/StudioSubNav.tsx` — renders the active group's sections as an underlined tab row (mirror `FunctionsTab.tsx:220-239`'s pill row styling), or `null` when `isCollapsed(group)`. Props: `{ group: StudioGroup; activeSection: StudioTab; onSectionChange: (s: StudioTab) => void }`.
- `components/studio/ui/TabShell.tsx` — **the owner of the Studio page frame.** Props: `{ title: string; subtitle?: string; icon?: React.ReactNode; consoleHref?: string; actions?: React.ReactNode; children: React.ReactNode }`. Renders the header row (title + subtitle + optional "Open in Console" link, mirroring `WebhooksTab.tsx:112-128`) then `children` in a `space-y-6` block. Does **NOT** set `max-w-*`, `mx-auto`, or any scroll container — `Studio.tsx:315-316` keeps owning those.
- `components/studio/ui/StudioNavBar.test.tsx` — asserts the six primary group chips render with their labels, that the Settings gear renders last, that clicking a chip calls `onGroupChange` with that group id, and that `StudioSubNav` renders three section buttons for `data` and nothing for `settings`.
- `hooks/useConfirm.tsx` — **the owner of confirmation dialogs.** Exports `ConfirmProvider` and `useConfirm(): (opts: ConfirmOptions) => Promise<boolean>` with
  ```ts
  export interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;      // default 'Confirm'
    cancelText?: string;       // default 'Cancel'
    confirmButtonClass?: string; // default 'bg-red-600 hover:bg-red-700'
  }
  ```
  It renders the existing `components/ConfirmationModal.tsx` — that component is the provider's presentation and is **not** duplicated.
- `hooks/useConfirm.test.tsx` — resolves `true` on confirm, `false` on cancel and on Escape; only one dialog is in the tree at a time.
- `hooks/useToast.test.tsx` — a component calling `toast.error(...)` inside a `ToastProvider` puts the message in the document; a second `ToastProvider`-less render throws a clear error; the container caps at 5 toasts (matching `useToast.ts:41`).
- `test/no-native-dialogs.test.ts` — **guard.** Walks `components/`, `hooks/`, `services/`, `tools/` with `node:fs` (skipping `node_modules`, `dist`, `.test.` files) and asserts zero matches for `/\b(alert|confirm|prompt)\s*\(/` other than `useConfirm`'s own API. Must be demonstrated failing on the pre-fix tree (8 matches) before the fixes land.
- `components/studio/StudioShell.test.tsx` — renders `Studio` with a mocked `services/appwrite` and asserts that each registry section id renders its registered panel, and that an id not in the registry cannot be constructed (type-level) while an unknown URL segment redirects to `overview`.
- `services/projectAdminService.test.ts` — `getProjectUsage` returns `null` (never fabricated values) when the underlying call rejects.

### Modify

- `package.json` — add dev-only test tooling and the `test` script. See §9.
- `vite.config.ts` — switch `defineConfig` to `import { defineConfig } from 'vitest/config'` (keep `loadEnv` from `'vite'`), and add:
  ```ts
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./test/setup.ts'],
    env: {
      VITE_APPWRITE_ENDPOINT: 'https://test.appwrite.local/v1',
      VITE_APPWRITE_PROJECT_ID: 'test-project',
      VITE_APPWRITE_DATABASE_ID: 'test-db',
      VITE_APPWRITE_PROJECTS_COLLECTION_ID: 'test-projects',
    },
    exclude: ['node_modules/**', 'dist/**'],
  }
  ```
  The `test.env` block is **required**: `services/appwrite.ts:8-10` calls `new Client().setEndpoint(appwriteConfig.endpoint)` at module scope, and `.env.local` is gitignored, so without it every test importing that module fails at import time. Do NOT change the `server`, `plugins`, `define` or `resolve` blocks.
- `types.ts` — `StudioTab` (~:155) keeps its exact 14 literals and stays the authority. Add a doc comment pointing at `services/studioNav.ts` as the structure owner. Do **NOT** move the union into `services/`.
- `services/router.tsx` — the routing owner absorbs path construction.
  - Replace `ROUTE_PATTERNS` (~:4-34) with the grouped set in §8.1. Keep the `as const`, the ordering-sensitive most-specific-first arrangement, and `RouteName`'s derivation.
  - Add `export function rewriteLegacyPath(pathname: string): string | null` — returns the canonical path for a legacy one, or `null` if already canonical. Derives entirely from `services/studioNav.ts` (`isStudioGroupId`, `isStudioTab`, `sectionSegments`); also maps the Agent view's `function` segment to `functions`.
  - Add `export const routes` — the 20 typed builders in §8.2. `buildUrl` (~:101) is **absorbed**: keep it exported, reimplement `routes.*` on top of it, and do not create a parallel string-building path.
  - In `RouterProvider` (~:123-164), run `rewriteLegacyPath` on mount and on every location change; when it returns a string, `window.history.replaceState(null,'',next)` and use `next` for matching.
  - Add `export function resolveStudioSection(route: ParsedRoute): StudioTab | null` — the single replacement for `AgentApp.tsx:52-74`. Returns the section for a named studio route, the validated `params.section` for `studio_section`, `defaultSectionOf(params.group)` for `studio_group`, `'overview'` for `studio`, and `null` when the group/section is unknown.
  - Do NOT change `navigate`, `cleanPathname`, `parseQuery` or the `NAVIGATE_EVENT` mechanism.
- `App.tsx` — after the existing auth redirect effect (~:15-27), redirect `route.name === 'not-found'` to `/` (logged in) or `/landing` (logged out), `{ replace: true }`. **F6.**
- `index.tsx` — wrap `<App />` in `<ToastProvider>` and `<ConfirmProvider>` inside the existing `<RouterProvider>`. Order: `RouterProvider > ToastProvider > ConfirmProvider > App`.
- `components/AgentApp.tsx`
  - Delete the `activeStudioTab` IIFE (~:52-74) and use `resolveStudioSection(route) ?? 'overview'`. Delete `VIEW_MODE_STORAGE_KEY` (~:39) and its write (~:77). **F1, F15.**
  - Replace all 8 hand-built path strings (~:80, 82, 88, 179, 181, 198, 200, 274) with `routes.*`. Lines 179/181 must use `routes.agentFunctionCode` / `routes.agentFunction`. **F4, F5.**
  - Delete `confirmationState` (~:91-93), `requestProjectDeletion` (~:233-239), `requestFileDelete` (~:241-247) and the `<ConfirmationModal>` render (~:379-381); re-express both flows with `useConfirm()`. `requestFileDelete` is passed to `CodeViewerSidebar`'s `onFileDelete` (~:375) — keep that prop, change only its body. **F3.**
  - Stop passing `activeTools` to `Studio` (~:351). **F14.**
  - Rename `realtime.useEventListener` → `realtime.addEventListener` at ~:169. **F16.**
- `components/Studio.tsx`
  - Replace the 14-branch render switch (~:317-488) with a registry lookup: resolve `STUDIO_SECTION_UI[activeSection].Panel` and render it. Panel props stay exactly as they are today — keep the existing prop objects per section; this is a dispatch change, not a props change.
  - Replace the 6 hand-built path strings (~:106, 108, 110, 122, 127, 132) with `routes.*`. **F5.**
  - Remove the `activeTools` prop from `StudioProps` (~:49) and the destructure (~:55). **F14.**
  - Remove `<ToastContainer>` (~:493) and the local `useToast()` (~:63) — both move to the app root. `useToast()` calls inside actions keep working through context. **F2.**
  - Delete the `studioModals.closeModal = closeModal` mutation (~:115). Pass the route-aware close into `useStudioModals(onAfterClose)` instead — new signature in the `useStudioModals` entry below. **F17.**
  - Rewrite the deep-link modal effect (~:136-237): drop `studioActions` and `openCustomModal` from the dependency array, and guard re-entry with a `useRef` holding the last-opened `docId|fileId|execId` so the modal is created once per param change. **F20.**
  - Move `handleBulkDeleteUsers` (~:245-255) and `handleBulkDeleteTeams` (~:258-268) into `useStudioActions.ts`; report failures through `notify.error` instead of `console.error`. **F24.**
  - Escape handler (~:271-300): bail when *any* dialog is open. Track this with a module-level open-dialog counter exported from `components/Modal.tsx` (incremented on mount, decremented on unmount) rather than testing `studioModals.modal` alone, so `CleanupModal`/`TransferDocumentsModal`/`ConsolidateBucketsModal`/`BackupsTab`'s modal are all covered. Change the refresh shortcut from bare `r` to `Shift+R` and add its label to the Sync button's `title`. **F25.**
  - Replace the 5 dynamic `import('../services/appwrite')` calls (~:153, 179, 205, 247, 262) with the existing static import. **F26.**
  - Wrap the content area's inner div (~:316) unchanged; it stays the sole owner of `max-w-6xl mx-auto`.
- `components/Modal.tsx` — export a module-level open-dialog counter (`registerOpenDialog(): () => void`) used by `Modal`'s own mount effect and read by `Studio.tsx`'s Escape handler. Do NOT change the visual output or the existing Escape/backdrop behaviour. **F25.**
- `components/studio/ui/StudioNavBar.tsx` — rewrite to render `STUDIO_GROUPS`: the six primary chips (icon + label from the registry), a divider, the Settings gear (`placement: 'trailing'`, icon-only with `title="Settings"`), a divider, then the existing Sync button unchanged. New props: `{ activeGroup: StudioGroupId; onGroupChange: (g: StudioGroupId) => void; onRefresh: () => void; isLoading: boolean }`. Keep the existing chip styling and the `custom-scrollbar` overflow behaviour. **F1.**
- `components/LeftSidebar.tsx`
  - Delete the local `studioTabs` array (~:188-197) and render `STUDIO_GROUPS` as a grouped tree (group label header + its sections), driving selection through `onStudioSectionChange`. Rename the props `activeStudioTab`/`onStudioTabChange` → `activeStudioSection`/`onStudioSectionChange`. **F1.**
  - Change the Deep Thinking gate (~:353) from `modelInput === 'gemini-2.5-flash'` to `modelInput.endsWith('-flash')`, which is true for `gemini-3-flash` in `useSettings.ts:12`. **F8.**
- `hooks/useToast.ts` → **rename to `hooks/useToast.tsx`** and convert to a provider. Exports `ToastProvider` plus `useToast(): ToastActions` reading context and throwing a named error when unmounted. `ToastActions`, `Toast` and `ToastType` keep their exact current shapes, so all 7 existing call sites compile unchanged. Imports are extensionless (`from '../hooks/useToast'`), so no importer needs editing. **F2.**
- `components/studio/hooks/useStudioModals.ts` — new signature `useStudioModals(onAfterClose?: () => void)`; `closeModal` (~:9-13) invokes it after clearing state. `confirmAction` (~:16-26) is reimplemented as a wrapper over `useConfirm()` so there is one confirmation path; **its call signature is unchanged, so all 29 `confirmAction` call sites in `useStudioActions.ts` are untouched** (`openForm`'s 34 call sites are likewise untouched — it keeps using the existing dynamic `Modal`). **F3, F17.**
- `components/studio/hooks/useStudioActions.ts`
  - `handleCreateMembership` (~:1009): replace `'http://localhost'` with `window.location.origin`. **F9.**
  - `handleDeleteBackup` / `handleRestoreBackup` (~:1203-1219): call a new `onBackupsChanged` callback threaded from `Studio.tsx` → `BackupsTab`, in addition to `refreshData()`. **F10.**
  - Add `handleBulkDeleteUsers(userIds: string[])` and `handleBulkDeleteTeams(teamIds: string[])` moved from `Studio.tsx`, using `notify.error` per failure. Export both. **F24.**
  - Remove unused imports `Query`, `deployCodeFromString`, `downloadAndUnpackDeployment`, `CodeIcon`, `CheckIcon`, `WarningIcon` and unused destructures `setModal` (~:54), `executions` (~:52), `siteLogsPagination` (~:30). **F15.**
- `components/studio/hooks/useStudioData.ts` — delete `buildQueries` (~:30-60) and `buildQueriesWithClientSearch` (~:66-89); import `parseQueryArray` from `usePaginatedQuery` and map its `appwriteQueries` to `Query.*` in one shared local helper. All 11 fetch factories keep their current server-side `Query.search` behaviour — the dead "client-side filtering" return value simply disappears. Replace the 12 hand-built path strings (~:117-159) with `routes.*`. **F5, F18.**
- `components/studio/hooks/usePaginatedQuery.ts` — `parseQueryArray` (~:285) stops being dead: it is now the single query parser. Keep its signature. **F18.**
- `hooks/useAppContext.ts` — replace the 8 hand-built path strings (~:36-65) with `routes.*` (**F5**); add an `isAgentRoute: boolean` parameter and skip `selectedDatabase` resolution plus the collections `useEffect` (~:166-201) when false, so studio drill-downs no longer double-fetch (**F19**). Call site: `AgentApp.tsx:164`.
- `hooks/useRealtime.ts` — rename `useEventListener` → `addEventListener` in `UseRealtimeReturn` (~:29) and the implementation (~:106-111); correct the return type to `() => void`. Call sites: `AgentApp.tsx:169`, `Studio.tsx:81`. **F16.**
- `services/projectAdminService.ts` — `getProjectUsage` (~:225-249): delete the fabricated fallback; new signature `getProjectUsage(project: AppwriteProject): Promise<ProjectUsage | null>` returning `null` on failure. Remove the unused `updateGlobalVariable` (~:99) and `updateAuthProvider` (~:202). Call site: `OverviewTab.tsx:40`. **F7, F15.**
- `services/realtimeService.ts` — remove the unused `getEventAction` export (~:247-254). **F15.**
- `components/Icons.tsx` — remove `McpIcon` (~:80), `CommandLineIcon` (~:72), `CloudIcon` (~:75) and the stale `// Fix: Adding missing icon exports for McpTab…` comment (~:79); prune the now-unused `RiPlugLine`, `RiCommandLine`, `RiCloudLine` from the import list (~:6). **F15.**
- **All 14 files in `components/studio/tabs/`** — adopt `TabShell` for the page header, and delete every locally declared `max-w-*`/`mx-auto`/height wrapper. Specifically `BackupsTab.tsx:168` (drop the duplicate `max-w-6xl mx-auto space-y-8 animate-fade-in pb-20` wrapper) and `MigrationsTab.tsx:215` (drop `max-w-5xl mx-auto h-[calc(100vh-140px)]`). Tabs without a header today (Databases list, Storage list, Functions list, Users, Teams) gain one. Panel *behaviour* is otherwise unchanged. **F22.**
- `components/studio/tabs/OverviewTab.tsx` — handle `getProjectUsage` returning `null` with an explicit "Usage statistics unavailable for this API key" panel; delete the invented "1 GB Limit"/"500 MB Limit" gauge ceilings and render raw values. Replace the dynamic `import('../../../services/projectAdminService')` (~:39) with a static import. **F7, F26.**
- `components/studio/tabs/BackupsTab.tsx` — replace `alert()` (~:104) with `toast.error`; accept an `onRegisterRefresh` (or equivalent) so `useStudioActions`'s delete/restore can re-run `fetchBackups` (**F10**). **F3.**
- `components/studio/tabs/MigrationsTab.tsx` — replace both `alert()`s (~:117, 135) with `toast.error`; remove the unused `resume` parameter from `handleScan` (~:115) and change the config-step "Resume from Checkpoint" button (~:337-343) to call `handleExecute(true)` directly, matching the preview-step button at `:459`. **F3, F11.**
- `components/studio/tabs/DatabasesTab.tsx` — fill both empty `TransferDocumentsModal.onSuccess` bodies (~:276-278, ~:550-554) so they refresh `collectionsPagination` / `documentsPagination` like the first mount site does (**F12**); replace the dynamic `import('../../../services/databaseToolsService')` (~:97) with a static import (**F26**).
- `components/studio/tabs/ErdTab.tsx` — replace the dynamic `import('../../../services/appwrite')` (~:33) with the static import. **F26.**
- `components/studio/tabs/FunctionsTab.tsx` — remove the unreachable `onRedeployAll` (~:35) and `onRedeploy` (~:38) props and the two buttons they gate (~:116-123, ~:200-207). **F13.**
- `components/studio/tabs/ProjectSettingsTab.tsx` — add `'sites.read'`, `'sites.write'` to `ALL_SCOPES` (~:13-33); delete the local `confirmation` state and `<ConfirmationModal>` (~:49-54, ~:599-610) in favour of `useConfirm()`. **F3, F23.**
- `components/studio/tabs/{MessagingTab,WebhooksTab}.tsx` — delete the local `confirmation` state and `<ConfirmationModal>` render (`MessagingTab.tsx:28-33, 484-495`; `WebhooksTab.tsx:40-45, 251-262`) in favour of `useConfirm()`. **F3.**
- `components/studio/{ConsolidateBucketsModal,TransferDocumentsModal}.tsx` — replace the five `alert()` calls (`ConsolidateBucketsModal.tsx:235,243,247,252`; `TransferDocumentsModal.tsx:143`) with `toast.error`/`toast.warning`. **F3.**
- `CONTEXT.md` — refresh §3 (directory tree: add `services/router.tsx`, `realtimeService.ts`, `projectAdminService.ts`, `databaseToolsService.ts`, `hooks/useToast.tsx`, `useConfirm.tsx`, `useRealtime.ts`, `workers/`, `test/`, the 4 missing `tools/` modules, and `studioNav.ts` + `studio/navigation.tsx`), §6 SOP "Adding a New Studio Tab" (now: add the id to `StudioTab`, add it to a group in `services/studioNav.ts`, add its icon+panel to `components/studio/navigation.tsx` — that's it), §9 tool table (10 groups, not 5), §10 commands (add `npm test`), §11 URL map (the §8.1 patterns), and §2 (note that the `alert()` ban is now guarded by `test/no-native-dialogs.test.ts`). **F21.**

### Delete

- `components/ExecutionLog.tsx` — never imported. Nothing to update. **F15.**
- `components/ProjectContextSelector.tsx` — never imported. Nothing to update. **F15.**

---

## 8. Data Model / Interfaces

*No database or Appwrite schema changes.* The contracts below are URL and TypeScript contracts and must be reproduced exactly.

### 8.1 `ROUTE_PATTERNS` (replaces `services/router.tsx:4-34`, order significant)

```ts
export const ROUTE_PATTERNS = [
  { name: 'landing',  pattern: '/landing' },
  { name: 'login',    pattern: '/login' },
  { name: 'projects', pattern: '/projects' },

  // Agent view
  { name: 'agent_collection',    pattern: '/project/:projectId/agent/database/:dbId/collection/:collId' },
  { name: 'agent_database',      pattern: '/project/:projectId/agent/database/:dbId' },
  { name: 'agent_storage',       pattern: '/project/:projectId/agent/storage/:bucketId' },
  { name: 'agent_function_code', pattern: '/project/:projectId/agent/functions/:fnId/code' },
  { name: 'agent_function',      pattern: '/project/:projectId/agent/functions/:fnId' },
  { name: 'agent',               pattern: '/project/:projectId/agent' },

  // Studio — Data group
  { name: 'studio_document',   pattern: '/project/:projectId/studio/data/database/:dbId/collection/:collId/document/:docId' },
  { name: 'studio_collection', pattern: '/project/:projectId/studio/data/database/:dbId/collection/:collId' },
  { name: 'studio_database',   pattern: '/project/:projectId/studio/data/database/:dbId' },
  { name: 'studio_file',       pattern: '/project/:projectId/studio/data/storage/:bucketId/file/:fileId' },
  { name: 'studio_storage',    pattern: '/project/:projectId/studio/data/storage/:bucketId' },

  // Studio — Compute group
  { name: 'studio_execution',     pattern: '/project/:projectId/studio/compute/functions/:fnId/execution/:execId' },
  { name: 'studio_function_code', pattern: '/project/:projectId/studio/compute/functions/:fnId/code' },
  { name: 'studio_function',      pattern: '/project/:projectId/studio/compute/functions/:fnId' },
  { name: 'studio_site',          pattern: '/project/:projectId/studio/compute/sites/:siteId' },

  // Studio — Auth group
  { name: 'studio_team', pattern: '/project/:projectId/studio/auth/teams/:teamId' },

  // Studio — generic
  { name: 'studio_section', pattern: '/project/:projectId/studio/:group/:section' },
  { name: 'studio_group',   pattern: '/project/:projectId/studio/:group' },
  { name: 'studio',         pattern: '/project/:projectId/studio' },

  // Fallbacks
  { name: 'project', pattern: '/project/:projectId' },
  { name: 'root',    pattern: '/' }
] as const;
```

### 8.2 `routes` builder (new export in `services/router.tsx`)

```ts
export const routes: {
  landing:  () => string;
  login:    () => string;
  projects: () => string;

  agent:             (projectId: string) => string;
  agentDatabase:     (projectId: string, dbId: string) => string;
  agentCollection:   (projectId: string, dbId: string, collId: string) => string;
  agentStorage:      (projectId: string, bucketId: string) => string;
  agentFunction:     (projectId: string, fnId: string) => string;
  agentFunctionCode: (projectId: string, fnId: string) => string;

  /** Canonical path for any section, group segment inserted from the registry. */
  studioSection:    (projectId: string, section: StudioTab) => string;
  studioDatabase:   (projectId: string, dbId: string) => string;
  studioCollection: (projectId: string, dbId: string, collId: string) => string;
  studioDocument:   (projectId: string, dbId: string, collId: string, docId: string) => string;
  studioStorage:    (projectId: string, bucketId: string) => string;
  studioFile:       (projectId: string, bucketId: string, fileId: string) => string;
  studioFunction:     (projectId: string, fnId: string) => string;
  studioFunctionCode: (projectId: string, fnId: string) => string;
  studioExecution:    (projectId: string, fnId: string, execId: string) => string;
  studioSite: (projectId: string, siteId: string) => string;
  studioTeam: (projectId: string, teamId: string) => string;
};
```

### 8.3 Legacy → canonical URL map (produced by `rewriteLegacyPath`, asserted in `services/router.test.ts`)

| Legacy path (still bookmarked) | Canonical path |
|---|---|
| `/project/:p/studio/overview` | *(unchanged — `overview` is a group id)* |
| `/project/:p/studio/database[/…]` | `/project/:p/studio/data/database[/…]` |
| `/project/:p/studio/storage[/…]` | `/project/:p/studio/data/storage[/…]` |
| `/project/:p/studio/erd` | `/project/:p/studio/data/erd` |
| `/project/:p/studio/functions[/…]` | `/project/:p/studio/compute/functions[/…]` |
| `/project/:p/studio/sites[/…]` | `/project/:p/studio/compute/sites[/…]` |
| `/project/:p/studio/users` | `/project/:p/studio/auth/users` |
| `/project/:p/studio/teams[/…]` | `/project/:p/studio/auth/teams[/…]` |
| `/project/:p/studio/messaging` | `/project/:p/studio/integrations/messaging` |
| `/project/:p/studio/webhooks` | `/project/:p/studio/integrations/webhooks` |
| `/project/:p/studio/health` | `/project/:p/studio/operations/health` |
| `/project/:p/studio/migrations` | `/project/:p/studio/operations/migrations` |
| `/project/:p/studio/backups` | `/project/:p/studio/operations/backups` |
| `/project/:p/studio/project-settings` | `/project/:p/studio/settings` *(collapsed group)* |
| `/project/:p/agent/function/:fnId[/code]` | `/project/:p/agent/functions/:fnId[/code]` |

---

## 9. Dependencies

Dev-only; declared in the single root `package.json` (this is not a monorepo). No runtime dependency changes.

```
npm install -D vitest@^4.1.10 @testing-library/react@^16.3.2 @testing-library/jest-dom@^7.0.0 jsdom@^30.0.1
```

Compatibility verified against the installed toolchain: `vitest@4` peers `vite ^6.0.0 || ^7.0.0 || ^8.0.0` (repo has `vite@6.4.2`) and `@types/node ^22` (repo has `^22.14.0`); `@testing-library/jest-dom@7.0.0` exposes the `./vitest` entry point the setup file imports; `@testing-library/react@16` supports React 19.

`package.json` `scripts` gains exactly one line: `"test": "vitest run"`.

`tsconfig.json` needs **no change** as written: tests import `describe`/`it`/`expect` explicitly from `vitest` (so `globals` stays `false`), and `test/setup.ts`'s `import '@testing-library/jest-dom/vitest'` augments vitest's `Assertion` interface from inside the compiled program. *Contingency:* if `npx tsc --noEmit` reports `toBeInTheDocument` as unknown, add `"@testing-library/jest-dom"` to `compilerOptions.types` alongside `"node"` — that is the only permitted `tsconfig.json` edit in this plan.

---

## 10. Testing & Verification

The repo has **no existing tests** and **no pre-existing failures** — `npm run typecheck` and `npm run build` are both green at `c5d3215`. The four `vite build` warnings recorded in §3.1 are pre-existing; F26 removes three of them and the >500 kB chunk warning remains (out of scope).

**Phase check** (a phase V — seconds):
- `npx tsc --noEmit` — clean.
- `npx vitest run <only the test file(s) that phase touched>` — green.

**Gate** (the finish, run once): `npm run typecheck && npm test && npm run build` — all three exit 0.

**Every behavioural criterion in this plan is written as an assertion, not a click-path:**

| Finding | The assertion that proves it |
|---|---|
| F1, F6 | `services/studioNav.test.ts` — every `StudioTab` maps to exactly one group. `components/studio/StudioShell.test.tsx` — each registry section renders its registered panel; an unknown URL segment lands on `overview`. |
| F2 | `hooks/useToast.test.tsx` — a component calling `toast.error('boom')` inside `ToastProvider` puts `boom` in the document. |
| F3 | `test/no-native-dialogs.test.ts` — zero `alert(`/`confirm(`/`prompt(` matches under `components/`, `hooks/`, `services/`, `tools/`. **Demonstrate it red first** (8 matches at `c5d3215`). `hooks/useConfirm.test.tsx` — resolves `true`/`false` and mounts one dialog at a time. |
| F4, F5 | `services/router.test.ts` — `routes.agentFunctionCode('p','f')` round-trips through `matchRoute` to `agent_function_code`; the same round-trip is asserted for all 20 builders. |
| F7 | `services/projectAdminService.test.ts` — a rejecting call makes `getProjectUsage` resolve to `null`, never to a number. |
| F8 | `components/LeftSidebar.test.tsx` — with `geminiModel: 'gemini-3-flash'`, the "Deep Thinking" toggle is in the rendered tree. |
| F9 | `components/studio/hooks/useStudioActions.test.ts` — `handleCreateMembership` passes `window.location.origin`, and the string `http://localhost` appears nowhere in the call. |
| F16 | Covered by `npx tsc --noEmit`: the corrected `() => void` return type makes the two `useEffect` returns type-check honestly. |
| F13, F14, F15, F21, F26 | Covered by `npx tsc --noEmit` (removed symbols have no remaining references) plus the gate's `npm run build` (three `vite:reporter` warnings gone). |
| F10, F11, F12, F17, F18, F19, F20, F22, F23, F24, F25 | `components/studio/StudioShell.test.tsx` and the per-file tests named in §7 assert the observable state change (list refreshed, single modal instance, Escape does not clear the selection while a dialog is registered, `sites.write` present in the scopes list). |

**No manual/human checks are required by this plan.**

---

## 11. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| A bookmarked Studio URL breaks because a legacy path was missed | Med | `rewriteLegacyPath` is derived from the registry, not a hand-written list, so it covers every section by construction; §8.3's 15 rows are asserted in `services/router.test.ts`. |
| `ROUTE_PATTERNS` ordering regression — `studio_section` shadowing a specific pattern | Med | The generic `:group/:section` pattern matches exactly two segments after `studio`, while every specific studio pattern has three or more; asserted by the round-trip case for all 19 builders. |
| Tests fail at import time because `services/appwrite.ts` builds a `Client` at module scope with an undefined endpoint | High | `vite.config.ts`'s `test.env` block supplies dummy `VITE_APPWRITE_*` values (§7). Component tests that touch a tab additionally `vi.mock('…/services/appwrite')`. |
| The registry refactor silently drops a panel's props, so a tab renders but does nothing | Med | The dispatch change keeps each section's existing prop object verbatim; `StudioShell.test.tsx` asserts every registry section renders its registered panel. |
| Toast/Confirm provider conversion misses a `useToast()` consumer and it throws at runtime | Low | `useToast()` keeps its exact signature and all 7 call sites are enumerated in §3.2; the provider throws a *named* error when unmounted, and `hooks/useToast.test.tsx` asserts that message. |
| Vitest's jsdom environment is slower or flakier than expected on a 24 k-line SPA | Low | Only the ~12 named test files are added; phase Vs run single files, not the suite. |
| Another agent edits a shared file concurrently | Med | Each phase's *Writes* list in `tasks.md` is exact; stage only those paths. |
| **Security** | — | The only security-relevant change is F9: team-invite redirect URLs move from the hardcoded `http://localhost` to `window.location.origin`, which is the deploy origin the user is already authenticated against — no new redirect surface, and the value is never user-supplied. Nothing else in this plan touches auth, secrets, permissions or data access. API keys stay in the `projects` collection exactly as today; the plan introduces no new env var and prints no secret. Note the pre-existing (out-of-scope) exposure recorded in §12. |

---

## 12. Deferred / Out-of-Scope Findings

- **`OverviewTab.tsx:99` puts the project's admin API key on the clipboard** via `<CopyButton text={activeProject.apiKey} />` behind a masked display. Real, but it is a product decision (the key is the user's own), not a defect this plan was scoped to.
- **`Header.tsx:7` imports `react-icons/ri` directly**, bypassing `components/Icons.tsx` (contra `CONTEXT.md` §6). One line, unrelated to this plan's owners.
- **The 1.33 MB single bundle** (`vite build` >500 kB warning). Genuine code-splitting is its own plan; F26 only removes the *pointless* dynamic imports.
- **`services/backupService.ts` restore path** — already flagged as deferred by `.plans/2026-07-21-ops-orchestrator/` §13.
- **`.plans/2026-07-21-ops-orchestrator/`** adds new Studio tabs. It is untouched (all 101 tasks `[ ]`). After this plan lands, its Studio-tab tasks must register sections in `services/studioNav.ts` + `components/studio/navigation.tsx` instead of the seven places it currently assumes; that plan needs a revision note, which this plan does not write.

---

## 13. Requirements Coverage

**Navigation & reorganisation (N)**

| Req | Requirement | Changes by File | Tasks | Status |
|---|---|---|---|---|
| N1 | One module owns Studio group/section structure, ids, labels and order | `services/studioNav.ts`, `types.ts` | T2.1, T2.2 | Covered |
| N2 | One module binds each section to its icon and panel component | `components/studio/navigation.tsx` | T2.3 | Covered |
| N3 | Top nav renders 6 primary groups + a trailing Settings gear + Sync | `components/studio/ui/StudioNavBar.tsx` | T5.2 | Covered |
| N4 | A sub-section row renders the active group's sections (nothing when collapsed) | `components/studio/ui/StudioSubNav.tsx` | T5.3 | Covered |
| N5 | Grouped URL scheme `/studio/:group[/:section][/drill-down]` | `services/router.tsx` §8.1 | T3.1 | Covered |
| N6 | Every legacy Studio URL and the Agent `function` segment rewrite to canonical | `services/router.tsx` §8.3 | T3.2, T3.7 | Covered |
| N7 | All 34 hand-built path strings go through typed `routes.*` builders | `services/router.tsx`, `AgentApp.tsx`, `Studio.tsx`, `useStudioData.ts`, `useAppContext.ts` | T3.3, T3.4 | Covered |
| N8 | Left sidebar Studio nav is driven by the same registry | `components/LeftSidebar.tsx` | T5.5 | Covered |
| N9 | `Studio.tsx` dispatches panels from the registry, not a 14-branch switch | `components/Studio.tsx` | T5.6 | Covered |
| N10 | Unknown group/section/route redirects to a valid route | `services/router.tsx`, `App.tsx`, `components/AgentApp.tsx` | T3.5, T3.6 | Covered |
| N11 | One shared page frame owns Studio tab headers | `components/studio/ui/TabShell.tsx`, all 14 tabs | T5.4, T5.7 | Covered |

**Defects (F)**

| Req | Requirement | Changes by File | Tasks | Status |
|---|---|---|---|---|
| F1 | Tab registry duplication removed | `services/studioNav.ts`, `StudioNavBar.tsx`, `LeftSidebar.tsx`, `Studio.tsx`, `AgentApp.tsx` | T2.1–T2.3, T3.6, T5.2, T5.5, T5.6 | Covered |
| F2 | Toasts from every component are rendered | `hooks/useToast.tsx`, `index.tsx`, `Studio.tsx` | T4.1, T4.3, T4.6 | Covered |
| F3 | One confirmation mechanism; zero native dialogs | `hooks/useConfirm.tsx`, `test/no-native-dialogs.test.ts`, `useStudioModals.ts`, `AgentApp.tsx`, 3 tabs, 2 modals, `BackupsTab.tsx`, `MigrationsTab.tsx` | T4.0, T4.2, T4.4, T4.5, T4.6, T4.7, T4.8 | Covered |
| F4 | Agent-mode code-editor deep link resolves | `services/router.tsx`, `components/AgentApp.tsx` | T3.1, T3.3, T3.7 | Covered |
| F5 | `buildUrl` absorbed; no hand-built path strings remain | `services/router.tsx` + the 4 call-site files | T3.1, T3.3, T3.4, T3.7 | Covered |
| F6 | Unknown tab / not-found never renders blank | `services/router.tsx`, `App.tsx`, `Studio.tsx` | T3.5, T3.6, T5.6 | Covered |
| F7 | Usage statistics are never fabricated | `services/projectAdminService.ts`, `OverviewTab.tsx` | T6.1 | Covered |
| F8 | Deep Thinking toggle reachable on `gemini-3-flash` | `components/LeftSidebar.tsx` | T6.2 | Covered |
| F9 | Team invites use the deploy origin | `useStudioActions.ts` | T6.3 | Covered |
| F10 | Snapshot list refreshes after delete/restore | `useStudioActions.ts`, `BackupsTab.tsx`, `Studio.tsx` | T6.4 | Covered |
| F11 | Migration resume button actually resumes | `MigrationsTab.tsx` | T6.5 | Covered |
| F12 | Transfer refreshes the affected lists at all 3 mount sites | `DatabasesTab.tsx` | T6.6 | Covered |
| F13 | Dead redeploy props and buttons removed | `FunctionsTab.tsx` | T6.7 | Covered |
| F14 | Unused `activeTools` prop removed | `Studio.tsx`, `AgentApp.tsx` | T6.7 | Covered |
| F15 | Orphaned modules, exports and imports removed | `ExecutionLog.tsx`(del), `ProjectContextSelector.tsx`(del), `Icons.tsx`, `realtimeService.ts`, `projectAdminService.ts`, `useStudioActions.ts`, `AgentApp.tsx` | T3.3, T6.11 | Covered |
| F16 | `addEventListener` correctly named and typed | `hooks/useRealtime.ts`, `AgentApp.tsx`, `Studio.tsx` | T6.8 | Covered |
| F17 | `closeModal` no longer monkey-patched | `useStudioModals.ts`, `Studio.tsx` | T4.4 | Covered |
| F18 | One query builder; dead client-search path removed | `useStudioData.ts`, `usePaginatedQuery.ts` | T6.9 | Covered |
| F19 | Studio drill-down fetches collections once | `hooks/useAppContext.ts`, `AgentApp.tsx` | T6.10 | Covered |
| F20 | Deep-link modal is created once per param change | `Studio.tsx` | T5.8 | Covered |
| F21 | `CONTEXT.md` matches the codebase | `CONTEXT.md` | T6.12 | Covered |
| F22 | One page frame; no double wrappers | `TabShell.tsx`, all 14 tabs | T5.4, T5.7 | Covered |
| F23 | `ALL_SCOPES` includes Sites scopes | `ProjectSettingsTab.tsx` | T6.7 | Covered |
| F24 | Bulk handlers live in `useStudioActions` and surface errors | `Studio.tsx`, `useStudioActions.ts` | T6.3 | Covered |
| F25 | Escape does not deselect behind an open dialog | `Studio.tsx`, `Modal.tsx` | T5.9 | Covered |
| F26 | No pointless dynamic imports | `Studio.tsx`, `ErdTab.tsx`, `OverviewTab.tsx`, `DatabasesTab.tsx` | T6.11 | Covered |

---

## 14. Open Questions / Review Required

- [x] **`ALL_SCOPES` beyond Sites.** — proceeding with default (build, 2026-07-30): only `sites.read`/`sites.write` are added; the existing `messaging.*` entries are left untouched. `ProjectSettingsTab.tsx:13-33` also lists `messaging.read`/`messaging.write`, which do not match the per-resource scope names Appwrite uses for the Messaging API (`providers.*`, `topics.*`, `subscribers.*`, `messages.*`, `targets.*`). The plan only *adds* `sites.read`/`sites.write` (F23) and leaves the rest untouched. *(Plan assumes the existing entries stay as-is; correcting them needs the exact scope list from the target server's Appwrite version, which the implementer should confirm before changing.)*
- [x] **Group label wording.** — proceeding with default (build, 2026-07-30): `Data · Compute · Auth · Integrations · Operations` as written. `Data · Compute · Auth · Integrations · Operations` were chosen to match Appwrite Console's own vocabulary. *(Plan assumes these exact labels; changing them is a one-line edit in `services/studioNav.ts` and does not affect URLs, which use the group **ids**.)*
- [x] **`erd`'s section label.** — proceeding with default (build, 2026-07-30): "Schema (ERD)". Rendered as "Schema (ERD)" under Data. *(Plan assumes that label; the id `erd` and its URL segment are unchanged either way.)*
- [x] **Refresh shortcut.** — proceeding with default (build, 2026-07-30): `Shift+R`. F25 changes the bare `r` refresh key to `Shift+R` because a single unmodified letter fires from anywhere on the page. *(Plan assumes `Shift+R`; say so if you want the bare `r` kept.)*
