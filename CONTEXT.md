# DV Backend Studio — Project Context

> **The North Star**: DV Backend Studio is an AI-powered Appwrite management IDE that runs entirely in the browser. It uses Gemini AI (via `@google/genai`) to interpret natural language commands and the Appwrite SDK to manage databases, storage, functions, users, teams, and sites across multiple Appwrite projects — all from a single unified interface with an agentic chat, manual dashboards, a code editor, and full migration & backup capabilities.

---

## 1. Project Vision & Product Pillars

### What It Does
A browser-based development studio where users can:
- **Chat-driven management**: Use natural language to create databases, deploy functions, manage users via Gemini AI tool-calling 
- **Manual dashboards**: Browse and manage Appwrite resources (DBs, collections, buckets, functions, users, teams) through a visual Studio UI
- **Code editor**: View and edit Appwrite Function code with syntax highlighting
- **Migrations**: Clone entire Appwrite projects (schema, data, functions, users) between servers
- **Backups**: Export/import project configurations
- **Audit logging**: Track all AI-executed tool calls in IndexedDB

### Multi-Project Model
Users register/login via Appwrite auth on the studio's own backend. Each user can register multiple Appwrite projects (storing endpoint, project ID, and API key). The AI agent and Studio dashboards operate against the **currently selected project**.

---

## 2. The Hard Stack

### ✅ Allowed & Mandated

| Category       | Technology               | Notes                                                   |
|:---------------|:-------------------------|:--------------------------------------------------------|
| Framework      | React 19                 | Functional components, hooks only                       |
| Language       | TypeScript               | Strict types, no `any` unless unavoidable               |
| Build Tool     | Vite 6                   | Dev server on port 3000                                 |
| CSS            | Tailwind CSS (CDN)       | Loaded via `<script>` tag in `index.html`, not installed |
| Fonts          | Inter + JetBrains Mono   | Google Fonts, loaded in `index.html`                    |
| AI             | `@google/genai`          | Gemini 3 Flash/Pro, tool-calling chat sessions          |
| BaaS (own)     | Appwrite (client SDK)    | `appwrite` v18 — auth + project storage                 |
| BaaS (targets) | Appwrite (node SDK)      | `node-appwrite` v17 — admin operations on user projects |
| Icons          | `react-icons`            | Remix Icons (`ri`) primary, some `io5`, `cg`, `fa`      |
| Markdown       | `marked`                 | Rendering AI chat responses                             |
| IndexedDB      | `idb`                    | Audit log persistence                                   |
| Compression    | `pako` + `tar-js`        | Function deployment packaging                           |
| State          | React hooks              | `useState`, `useCallback`, `useEffect`, `useRef`        |

### ❌ Forbidden

| Pattern                  | Reason                                                         |
|:-------------------------|:---------------------------------------------------------------|
| Redux / Zustand / Jotai  | State is managed via hooks — no external state managers        |
| CSS Modules / Styled Comp | Tailwind CDN is the styling system                             |
| `alert()` / `confirm()`  | Use in-app modals (`ConfirmationModal.tsx`)                    |
| Raw `process.env.*`       | Use `import.meta.env.VITE_*` via `config.ts`                  |
| Raw SDK calls in UI       | All Appwrite calls go through `services/` or `tools/`          |
| Server-side rendering     | This is a client-only SPA                                      |

---

## 3. Architectural Patterns

### 📂 Directory Structure

