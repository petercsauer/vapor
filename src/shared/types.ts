export interface VaporConfig {
  font: {
    family: string;
    size: number;
    ligatures: boolean;
  };
  shell: {
    path: string;
    args: string[];
  };
  theme: {
    background: string;
    foreground: string;
    cursor: string;
    selectionBackground: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
  vibrancy: string;
  background?: {
    transparent?: boolean;
    opaqueColor?: string;
  };
  window: {
    width: number;
    height: number;
  };
  layouts?: {
    restoreReplacesExisting?: boolean;
  };
  screenshotMode?: boolean;
}

export interface PtyInfo {
  cwd: string;
  processName: string;
  command: string;
  remoteCwd: string;
  remoteHost: string;
}

export interface SavedPaneNode {
  type: "terminal" | "editor" | "split";
  cwd?: string;
  command?: string;
  processName?: string;
  remoteCwd?: string;
  remoteHost?: string;
  filePath?: string;
  direction?: "horizontal" | "vertical";
  ratio?: number;
  children?: [SavedPaneNode, SavedPaneNode];
}

export interface SavedTab {
  title: string;
  paneRoot: SavedPaneNode;
  sidebarVisible?: boolean;
  pinnedHost?: { type: "ssh" | "docker"; host: string };
}

export interface SavedLayout {
  name: string;
  tabs: SavedTab[];
  createdAt: string;
}

export interface RecentHost {
  type: "ssh" | "docker";
  host: string;
  lastUsed: string;
}

export interface FsEntry {
  name: string;
  type: "file" | "directory";
  path: string;
}

export interface FsChangeEvent {
  eventType: string;
  path: string;
  dir: string;
}

export interface FsStat {
  size: number;
  modified: number;
  isDirectory: boolean;
  isFile: boolean;
}

export interface SessionTarget {
  type: "local" | "ssh" | "docker";
  host: string;
  cwd: string;
  user?: string;
}

export type IntegrationLevel = "full" | "polling" | "passive";

export interface SessionState {
  sessionId: string;
  localCwd: string;
  target: SessionTarget | null;
  integrationLevel: IntegrationLevel;
  childProcess: string;
  childCommand: string;
  containerName: string;
  lastUpdated: number;
}
