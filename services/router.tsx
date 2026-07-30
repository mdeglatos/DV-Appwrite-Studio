import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { StudioTab } from '../types';
import {
  SECTION_TO_GROUP,
  isStudioGroupId,
  isStudioTab,
  defaultSectionOf,
  sectionSegments,
} from './studioNav';

// Centralized route definitions.
// ORDER IS SIGNIFICANT: matchRoute returns the first pattern that matches, so the
// most specific patterns must come first.
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

export type RouteName = typeof ROUTE_PATTERNS[number]['name'] | 'not-found';

export interface ParsedRoute {
  name: RouteName;
  path: string;
  params: Record<string, string>;
  queryParams: Record<string, string>;
}

export interface RouterContextValue {
  route: ParsedRoute;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  buildUrl: (name: RouteName, params?: Record<string, string>, queryParams?: Record<string, string>) => string;
}

const RouterContext = createContext<RouterContextValue | null>(null);

const NAVIGATE_EVENT = 'app-navigate';

export function navigate(path: string, options?: { replace?: boolean }) {
  if (options?.replace) {
    window.history.replaceState(null, '', path);
  } else {
    window.history.pushState(null, '', path);
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

function cleanPathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function parseQuery(search: string): Record<string, string> {
  const queryParams: Record<string, string> = {};
  const searchParams = new URLSearchParams(search);
  searchParams.forEach((val, key) => {
    queryParams[key] = val;
  });
  return queryParams;
}

export function matchRoute(pathname: string): { name: RouteName; params: Record<string, string> } {
  for (const { pattern, name } of ROUTE_PATTERNS) {
    const keys: string[] = [];
    const regexStr = '^' + pattern
      .replace(/:([^/]+)/g, (_, key) => {
        keys.push(key);
        return '([^/]+)';
      }) + '$';
    const regex = new RegExp(regexStr);
    const match = pathname.match(regex);
    if (match) {
      const params: Record<string, string> = {};
      keys.forEach((key, idx) => {
        params[key] = decodeURIComponent(match[idx + 1]);
      });
      return { name, params };
    }
  }
  return { name: 'not-found', params: {} };
}

export function buildUrl(name: RouteName, params: Record<string, string> = {}, queryParams: Record<string, string> = {}): string {
  const patternObj = ROUTE_PATTERNS.find(p => p.name === name);
  if (!patternObj) return '/';

  let url = patternObj.pattern as string;
  // Replace parameters
  Object.entries(params).forEach(([key, val]) => {
    url = url.replace(`:${key}`, encodeURIComponent(val));
  });

  // Append query parameters
  const searchParams = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      searchParams.append(key, val);
    }
  });

  const searchStr = searchParams.toString();
  return `${url}${searchStr ? '?' + searchStr : ''}`;
}

/**
 * The single owner of "what is the URL for X".
 * Every builder is implemented on top of `buildUrl`, so `ROUTE_PATTERNS` remains
 * the one source of path shapes — there is no second string-building path.
 */
export const routes = {
  landing:  () => buildUrl('landing'),
  login:    () => buildUrl('login'),
  projects: () => buildUrl('projects'),

  agent:             (projectId: string) => buildUrl('agent', { projectId }),
  agentDatabase:     (projectId: string, dbId: string) => buildUrl('agent_database', { projectId, dbId }),
  agentCollection:   (projectId: string, dbId: string, collId: string) => buildUrl('agent_collection', { projectId, dbId, collId }),
  agentStorage:      (projectId: string, bucketId: string) => buildUrl('agent_storage', { projectId, bucketId }),
  agentFunction:     (projectId: string, fnId: string) => buildUrl('agent_function', { projectId, fnId }),
  agentFunctionCode: (projectId: string, fnId: string) => buildUrl('agent_function_code', { projectId, fnId }),

  /** Canonical path for any section — the group segment comes from the registry. */
  studioSection: (projectId: string, section: StudioTab) =>
    `${buildUrl('studio', { projectId })}/${sectionSegments(section)}`,

  studioDatabase:   (projectId: string, dbId: string) => buildUrl('studio_database', { projectId, dbId }),
  studioCollection: (projectId: string, dbId: string, collId: string) => buildUrl('studio_collection', { projectId, dbId, collId }),
  studioDocument:   (projectId: string, dbId: string, collId: string, docId: string) => buildUrl('studio_document', { projectId, dbId, collId, docId }),
  studioStorage:    (projectId: string, bucketId: string) => buildUrl('studio_storage', { projectId, bucketId }),
  studioFile:       (projectId: string, bucketId: string, fileId: string) => buildUrl('studio_file', { projectId, bucketId, fileId }),

  studioFunction:     (projectId: string, fnId: string) => buildUrl('studio_function', { projectId, fnId }),
  studioFunctionCode: (projectId: string, fnId: string) => buildUrl('studio_function_code', { projectId, fnId }),
  studioExecution:    (projectId: string, fnId: string, execId: string) => buildUrl('studio_execution', { projectId, fnId, execId }),

  studioSite: (projectId: string, siteId: string) => buildUrl('studio_site', { projectId, siteId }),
  studioTeam: (projectId: string, teamId: string) => buildUrl('studio_team', { projectId, teamId }),
};