```
DV Backend Studio/
├── index.html         # Entry HTML — Tailwind CDN, fonts, importmap
├── index.tsx          # React mount point
├── App.tsx            # Root component — auth gate + routing
├── config.ts          # Centralized Appwrite config (from env vars)
├── types.ts           # Global type definitions
├── vite.config.ts     # Vite config with env var injection
├── vite-env.d.ts      # Vite env type declarations
├── react-icons.d.ts   # react-icons type augmentation
├── .env.local         # Local environment variables (gitignored)
├── .env.example       # Placeholder env template (committed)
│
├── components/        # All UI components
│   ├── App-level components (AgentApp, LandingPage, LoginPage, etc.)
│   ├── Chat components (ChatInput, ChatMessage, ActionMessage)
│   ├── Layout (Header, LeftSidebar, MainContent, Footer, ContextBar)
│   ├── Modals (Modal, ConfirmationModal, CreateFunctionModal, AuditLogModal)
│   ├── Code (CodeViewer, CodeViewerSidebar)
│   ├── Icons.tsx      # Centralized icon wrappers
│   └── studio/        # Manual dashboard view
│       ├── tabs/      # Tab panels (DatabasesTab, StorageTab, FunctionsTab, SitesTab, etc.)
│       ├── ui/        # Reusable Studio sub-components (ResourceTable, StatCard, etc.)
│       ├── hooks/     # Studio-specific hooks (useStudioActions, useStudioData, useStudioModals)
│       ├── types.ts   # Studio-specific types
│       ├── CollectionSettings.tsx
│       ├── ConsolidateBucketsModal.tsx
│       └── TransferDocumentsModal.tsx
│
├── hooks/             # Global custom hooks
│   ├── useAuth.ts              # Session management
│   ├── useProjects.ts          # CRUD for registered Appwrite projects
│   ├── useAppContext.ts        # Active project context (DBs, collections, buckets, functions)
│   ├── useChatSession.ts       # Gemini chat session lifecycle
│   ├── useSettings.ts          # User preferences (API key, model, tool toggles)
│   ├── useCodeMode.ts          # Code editor state
│   ├── useStudioData.ts        # Data fetching for Studio dashboard tabs
│   └── useDragAndDrop.ts       # File drag & drop handling
│
├── services/          # Backend service layer
│   ├── appwrite.ts             # Appwrite client init, SDK factories, console URL helpers
│   ├── authService.ts          # Login, logout, account, preferences
│   ├── projectService.ts       # CRUD for user's registered projects
│   ├── geminiService.ts        # AI chat session creation & run loop
│   ├── auditLogService.ts      # IndexedDB audit logging
│   ├── backupService.ts        # Export/import Appwrite project configs
│   └── migrationService.ts     # Full project migration engine
│
└── tools/             # AI tool definitions (Gemini function calling)
    ├── index.ts                # Combines all tool groups
    ├── databaseTools.ts        # DB/collection/attribute/index/document tools
    ├── storagTools.ts          # Bucket/file management tools
    ├── functionsTools.ts       # Function/deployment/variable tools
    ├── usersTools.ts           # User management tools
    ├── teamsTools.ts           # Team management tools
    └── sitesTools.ts           # Site/deployment/variable management tools
```

### 🔗 Layer Responsibilities

| Layer        | Location          | Responsibility                                    |
|:-------------|:------------------|:---------------------------------------------------|
| **UI**       | `components/`      | Rendering, user interaction, layout                |
| **Hooks**    | `hooks/`           | State management, side effects, data orchestration |
| **Services** | `services/`        | All Appwrite SDK calls, AI service, IndexedDB      |
| **Tools**    | `tools/`           | AI function-calling definitions + executors        |
| **Config**   | `config.ts`        | Environment variable abstraction                   |
| **Types**    | `types.ts`         | Shared interfaces and type aliases                 |

### Key Architectural Decisions
1. **Dual Appwrite SDK usage**: The `appwrite` (client) SDK handles the studio's own auth & project storage. The `node-appwrite` (server) SDK is used client-side for admin operations against the user's managed projects (via API key auth).
2. **Import maps in `index.html`**: Dependencies are mapped for ESM resolution in the browser via a `<script type="importmap">` — this is a legacy from the Google AI Studio export origin. Vite handles resolution at dev/build time.
3. **Tailwind via CDN**: Tailwind is loaded as a runtime CDN script, not installed via npm. Configuration is inline in `index.html`.
4. **AI tool system**: Each tool module exports both function implementations (callable at runtime) and Gemini `FunctionDeclaration` schemas. The AI calls tools; the runtime routes to the matching function.

