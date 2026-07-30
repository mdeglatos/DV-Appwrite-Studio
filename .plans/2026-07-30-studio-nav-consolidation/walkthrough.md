# Walkthrough: Studio Navigation Consolidation & Defect Sweep

> **Status:** Complete
> **2026-07-30** · `main` · Plan: ./implementation_plan.md · Baseline: `c5d3215`

## What was implemented

- **The Studio's 14 flat tabs are now 6 groups plus a Settings gear** — Overview · Data · Compute · Auth · Integrations · Operations · ⚙. Picking a group lands on its first section; a section row appears beneath the group chips for the five groups that have more than one section, and nothing for the two that don't. The left sidebar shows the same structure as a grouped tree, and now lists **all 14** sections (it previously advertised 8, with a different label for Users).
- **URLs carry the group**: `/project/:id/studio/data/database/db1/collection/c1`, `/project/:id/studio/operations/health`, `/project/:id/studio/settings`. **Every pre-existing bookmark still resolves** — a registry-derived rewrite normalises `/studio/<section>/…` to its grouped form before matching and `replaceState`s the canonical URL.
- **Adding a Studio section is now a 2-file registration** (`services/studioNav.ts` + `components/studio/navigation.tsx`) instead of edits in seven places. Both are typed `Record<StudioTab, …>`, so forgetting one is a compile error — verified by deleting an entry and observing `TS2741`.
- **The code editor opens in Agent mode again.** `AgentApp` built `/agent/functions/:fnId/code` while the router declared `/agent/function/…`, so the Header's code button navigated to `not-found` and the sidebar never opened. Both now come from `routes.agentFunctionCode`.
- **An unknown URL can no longer render a blank screen** — an unmatched route redirects, and an unknown group/section falls back to Overview.
- **Toasts from six components are visible for the first time.** `useToast` was local state with a single `<ToastContainer>` bound to Studio's own instance; HealthTab's "Health Audit Failed", MessagingTab's "Broadcast failed" and four others went nowhere. One container now mounts at the app root.
- **One confirmation mechanism.** Three competing local implementations plus `AgentApp`'s own state are gone, and the eight banned `alert()` calls are toasts. A source-scanning guard test enforces the ban.
- **The Overview tab no longer displays fabricated numbers.** `getProjectUsage` returned `Math.random()`-derived bandwidth/storage and a hardcoded `users: 142` whenever the call failed, rendered as live gauges against invented "1 GB Limit" ceilings. It now returns `null` and the tab says the statistics are unavailable.
- Plus: Deep Thinking is reachable again (it was gated on a model this app never offers), team invites point at the deploy origin instead of `http://localhost`, the snapshot list refreshes after delete/restore, the migration "Resume from Checkpoint" button actually resumes, document transfers refresh their lists at all three mount sites, Escape no longer clears the selection behind an open dialog, and the refresh shortcut moved from a bare `r` to `Shift+R`.

## Deviations from the plan

Five, each mirrored by a `Revised:` line in the plan header or a note on its task:

1. **T1.2's Done-when was wrong.** Vitest 4 exits 1 on a run with no test files unless `passWithNoTests` is set, which the plan doesn't add. T1.3 supplies the first test file; criterion reworded.
2. **F11's prescribed fix would not have worked.** The plan said to point the config-step "Resume from Checkpoint" button at `handleExecute(true)` — but that function opens with `if (!plan) return`, and `plan` is always null at the config step, so the button would have stayed a no-op. The checkpoint stores *progress*, not the plan, so it now scans first and then executes with `resume=true` (`handleResumeFromConfig`).
3. **F15 listed a live symbol as dead.** `projectAdminService.updateGlobalVariable` is called from `tools/projectAdminTools.ts:107`; removing it broke the typecheck (`TS2551`). Kept. `updateAuthProvider` and `realtimeService.getEventAction` were genuinely orphaned and are gone.
4. **F26's inventory missed a fourth pointless dynamic import.** After the three named ones were fixed, `tools/databaseTools.ts:511` still dynamically imported `databaseToolsService`, which is statically imported by two tabs — so the `vite:reporter` warning survived. Made static; the build now emits none.
5. **T6.1's Done-when was too broad** ("`Math.random` appears nowhere in `services/`"). `databaseToolsService.generateMockField` uses it deliberately to seed mock documents. Narrowed to the file F7 actually names.

One structural adjustment inside the plan's approach: `Studio.tsx` now calls `useStudioData` **before** `useStudioModals`, because the route-aware `onAfterClose` reads the current selections. The data hook never depended on the modals hook, so the reorder is safe.

## Decisions made

