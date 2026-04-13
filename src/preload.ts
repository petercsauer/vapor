import { contextBridge, ipcRenderer } from "electron";
export type { VaporConfig, PtyInfo, SavedPaneNode, SavedTab, SavedLayout, FsEntry, FsChangeEvent, FsStat, RecentHost, SessionState } from "./shared/types";
import type { VaporConfig, PtyInfo, SavedPaneNode, SavedTab, SavedLayout, FsEntry, FsChangeEvent, FsStat, RecentHost, SessionState } from "./shared/types";

export interface VaporAPI {
  pty: {
    create: (options?: { cwd?: string; command?: string; remoteCwd?: string }) => Promise<{ sessionId: string }>;
    input: (sessionId: string, data: string) => void;
    resize: (sessionId: string, cols: number, rows: number) => void;
    kill: (sessionId: string) => Promise<void>;
    getInfo: (sessionId: string) => Promise<PtyInfo | null>;
    onOutput: (callback: (data: { sessionId: string; data: string }) => void) => () => void;
    onExit: (callback: (data: { sessionId: string; exitCode: number }) => void) => () => void;
    onCommandStatus: (callback: (data: { sessionId: string; exitCode: number | null }) => void) => () => void;
    getContext: (sessionId: string) => Promise<{ cwd: string; processName: string; command: string; remoteCwd: string; remoteHost: string; containerName: string } | null>;
    getState: (sessionId: string) => Promise<SessionState | null>;
    onStateUpdated: (callback: (state: SessionState) => void) => () => void;
  };
  ssh: {
    connect: (host: string) => Promise<{ success: boolean; error?: string }>;
    disconnect: (host: string) => Promise<{ success: boolean; error?: string }>;
    listConnections: () => Promise<{ connections: string[] }>;
  };
  tabNamer: {
    available: () => Promise<boolean>;
    suggest: (context: { cwd: string; processName: string; command: string; remoteCwd?: string; remoteHost?: string }) => Promise<string | null>;
  };
  hosts: {
    listSSHConfigHosts: () => Promise<string[]>;
    listDockerContainers: () => Promise<string[]>;
    getRecent: () => Promise<RecentHost[]>;
    addRecent: (host: { type: "ssh" | "docker"; host: string }) => Promise<void>;
    removeRecent: (host: { type: "ssh" | "docker"; host: string }) => Promise<void>;
  };
  layouts: {
    list: () => Promise<SavedLayout[]>;
    save: (name: string, tabs: SavedTab[]) => Promise<SavedLayout[]>;
    delete: (name: string) => Promise<SavedLayout[]>;
  };
  config: {
    get: () => Promise<VaporConfig>;
    getPath: () => Promise<string>;
    set: (updates: Record<string, unknown>) => Promise<VaporConfig>;
    onUpdated: (callback: (config: VaporConfig) => void) => () => void;
  };
  fs: {
    openFolder: () => Promise<string | null>;
    readdir: (path: string) => Promise<FsEntry[]>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    stat: (path: string) => Promise<FsStat>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
    delete: (path: string) => Promise<void>;
    mkdir: (path: string) => Promise<void>;
    gitRoot: (path: string) => Promise<string | null>;
    watch: (rootPath: string) => void;
    onChanged: (callback: (event: FsChangeEvent) => void) => () => void;
    showInFolder: (path: string) => Promise<void>;
    openPath: (path: string) => Promise<string>;
    copyTo: (sourcePaths: string[], destDir: string) => Promise<void>;
    clipboardCopyPath: (path: string) => Promise<void>;
    remote: {
      readdir: (host: string, path: string) => Promise<FsEntry[]>;
      readFile: (host: string, path: string) => Promise<string>;
      writeFile: (host: string, path: string, content: string) => Promise<void>;
      stat: (host: string, path: string) => Promise<FsStat>;
      rename: (host: string, oldPath: string, newPath: string) => Promise<void>;
      delete: (host: string, path: string) => Promise<void>;
      mkdir: (host: string, path: string) => Promise<void>;
    };
  };
  openExternal: (url: string) => void;
  onMenuAction: (callback: (action: string) => void) => () => void;
  onSwipeTab: (callback: (direction: "left" | "right") => void) => () => void;
  onCliOpenFile: (callback: (data: { filePath: string; direction: "horizontal" | "vertical" }) => void) => () => void;
}

