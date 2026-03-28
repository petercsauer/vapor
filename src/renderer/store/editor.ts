import { create } from "zustand";
import { vapor } from "../api/vapor";

export interface OpenFile {
  path: string;
  content: string;
  dirty: boolean;
  language: string;
  remoteHost?: string | null;
}

export function fileKey(path: string, remoteHost?: string | null): string {
  return remoteHost ? `${remoteHost}:${path}` : path;
}

export function parseFileKey(key: string): { path: string; remoteHost: string | null } {
  const colonIdx = key.indexOf(":");
  if (colonIdx > 0 && !key.startsWith("/")) {
    return { remoteHost: key.slice(0, colonIdx), path: key.slice(colonIdx + 1) };
  }
  return { path: key, remoteHost: null };
}

interface EditorState {
  openFiles: Record<string, OpenFile>;
  tabOrder: string[];
  activeFile: string | null;

  openFile: (filePath: string, remoteHost?: string | null) => Promise<OpenFile | null>;
  activateFile: (filePath: string) => void;
  closeTab: (filePath: string) => void;
  saveFile: (filePath: string) => Promise<void>;
  closeFile: (filePath: string) => void;
  setContent: (filePath: string, content: string) => void;
  setDirty: (filePath: string, dirty: boolean) => void;
  reloadFile: (filePath: string) => Promise<void>;
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    json: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    go: "go",
    rs: "rust",
    cpp: "cpp",
    c: "c",
    h: "cpp",
    hpp: "cpp",
    java: "java",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    toml: "toml",
    xml: "xml",
    sql: "sql",
    graphql: "graphql",
    dockerfile: "dockerfile",
    makefile: "makefile",
    txt: "plaintext",
  };
  return map[ext] || "plaintext";
}

export const useEditorStore = create<EditorState>((set, get) => ({
  openFiles: {},
  tabOrder: [],
  activeFile: null,

  openFile: async (filePath: string, remoteHost?: string | null) => {
    const key = fileKey(filePath, remoteHost);
    const prevActiveFile = get().activeFile;
    const prevTabOrder = get().tabOrder;

    set((s) => ({
      activeFile: key,
      tabOrder: s.tabOrder.includes(key) ? s.tabOrder : [...s.tabOrder, key],
    }));

    const existing = get().openFiles[key];
    if (existing) return existing;

    try {
      const content = remoteHost
        ? await vapor.fs.remote.readFile(remoteHost, filePath)
        : await vapor.fs.readFile(filePath);
      const language = detectLanguage(filePath);
      const file: OpenFile = {
        path: filePath, content, dirty: false, language,
        ...(remoteHost ? { remoteHost } : {}),
      };

      set((s) => ({
        openFiles: { ...s.openFiles, [key]: file },
      }));
      return file;
    } catch (err) {
      console.error("Failed to open file:", err);
      if (get().activeFile === key) {
        set({ activeFile: prevActiveFile, tabOrder: prevTabOrder });
      }
      return null;
    }
  },

  activateFile: (filePath: string) => {
    set({ activeFile: filePath });
  },

  closeTab: (filePath: string) =>
    set((s) => {
      const newOrder = s.tabOrder.filter((p) => p !== filePath);
      const copy = { ...s.openFiles };
      delete copy[filePath];

      let newActive = s.activeFile;
      if (s.activeFile === filePath) {
        const idx = s.tabOrder.indexOf(filePath);
        newActive = newOrder[Math.min(idx, newOrder.length - 1)] ?? null;
      }

      return {
        openFiles: copy,
        tabOrder: newOrder,
        activeFile: newActive,
      };
    }),

  saveFile: async (filePath: string) => {
    const file = get().openFiles[filePath];
    if (!file) return;
    if (file.remoteHost) {
      await vapor.fs.remote.writeFile(file.remoteHost, file.path, file.content);
    } else {
      await vapor.fs.writeFile(file.path, file.content);
    }
    set((s) => ({
      openFiles: {
        ...s.openFiles,
        [filePath]: { ...s.openFiles[filePath], dirty: false },
      },
    }));
  },

  closeFile: (filePath: string) =>
    set((s) => {
      const copy = { ...s.openFiles };
      delete copy[filePath];
      return {
        openFiles: copy,
        tabOrder: s.tabOrder.filter((p) => p !== filePath),
        activeFile: s.activeFile === filePath ? (s.tabOrder.find((p) => p !== filePath) ?? null) : s.activeFile,
      };
    }),

  setContent: (filePath: string, content: string) =>
    set((s) => {
      const existing = s.openFiles[filePath];
      if (!existing) return s;
      return {
        openFiles: {
          ...s.openFiles,
          [filePath]: { ...existing, content, dirty: true },
        },
      };
    }),

  setDirty: (filePath: string, dirty: boolean) =>
    set((s) => {
      const existing = s.openFiles[filePath];
      if (!existing) return s;
      return {
        openFiles: {
          ...s.openFiles,
          [filePath]: { ...existing, dirty },
        },
      };
    }),

  reloadFile: async (filePath: string) => {
    try {
      const file = get().openFiles[filePath];
      if (!file) return;
      const content = file.remoteHost
        ? await vapor.fs.remote.readFile(file.remoteHost, file.path)
        : await vapor.fs.readFile(file.path);
      set((s) => {
        const existing = s.openFiles[filePath];
        if (!existing) return s;
        return {
          openFiles: {
            ...s.openFiles,
            [filePath]: { ...existing, content, dirty: false },
          },
        };
      });
    } catch {
      // file may have been deleted
    }
  },
}));