- **Adopted all four Open-Question defaults:** only `sites.read`/`sites.write` added to `ALL_SCOPES` (the existing `messaging.*` entries left alone, pending the target server's scope list); group labels `Data · Compute · Auth · Integrations · Operations`; `erd` labelled "Schema (ERD)"; refresh shortcut `Shift+R`.
- **`STUDIO_SECTION_UI` is declared with `satisfies` rather than a plain annotation.** The plan's `Record<StudioTab, {icon, Panel}>` annotation would have widened every `Panel` to `ComponentType<any>`, silently discarding prop typechecking for all 14 panels during the dispatch refactor — precisely the risk the plan's own §11 flags ("the registry refactor silently drops a panel's props"). `satisfies` keeps exhaustiveness *and* concrete component types, so `Studio.tsx`'s `sectionProps` map is checked panel-by-panel by the compiler.
- **`confirmAction` catches a rejecting callback and reports it via `toast.error("Action Failed: …")`.** The dynamic `Modal`'s confirm button used to own that error path; routing confirmations through `useConfirm` would otherwise have turned an SDK failure into an unhandled rejection across all 29 call sites.
- **`Studio.tsx` keeps its `const toast = useToast()` line.** It is now a context read rather than local state, and it feeds `useStudioActions(…, toast)`; removing it would have forced a signature change on `useStudioActions` that the plan doesn't scope.
- **`BackupsTab` publishes its refresh upward** via an `onRegisterRefresh` callback (registered on mount, withdrawn on unmount) rather than Studio reaching into the tab. The plan said "or equivalent".
- **The native-dialog guard was refined after the fixes landed.** The plan's naive `/\b(alert|confirm|prompt)\s*\(/` also matches the *sanctioned* `confirm(...)` from `useConfirm()`. It now bans bare `alert(`/`prompt(` and `window.<dialog>(` unconditionally, and bare `confirm(` only in files that don't obtain one from `useConfirm()`; comments are stripped first, and a third case proves the detector isn't vacuous.

## Verification evidence

- **Final gate:** `npm run typecheck` → exit 0, clean · `npm test` → **149 passed across 11 files**, exit 0 · `npm run build` → exit 0, `built in 10.58s`, `dist/assets/index-*.js 1,328.70 kB`.
- **Pre-existing failures:** none recorded at `c5d3215`, and none introduced. Of the four `vite build` warnings at baseline, the **three** `vite:reporter` static/dynamic-import warnings are gone (F26); the ">500 kB chunk" warning remains and is explicitly out of scope (*Plan › §12*).
- **Conformance & coverage:** the diff maps 1:1 to *Plan › Changes by File* — two deletions, 38 modifications, 17 additions, plus `tools/databaseTools.ts` (deviation 4) and `package-lock.json` (a consequence of the dependency install). **All 37 requirements (N1–N11, F1–F26) implemented and verified; 0 deferred.** Each row was re-checked against the actual source at the finish, not against its task's checkbox.
- **Guards demonstrated red before the fix**, as the plan required:
  - `test/no-native-dialogs.test.ts` listed exactly the 8 predicted `alert()` sites (`ConsolidateBucketsModal.tsx:235,243,247,252`, `BackupsTab.tsx:104`, `MigrationsTab.tsx:117,135`, `TransferDocumentsModal.tsx:143`) before T4.7, then went green.
  - `services/router.test.ts` — restoring the old singular `agent/function/:fnId/code` pattern turned 2 cases red (2 failed | 58 passed); restored → 60 passed. **This is the F4 regression test.**
  - `components/LeftSidebar.test.tsx` — restoring `modelInput === 'gemini-2.5-flash'` turned the Deep Thinking case red; restored → 5 passed.
  - `services/studioNav.ts` — deleting the `'erd'` entry from `SECTION_TO_GROUP` produced `TS2741` (exit 2); restored → exit 0.
- **Behavioural checks** (each look-and-see criterion converted to an assertion):
  - *"each section renders its panel"* → `StudioShell.test.tsx` renders `Studio` at all **14** sections against a mocked SDK and asserts each panel's own first-paint text; the marker map is itself asserted to cover exactly the registry's keys.
  - *"Escape does not deselect behind a dialog"* → same file: with a `Modal` mounted, Escape leaves `window.location.pathname` at the drill-down URL; without one, it navigates back to the section. A bare `r` no longer refreshes; `Shift+R` does.
  - *"the modal is created once per param change"* → renders at an execution deep link, re-renders three times with unrelated prop churn, asserts exactly one "Execution Details" dialog.
  - *"toasts are visible"* → `useToast.test.tsx`: a component that mounts no container of its own puts `boom` in the document; the queue caps at 5; a provider-less render throws the named error.
  - *"one confirmation dialog"* → `useConfirm.test.tsx`: resolves `true`/`false`/`false` on confirm/cancel/Escape, and a second request supersedes the first with exactly one dialog in the tree and no dangling promise.
  - *"invites use the deploy origin"* → `useStudioActions.test.ts` asserts the argument equals `window.location.origin` (jsdom's origin is itself a localhost URL, so the test also asserts the exact `'http://localhost'` literal appears nowhere in the module).
  - *"usage is never fabricated"* → `projectAdminService.test.ts`: a rejecting call resolves to `null`, twice, identically.
  - No check was left for a human.
- **Commit:** `77e6289` — *Consolidate Studio navigation into 6 groups and sweep 26 defects* (62 files, +5197/−1285). Explicit paths staged only; the unrelated untracked `.plans/2026-07-21-ops-orchestrator/` folder was left alone. **Pushed** to `origin/main` (`c5d3215..77e6289`) after asking.

## Follow-ups / known gaps

Unchanged from *Plan › §12* — none of these were in scope:

- [ ] **`OverviewTab.tsx` copies the project's admin API key to the clipboard** behind a masked display. Real, but a product decision rather than a defect this plan was scoped to.
- [ ] **`Header.tsx:7` imports `react-icons/ri` directly**, bypassing `components/Icons.tsx` (contra `CONTEXT.md` §6).
- [ ] **The 1.33 MB single bundle.** Genuine code-splitting is its own plan; this one only removed the *pointless* dynamic imports.
- [ ] **`services/backupService.ts` restore path** — already flagged as deferred by `.plans/2026-07-21-ops-orchestrator/` §13.
- [ ] **`.plans/2026-07-21-ops-orchestrator/` needs a revision note.** Its Studio-tab tasks (101 `[ ]`, 1 `[-]`) still assume the seven-place registration this plan removed; they should now register sections in `services/studioNav.ts` + `components/studio/navigation.tsx`.
- [ ] **`ALL_SCOPES`' `messaging.read`/`messaging.write` entries** do not match the per-resource scope names Appwrite uses for the Messaging API (`providers.*`, `topics.*`, `subscribers.*`, `messages.*`, `targets.*`). Left as-is per the adopted default; correcting them needs the exact scope list from the target server's version.