const api: VaporAPI = {
  pty: {
    create: (options?: { cwd?: string; command?: string; remoteCwd?: string }) =>
      ipcRenderer.invoke("pty:create", options),

    input: (sessionId: string, data: string) =>
      ipcRenderer.send("pty:input", { sessionId, data }),

    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.send("pty:resize", { sessionId, cols, rows }),

    kill: (sessionId: string) =>
      ipcRenderer.invoke("pty:kill", { sessionId }),

    getInfo: (sessionId: string) =>
      ipcRenderer.invoke("pty:get-info", { sessionId }),

    onOutput: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; data: string }) =>
        callback(data);
      ipcRenderer.on("pty:output", handler);
      return () => ipcRenderer.removeListener("pty:output", handler);
    },

    onExit: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; exitCode: number }) =>
        callback(data);
      ipcRenderer.on("pty:exit", handler);
      return () => ipcRenderer.removeListener("pty:exit", handler);
    },

    onCommandStatus: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string; exitCode: number | null }) =>
        callback(data);
      ipcRenderer.on("pty:command-status", handler);
      return () => ipcRenderer.removeListener("pty:command-status", handler);
    },

    getContext: (sessionId: string) =>
      ipcRenderer.invoke("pty:get-context", { sessionId }),

    getState: (sessionId: string) =>
      ipcRenderer.invoke("pty:get-state", { sessionId }),

    onStateUpdated: (callback: (state: SessionState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: SessionState) =>
        callback(state);
      ipcRenderer.on("pty:state-updated", handler);
      return () => ipcRenderer.removeListener("pty:state-updated", handler);
    },
  },

  ssh: {
    connect: (host: string) =>
      ipcRenderer.invoke("ssh:connect", { host }),

    disconnect: (host: string) =>
      ipcRenderer.invoke("ssh:disconnect", { host }),

    listConnections: () =>
      ipcRenderer.invoke("ssh:list-connections"),
  },

  tabNamer: {
    available: () => ipcRenderer.invoke("tab-namer:available"),
    suggest: (context: { cwd: string; processName: string; command: string; remoteCwd?: string; remoteHost?: string }) =>
      ipcRenderer.invoke("tab-namer:suggest", context),
  },

  hosts: {
    listSSHConfigHosts: () => ipcRenderer.invoke("hosts:list-ssh-config"),
    listDockerContainers: () => ipcRenderer.invoke("hosts:list-docker-containers"),
    getRecent: () => ipcRenderer.invoke("hosts:get-recent"),
    addRecent: (host: { type: "ssh" | "docker"; host: string }) =>
      ipcRenderer.invoke("hosts:add-recent", host),
    removeRecent: (host: { type: "ssh" | "docker"; host: string }) =>
      ipcRenderer.invoke("hosts:remove-recent", host),
  },

  layouts: {
    list: () => ipcRenderer.invoke("layouts:list"),
    save: (name: string, tabs: SavedTab[]) =>
      ipcRenderer.invoke("layouts:save", { name, tabs }),
    delete: (name: string) => ipcRenderer.invoke("layouts:delete", name),
  },

  config: {
    get: () => ipcRenderer.invoke("config:get"),
    getPath: () => ipcRenderer.invoke("config:get-path"),
    set: (updates: Record<string, unknown>) => ipcRenderer.invoke("config:set", updates),
    onUpdated: (callback: (config: VaporConfig) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, config: VaporConfig) =>
        callback(config);
      ipcRenderer.on("config:updated", handler);
      return () => ipcRenderer.removeListener("config:updated", handler);
    },
  },

  fs: {
    openFolder: () => ipcRenderer.invoke("fs:open-folder"),
    readdir: (path: string) => ipcRenderer.invoke("fs:readdir", path),
    readFile: (path: string) => ipcRenderer.invoke("fs:read-file", path),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke("fs:write-file", path, content),
    stat: (path: string) => ipcRenderer.invoke("fs:stat", path),
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke("fs:rename", oldPath, newPath),
    delete: (path: string) => ipcRenderer.invoke("fs:delete", path),
    mkdir: (path: string) => ipcRenderer.invoke("fs:mkdir", path),
    gitRoot: (path: string) => ipcRenderer.invoke("fs:git-root", path),
    watch: (rootPath: string) => ipcRenderer.send("fs:watch", rootPath),
    onChanged: (callback: (event: FsChangeEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: FsChangeEvent) =>
        callback(data);
      ipcRenderer.on("fs:changed", handler);
      return () => ipcRenderer.removeListener("fs:changed", handler);
    },
    showInFolder: (path: string) => ipcRenderer.invoke("fs:show-in-folder", path),
    openPath: (path: string) => ipcRenderer.invoke("fs:open-path", path),
    copyTo: (sourcePaths: string[], destDir: string) =>
      ipcRenderer.invoke("fs:copy-to", sourcePaths, destDir),
    clipboardCopyPath: (path: string) => ipcRenderer.invoke("fs:clipboard-copy-path", path),
    remote: {
      readdir: (host: string, path: string) =>
        ipcRenderer.invoke("fs:remote:readdir", host, path),
      readFile: (host: string, path: string) =>
        ipcRenderer.invoke("fs:remote:read-file", host, path),
      writeFile: (host: string, path: string, content: string) =>
        ipcRenderer.invoke("fs:remote:write-file", host, path, content),
      stat: (host: string, path: string) =>
        ipcRenderer.invoke("fs:remote:stat", host, path),
      rename: (host: string, oldPath: string, newPath: string) =>
        ipcRenderer.invoke("fs:remote:rename", host, oldPath, newPath),
      delete: (host: string, path: string) =>
        ipcRenderer.invoke("fs:remote:delete", host, path),
      mkdir: (host: string, path: string) =>
        ipcRenderer.invoke("fs:remote:mkdir", host, path),
    },
  },

  openExternal: (url: string) => {
    ipcRenderer.send("open-external", url);
  },

  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) =>
      callback(action);
    ipcRenderer.on("menu:action", handler);
    return () => ipcRenderer.removeListener("menu:action", handler);
  },

  onSwipeTab: (callback: (direction: "left" | "right") => void) => {
    const handler = (_event: Electron.IpcRendererEvent, direction: "left" | "right") =>
      callback(direction);
    ipcRenderer.on("swipe-tab", handler);
    return () => ipcRenderer.removeListener("swipe-tab", handler);
  },

  onCliOpenFile: (callback: (data: { filePath: string; direction: "horizontal" | "vertical" }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { filePath: string; direction: "horizontal" | "vertical" }) =>
      callback(data);
    ipcRenderer.on("cli:open-file", handler);
    return () => ipcRenderer.removeListener("cli:open-file", handler);
  },
};

// contextBridge requires contextIsolation: true, which currently breaks
// the app at runtime (sandbox/serialization issues with xterm.js and Monaco).
// Using direct window assignment until those are resolved.
(window as any).vapor = api;
