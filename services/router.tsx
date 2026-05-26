import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

// Centralized route definitions
export const ROUTE_PATTERNS = [
  { name: 'landing', pattern: '/landing' },
  { name: 'login', pattern: '/login' },
  { name: 'projects', pattern: '/projects' },
  
  // Agent sub-resources
  { name: 'agent_collection', pattern: '/project/:projectId/agent/database/:dbId/collection/:collId' },
  { name: 'agent_database', pattern: '/project/:projectId/agent/database/:dbId' },
  { name: 'agent_storage', pattern: '/project/:projectId/agent/storage/:bucketId' },
  { name: 'agent_function_code', pattern: '/project/:projectId/agent/function/:fnId/code' },
  { name: 'agent_function', pattern: '/project/:projectId/agent/function/:fnId' },
  { name: 'agent', pattern: '/project/:projectId/agent' },
  
  // Studio sub-resources
  { name: 'studio_document', pattern: '/project/:projectId/studio/database/:dbId/collection/:collId/document/:docId' },
  { name: 'studio_collection', pattern: '/project/:projectId/studio/database/:dbId/collection/:collId' },
  { name: 'studio_database', pattern: '/project/:projectId/studio/database/:dbId' },
  { name: 'studio_file', pattern: '/project/:projectId/studio/storage/:bucketId/file/:fileId' },
  { name: 'studio_storage', pattern: '/project/:projectId/studio/storage/:bucketId' },
  { name: 'studio_execution', pattern: '/project/:projectId/studio/functions/:fnId/execution/:execId' },
  { name: 'studio_function_code', pattern: '/project/:projectId/studio/functions/:fnId/code' },
  { name: 'studio_function', pattern: '/project/:projectId/studio/functions/:fnId' },
  { name: 'studio_site', pattern: '/project/:projectId/studio/sites/:siteId' },
  { name: 'studio_team', pattern: '/project/:projectId/studio/teams/:teamId' },
  { name: 'studio_tab', pattern: '/project/:projectId/studio/:tab' },
  { name: 'studio', pattern: '/project/:projectId/studio' },
  
  // Fallbacks
  { name: 'project', pattern: '/project/:projectId' },
  { name: 'root', pattern: '/' }
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

function matchRoute(pathname: string): { name: RouteName; params: Record<string, string> } {
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

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState(cleanPathname(window.location.pathname));
  const [currentSearch, setCurrentSearch] = useState(window.location.search);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(cleanPathname(window.location.pathname));
      setCurrentSearch(window.location.search);
    };

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