/**
 * Rewrites a pre-grouping (legacy) path to its canonical form, or returns `null`
 * when the path is already canonical.
 *
 * Entirely derived from `services/studioNav.ts`, so it covers every section by
 * construction rather than by a hand-maintained redirect table. It also
 * normalises the Agent view's old singular `function` segment to `functions`,
 * which is what makes the code-editor deep link resolvable.
 */
export function rewriteLegacyPath(pathname: string): string | null {
  const segments = pathname.split('/');
  // Expected shape: ['', 'project', ':projectId', view, ...rest]
  if (segments.length < 5 || segments[1] !== 'project') return null;

  const prefix = segments.slice(0, 4);
  const view = segments[3];
  const rest = segments.slice(4);

  if (view === 'agent') {
    if (rest[0] !== 'function') return null;
    const next = [...prefix, 'functions', ...rest.slice(1)].join('/');
    return next === pathname ? null : next;
  }

  if (view === 'studio') {
    const first = rest[0];
    // A known group id is already canonical; anything that is not a known
    // section id is not a legacy path either (it falls through to not-found).
    if (!first || isStudioGroupId(first) || !isStudioTab(first)) return null;
    const next = [...prefix, sectionSegments(first), ...rest.slice(1)].join('/');
    return next === pathname ? null : next;
  }

  return null;
}

/**
 * The single replacement for the hand-written route-name → tab switch.
 * Returns `null` when the group or section is unknown, or when the section does
 * not belong to the group named in the path.
 */
export function resolveStudioSection(route: ParsedRoute): StudioTab | null {
  switch (route.name) {
    case 'studio_document':
    case 'studio_collection':
    case 'studio_database':
      return 'database';
    case 'studio_file':
    case 'studio_storage':
      return 'storage';
    case 'studio_execution':
    case 'studio_function_code':
    case 'studio_function':
      return 'functions';
    case 'studio_site':
      return 'sites';
    case 'studio_team':
      return 'teams';
    case 'studio_section': {
      const { group, section } = route.params;
      if (!group || !section || !isStudioGroupId(group) || !isStudioTab(section)) return null;
      return SECTION_TO_GROUP[section] === group ? section : null;
    }
    case 'studio_group': {
      const { group } = route.params;
      if (!group || !isStudioGroupId(group)) return null;
      return defaultSectionOf(group);
    }
    case 'studio':
      return 'overview';
    default:
      return null;
  }
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState(() => cleanPathname(window.location.pathname));
  const [currentSearch, setCurrentSearch] = useState(window.location.search);

  useEffect(() => {
    const handleLocationChange = () => {
      const raw = cleanPathname(window.location.pathname);
      const canonical = rewriteLegacyPath(raw);
      if (canonical) {
        window.history.replaceState(null, '', `${canonical}${window.location.search}${window.location.hash}`);
        setCurrentPath(canonical);
      } else {
        setCurrentPath(raw);
      }
      setCurrentSearch(window.location.search);
    };

    // Run once on mount so a bookmarked legacy URL is normalized before it is matched.
    handleLocationChange();

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener(NAVIGATE_EVENT, handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener(NAVIGATE_EVENT, handleLocationChange);
    };
  }, []);

  const route = useMemo<ParsedRoute>(() => {
    const { name, params } = matchRoute(currentPath);
    const queryParams = parseQuery(currentSearch);
    return {
      name,
      path: currentPath,
      params,
      queryParams
    };
  }, [currentPath, currentSearch]);

  const value = useMemo<RouterContextValue>(() => ({
    route,
    navigate,
    buildUrl
  }), [route]);

  return (
    <RouterContext.Provider value={value}>
      {children}
    </RouterContext.Provider>
  );
};

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}
