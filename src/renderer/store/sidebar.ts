import { create } from "zustand";
import type { FsEntry } from "../../shared/types";
import { vapor } from "../api/vapor";

interface DirCache {
  entries: FsEntry[];
  fetchedAt: number;
}

interface SidebarState {
  width: number;
  pinnedPath: string | null;
  dirCache: Record<string, DirCache>;
  expandedDirs: Set<string>;
  currentRemoteHost: string | null;

  setPinnedPath: (path: string | null) => void;
  setWidth: (width: number) => void;
  invalidateDir: (path: string) => void;
  loadDir: (path: string) => Promise<FsEntry[]>;
  toggleExpanded: (path: string) => void;
  setExpanded: (path: string, expanded: boolean) => void;
  expandToPath: (rootPath: string, targetPath: string) => Promise<void>;
  setRemoteHost: (host: string | null) => void;
}

const EXCLUDED_NAMES = new Set([
  "node_modules", ".git", "__pycache__", ".DS_Store",
  "dist", "build", ".webpack", ".next", ".cache",
  "out", ".vscode", ".idea",
]);

function filterEntries(entries: FsEntry[], showHidden: boolean): FsEntry[] {
  return entries.filter((e) => {
    if (EXCLUDED_NAMES.has(e.name)) return false;
    if (!showHidden && e.name.startsWith(".")) return false;
    return true;
  });
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  width: 220,
  pinnedPath: null,
  dirCache: {},
  expandedDirs: new Set(),
  currentRemoteHost: null,

  setPinnedPath: (path) => set({ pinnedPath: path }),

  setRemoteHost: (host) => {
    const prev = get().currentRemoteHost;
    if (prev === host) return;
    set({ currentRemoteHost: host, dirCache: {}, expandedDirs: new Set() });
  },

  setWidth: (width) => set({ width: Math.max(140, Math.min(600, width)) }),

  invalidateDir: (path) =>
    set((s) => {
      const copy = { ...s.dirCache };
      const { currentRemoteHost } = get();
      const cacheKey = currentRemoteHost ? `${currentRemoteHost}:${path}` : path;
      delete copy[cacheKey];
      return { dirCache: copy };
    }),

  loadDir: async (dirPath: string) => {
    const { dirCache, currentRemoteHost } = get();
    const cacheKey = currentRemoteHost ? `${currentRemoteHost}:${dirPath}` : dirPath;
    const cached = dirCache[cacheKey];
    if (cached && Date.now() - cached.fetchedAt < 30000) {
      return filterEntries(cached.entries, false);
    }

    try {
      const entries = currentRemoteHost
        ? await vapor.fs.remote.readdir(currentRemoteHost, dirPath)
        : await vapor.fs.readdir(dirPath);
      set((s) => ({
        dirCache: {
          ...s.dirCache,
          [cacheKey]: { entries, fetchedAt: Date.now() },
        },
      }));
      return filterEntries(entries, false);
    } catch {
      return [];
    }
  },

  toggleExpanded: (path) =>
    set((s) => {
      const next = new Set(s.expandedDirs);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { expandedDirs: next };
    }),

  setExpanded: (path, expanded) =>
    set((s) => {
      const next = new Set(s.expandedDirs);
      if (expanded) next.add(path);
      else next.delete(path);
      return { expandedDirs: next };
    }),

  expandToPath: async (rootPath: string, targetPath: string) => {
    if (!targetPath.startsWith(rootPath)) return;
    const relative = targetPath.slice(rootPath.length).replace(/^\//, "");
    if (!relative) return;

    const segments = relative.split("/");
    let current = rootPath;
    const { loadDir, setExpanded } = get();

    for (const seg of segments) {
      await loadDir(current);
      setExpanded(current, true);
      current = current + "/" + seg;
    }
  },
}));