---

## 4. Data Model

### Studio's Own Backend (DV Backend Studio Appwrite Project)

The studio uses its own Appwrite backend for:
- **Authentication**: Email/password sessions via `account`
- **Project Registry**: A `projects` collection in database `agent-db`

**Projects Collection** (`agent-db` → `projects`):

| Attribute   | Type   | Notes                    |
|:------------|:-------|:-------------------------|
| `name`      | string | Display name             |
| `endpoint`  | string | Appwrite server URL      |
| `projectId` | string | Target project ID        |
| `apiKey`    | string | Admin API key            |
| `userId`    | string | Owner user ID (indexed)  |

**User Preferences** (stored in Appwrite user prefs):

| Key                | Type    | Notes                              |
|:-------------------|:--------|:-----------------------------------|
| `activeProjectId`  | string  | Currently selected project doc ID  |
| `geminiApiKey`     | string  | User's Gemini API key              |
| `geminiModel`      | string  | Selected model (flash/pro)         |
| `geminiThinking`   | boolean | Enable/disable thinking mode       |
| `activeTools`      | object  | Map of tool name → enabled boolean |
| `sidebarWidth`     | number  | Sidebar pixel width                |

### Managed Projects (User's Appwrite Projects)
The studio accesses these via `node-appwrite` with the user's API key. Resources include databases, collections, attributes, indexes, documents, buckets, files, functions, deployments, variables, executions, users, teams, memberships, and sites (with site deployments and site variables).

---

## 5. Configuration & Environment

### Config Abstraction: `config.ts`

```typescript
// ✅ CORRECT — use the config object
import { appwriteConfig } from './config';
const db = new Databases(client);
db.listDocuments(appwriteConfig.databaseId, appwriteConfig.projectsCollectionId);

// ❌ WRONG — raw env vars or hardcoded IDs
db.listDocuments("agent-db", "projects");
db.listDocuments(import.meta.env.VITE_APPWRITE_DATABASE_ID, ...);
```

### Environment Variables

| Variable                             | Purpose                           | Exposed Via           |
|:-------------------------------------|:----------------------------------|:----------------------|
| `GEMINI_API_KEY`                     | Server-side AI key (fallback)     | Vite `define` block   |
| `VITE_APPWRITE_ENDPOINT`            | Studio's Appwrite server URL      | `import.meta.env`     |
| `VITE_APPWRITE_PROJECT_ID`          | Studio's Appwrite project ID      | `import.meta.env`     |
| `VITE_APPWRITE_DATABASE_ID`         | Studio's internal database ID     | `import.meta.env`     |
| `VITE_APPWRITE_PROJECTS_COLLECTION_ID` | Projects collection ID         | `import.meta.env`     |

---

## 6. Standard Operating Procedures (SOPs)

### Adding a New AI Tool
1. Create the tool function in the appropriate `tools/*.ts` file
2. Add the `FunctionDeclaration` schema to the tool definitions array
3. Export both from the tool module
4. The tool auto-registers via `tools/index.ts`

### Adding a New Studio Tab
1. Create `components/studio/tabs/NewTab.tsx`
2. Add the tab type to `StudioTab` union in `types.ts`
3. Add routing logic in `Studio.tsx`
4. Add the tab button in `StudioNavBar.tsx`
5. Add data fetching logic in `hooks/useStudioData.ts` if needed

### Adding a New Service
1. Create `services/newService.ts`
2. Import SDK factories from `services/appwrite.ts` (e.g., `getSdkDatabases`)
3. Never import `Client` directly — use the factory pattern

### Adding New Icons
1. Import from `react-icons/ri` (preferred) in `components/Icons.tsx`
2. Create a wrapper component following the existing pattern
3. Export from `Icons.tsx` — never import `react-icons` directly in components

---

## 7. The "Do Not Disturb" List

| File                        | Risk Level | Why                                                       |
|:----------------------------|:-----------|:----------------------------------------------------------|
| `config.ts`                 | 🔴 HIGH    | All service layer depends on these IDs                    |
| `services/appwrite.ts`      | 🔴 HIGH    | SDK client init, admin client factory, cache-busting logic |
| `services/geminiService.ts` | 🔴 HIGH    | AI chat/tool loop — complex state machine                 |
| `tools/index.ts`            | 🟡 MEDIUM  | Tool registration hub — changes affect all AI interactions |
| `index.html`                | 🟡 MEDIUM  | Tailwind config, importmap, fonts, body styles             |
| `types.ts`                  | 🟡 MEDIUM  | Shared types — changes cascade to all consumers            |

---

## 8. Type System Overview

### Core Interfaces (from `types.ts`)
- **`Message`** — Union: `UserMessage | ModelMessage | ActionMessage`
- **`AppwriteProject`** — Registered project with credentials
- **`AIContext`** — Current project + selected DB/collection/bucket/function
- **`UserPrefs`** — Extends Appwrite `Models.Preferences` with app-specific keys
- **`Database`**, **`Collection`**, **`Bucket`**, **`AppwriteFunction`** — Appwrite resource types
- **`BackupOptions`** — Toggles for backup scope
- **`StudioTab`** — Union literal: `'overview' | 'database' | 'storage' | 'functions' | 'users' | 'teams' | 'migrations' | 'backups'`

---

## 9. AI System Architecture

### Chat Session Lifecycle
1. User selects a project → `useAppContext` fetches DBs, buckets, functions
2. User selects a context (DB, collection, bucket, function) 
3. `useChatSession` creates a Gemini chat with system instruction + active tools
4. User sends message → `runAI()` sends to Gemini → receives tool calls → executes → loops until done
5. Tool execution is permission-gated: even if Gemini hallucinates a call, disabled tools are blocked

### Gemini Models
- `gemini-3-flash` (default) — fast, supports thinking toggle
- `gemini-3-pro` — more capable

### Tool Categories
| Group       | File                    | Tools Count | Examples                                   |
|:------------|:------------------------|:------------|:-------------------------------------------|
| Database    | `databaseTools.ts`      | ~15         | createDatabase, createCollection, listDocs  |
| Storage     | `storageTools.ts`       | ~8          | createBucket, writeFile, deleteFile         |
| Functions   | `functionsTools.ts`     | ~10         | createFunction, deployNewCode, getVariables |
| Users       | `usersTools.ts`         | ~5          | listUsers, createUser, deleteUser           |
| Teams       | `teamsTools.ts`         | ~4          | listTeams, createTeam, listMemberships      |
| Search      | (built-in)              | 1           | googleSearch (grounding)                    |

---

## 10. Quick Reference Commands

```bash
npm run dev        # Start dev server (port 3000)
npm run build      # Production build
npm run preview    # Preview production build
npm run typecheck  # TypeScript type check (no emit)
```

---

## Appendix: File Quick Links

- [config.ts](file:///d:/Business/Apps/DV%20Backend%20Studio/config.ts) — Centralized configuration
- [types.ts](file:///d:/Business/Apps/DV%20Backend%20Studio/types.ts) — Global type definitions
- [App.tsx](file:///d:/Business/Apps/DV%20Backend%20Studio/App.tsx) — Root component
- [appwrite.ts](file:///d:/Business/Apps/DV%20Backend%20Studio/services/appwrite.ts) — SDK client factory
- [geminiService.ts](file:///d:/Business/Apps/DV%20Backend%20Studio/services/geminiService.ts) — AI service
- [tools/index.ts](file:///d:/Business/Apps/DV%20Backend%20Studio/tools/index.ts) — Tool registry
- [Icons.tsx](file:///d:/Business/Apps/DV%20Backend%20Studio/components/Icons.tsx) — Icon wrappers
