import { create } from "zustand";
import type { SavedPaneNode, SavedTab, SessionState } from "../../shared/types";
import {
  DEFAULT_TAB_TITLE,
  COMMAND_STATUS_DISPLAY_MS,
  MIN_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  KNOWN_SHELLS,
} from "../../shared/constants";
import { vapor } from "../api/vapor";
import {
  PaneNode,
  genPaneId,
  findNode,
  updateNode,
  firstTerminalId,
  firstLeafId,
  collectSessionIds,
  findEditorPane,
  swapLeaves,
} from "./panes";

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

export interface Tab {
  id: string;
  title: string;
  hasCustomTitle: boolean;
  paneRoot: PaneNode;
  focusedPaneId: string;
  sidebarVisible: boolean;
}

export interface PinnedHost {
  type: "ssh" | "docker";
  host: string;
}

interface TabPaneStore {
  tabs: Tab[];
  activeTabId: string;
  moveMode: boolean;
  commandStatuses: Record<string, number | null>;
  sshHosts: Record<string, string>;
  containerNames: Record<string, string>;
  pinnedHosts: Record<string, PinnedHost>;
  paneCwds: Record<string, string>;
  paneGitRoots: Record<string, string>;
  paneRemoteCwds: Record<string, string>;
  sessionStates: Record<string, SessionState>;

  createTab: () => Promise<void>;
  createTabWithHost: (hostInfo: PinnedHost) => Promise<void>;
  closeTab: (tabId: string) => void;
  activateTab: (tabId: string) => void;
  setTabTitle: (tabId: string, title: string) => void;
  renameTab: (tabId: string, title: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  setTabSSHHost: (tabId: string, host: string) => void;
  setTabContainerName: (tabId: string, name: string) => void;

  splitPane: (
    paneId: string,
    direction: "horizontal" | "vertical",
  ) => Promise<void>;
  closePane: (paneId: string) => void;
  resizePane: (splitId: string, ratio: number) => void;
  setFocusedPane: (paneId: string) => void;
  setCommandStatus: (sessionId: string, exitCode: number | null) => void;

  setPaneCwd: (sessionId: string, cwd: string) => void;
  setPaneGitRoot: (sessionId: string, gitRoot: string) => void;
  setPaneRemoteCwd: (sessionId: string, remoteCwd: string) => void;
  setSessionState: (sessionId: string, state: SessionState) => void;
  openEditorPane: (filePath: string, direction?: "horizontal" | "vertical") => void;

  setPaneRoot: (tabId: string, newRoot: PaneNode) => void;
  swapPanes: (sourceId: string, targetId: string) => void;

  toggleMoveMode: () => void;

  toggleSidebar: () => void;
  setSidebarVisible: (tabId: string, visible: boolean) => void;

  captureLayout: () => Promise<SavedTab[]>;
  restoreLayout: (tabs: SavedTab[]) => Promise<void>;
}

export let nextTabId = 0;

export function resetNextTabId() {
  nextTabId = 0;
}

function findTabForPane(tabs: Tab[], nodeId: string): Tab | undefined {
  return tabs.find((tab) => findNode(tab.paneRoot, nodeId) !== null);
}

function updateTab(
  set: (fn: (s: TabPaneStore) => Partial<TabPaneStore>) => void,
  tabId: string,
  partial: Partial<Tab>,
) {
  set((state) => ({
    tabs: state.tabs.map((t) =>
      t.id === tabId ? { ...t, ...partial } : t,
    ),
  }));
}

function updateTabForPane(
  set: (fn: (s: TabPaneStore) => Partial<TabPaneStore>) => void,
  get: () => TabPaneStore,
  paneId: string,
  updater: (tab: Tab) => Partial<Tab>,
) {
  const { tabs } = get();
  const tab = findTabForPane(tabs, paneId);
  if (!tab) return;
  const partial = updater(tab);
  updateTab(set, tab.id, partial);
}

export const useTabPaneStore = create<TabPaneStore>((set, get) => ({
  tabs: [],
  activeTabId: "",
  moveMode: false,
  commandStatuses: {},
  sshHosts: {},
  containerNames: {},
  pinnedHosts: {},
  paneCwds: {},
  paneGitRoots: {},
  paneRemoteCwds: {},
  sessionStates: {},

  createTab: async () => {
    try {
      const { sessionId } = await vapor.pty.create();
      const paneId = genPaneId();
      const tabId = `tab-${++nextTabId}`;
      const tab: Tab = {
        id: tabId,
        title: DEFAULT_TAB_TITLE,
        hasCustomTitle: false,
        paneRoot: { type: "terminal", id: paneId, sessionId },
        focusedPaneId: paneId,
        sidebarVisible: false,
      };
      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: tabId,
      }));
    } catch (err) {
      console.error("Failed to create tab:", err);
    }
  },

  createTabWithHost: async (hostInfo: PinnedHost) => {
    try {
      const command =
        hostInfo.type === "ssh"
          ? `ssh ${shellEscape(hostInfo.host)}`
          : `docker exec -it ${shellEscape(hostInfo.host)} /bin/sh`;
      const { sessionId } = await vapor.pty.create({ command });
      const paneId = genPaneId();
      const tabId = `tab-${++nextTabId}`;
      const tab: Tab = {
        id: tabId,
        title: hostInfo.host,
        hasCustomTitle: false,
        paneRoot: { type: "terminal", id: paneId, sessionId },
        focusedPaneId: paneId,
        sidebarVisible: false,
      };
      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: tabId,
        pinnedHosts: { ...state.pinnedHosts, [tabId]: hostInfo },
        ...(hostInfo.type === "ssh"
          ? { sshHosts: { ...state.sshHosts, [tabId]: hostInfo.host } }
          : {
              containerNames: {
                ...state.containerNames,
                [tabId]: hostInfo.host,
              },
            }),
      }));
    } catch (err) {
      console.error("Failed to create tab with host:", err);
    }
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const sessionIds = collectSessionIds(tab.paneRoot);
    sessionIds.forEach((sid) => {
      vapor.pty.kill(sid).catch((err) => {
        console.error("Failed to kill PTY session:", err);
      });
    });

    if (tabs.length === 1) {
      window.close();
      return;
    }

    const idx = tabs.findIndex((t) => t.id === tabId);
    const remaining = tabs.filter((t) => t.id !== tabId);
    let newActiveId = activeTabId;
    if (activeTabId === tabId) {
      const newIdx = Math.min(idx, remaining.length - 1);
      newActiveId = remaining[newIdx].id;
    }

    set((state) => {
      const newPinned = { ...state.pinnedHosts };
      delete newPinned[tabId];
      return { tabs: remaining, activeTabId: newActiveId, pinnedHosts: newPinned };
    });
  },

  activateTab: (tabId: string) => {
    set({ activeTabId: tabId });
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      const sids = collectSessionIds(tab.paneRoot);
      setTimeout(() => {
        set((state) => {
          const cleaned = { ...state.commandStatuses };
          for (const sid of sids) delete cleaned[sid];
          return { commandStatuses: cleaned };
        });
      }, COMMAND_STATUS_DISPLAY_MS);
    }
  },

  setTabTitle: (tabId: string, title: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId && !t.hasCustomTitle ? { ...t, title } : t,
      ),
    }));
  },

  renameTab: (tabId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) {
      updateTab(set, tabId, { hasCustomTitle: false });
      return;
    }
    updateTab(set, tabId, { title: trimmed, hasCustomTitle: true });
  },

  reorderTabs: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newTabs = [...state.tabs];
      const [movedTab] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, movedTab);
      return { tabs: newTabs };
    });
  },

  splitPane: async (
    paneId: string,
    direction: "horizontal" | "vertical",
  ) => {
    const { tabs } = get();
    const tab = findTabForPane(tabs, paneId);
    if (!tab) return;

    const target = findNode(tab.paneRoot, paneId);
    if (!target || target.type !== "terminal") return;

    try {
      const pinned = get().pinnedHosts[tab.id];
      const createOpts = pinned
        ? {
            command:
              pinned.type === "ssh"
                ? `ssh ${shellEscape(pinned.host)}`
                : `docker exec -it ${shellEscape(pinned.host)} /bin/sh`,
          }
        : undefined;
      const { sessionId } = await vapor.pty.create(createOpts);
      const newTerminal: PaneNode = {
        type: "terminal",
        id: genPaneId(),
        sessionId,
      };
      const splitNode: PaneNode = {
        type: "split",
        id: genPaneId(),
        direction,
        ratio: 0.5,
        children: [target, newTerminal],
      };

      const newRoot = updateNode(tab.paneRoot, paneId, () => splitNode);
      if (!newRoot) return;

      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tab.id
            ? { ...t, paneRoot: newRoot, focusedPaneId: newTerminal.id }
            : t,
        ),
      }));
    } catch (err) {
      console.error("Failed to split pane:", err);
    }
  },

  closePane: (paneId: string) => {
    const { tabs } = get();
    const tab = findTabForPane(tabs, paneId);
    if (!tab) return;

    const target = findNode(tab.paneRoot, paneId);
    if (!target) return;
    if (target.type !== "terminal" && target.type !== "editor") return;

    if (
      (tab.paneRoot.type === "terminal" || tab.paneRoot.type === "editor") &&
      tab.paneRoot.id === paneId
    ) {
      get().closeTab(tab.id);
      return;
    }

    if (target.type === "terminal") {
      vapor.pty.kill(target.sessionId).catch((err) => {
        console.error("Failed to kill PTY session:", err);
      });
    }

    const newRoot = updateNode(tab.paneRoot, paneId, () => null);
    if (!newRoot) return;
    const newFocused = firstLeafId(newRoot);

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tab.id
          ? { ...t, paneRoot: newRoot, focusedPaneId: newFocused }
          : t,
      ),
    }));
  },

  resizePane: (splitId: string, ratio: number) => {
    const { tabs } = get();
    const tab = findTabForPane(tabs, splitId);
    if (!tab) return;

    const clamped = Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, ratio));
    const newRoot = updateNode(tab.paneRoot, splitId, (node) => {
      if (node.type !== "split") return node;
      return { ...node, ratio: clamped };
    });
    if (!newRoot) return;

    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tab.id ? { ...t, paneRoot: newRoot } : t,
      ),
    }));
  },

  setFocusedPane: (paneId: string) => {
    updateTabForPane(set, get, paneId, () => ({ focusedPaneId: paneId }));
  },

  setCommandStatus: (sessionId: string, exitCode: number | null) => {
    const { tabs, activeTabId } = get();
    const ownerTab = tabs.find((t) =>
      collectSessionIds(t.paneRoot).includes(sessionId),
    );
    const isActiveTab = ownerTab?.id === activeTabId;

    set((state) => ({
      commandStatuses: { ...state.commandStatuses, [sessionId]: exitCode },
    }));

    if (isActiveTab && exitCode !== null) {
      setTimeout(() => {
        set((state) => {
          const copy = { ...state.commandStatuses };
          delete copy[sessionId];
          return { commandStatuses: copy };
        });
      }, COMMAND_STATUS_DISPLAY_MS);
    }
  },

  setTabSSHHost: (tabId: string, host: string) => {
    set((state) => {
      if (!host) {
        if (!(tabId in state.sshHosts)) return state;
        const copy = { ...state.sshHosts };
        delete copy[tabId];
        return { sshHosts: copy };
      }
      if (state.sshHosts[tabId] === host) return state;
      return { sshHosts: { ...state.sshHosts, [tabId]: host } };
    });
  },

  setTabContainerName: (tabId: string, name: string) => {
    set((state) => {
      if (!name) {
        if (!(tabId in state.containerNames)) return state;
        const copy = { ...state.containerNames };
        delete copy[tabId];
        return { containerNames: copy };
      }
      if (state.containerNames[tabId] === name) return state;
      return { containerNames: { ...state.containerNames, [tabId]: name } };
    });
  },

  setPaneCwd: (sessionId: string, cwd: string) => {
    set((state) => {
      if (state.paneCwds[sessionId] === cwd) return state;
      return { paneCwds: { ...state.paneCwds, [sessionId]: cwd } };
    });
  },

  setPaneGitRoot: (sessionId: string, gitRoot: string) => {
    set((state) => {
      if (state.paneGitRoots[sessionId] === gitRoot) return state;
      return { paneGitRoots: { ...state.paneGitRoots, [sessionId]: gitRoot } };
    });
  },

  setPaneRemoteCwd: (sessionId: string, remoteCwd: string) => {
    set((state) => {
      if (state.paneRemoteCwds[sessionId] === remoteCwd) return state;
      return { paneRemoteCwds: { ...state.paneRemoteCwds, [sessionId]: remoteCwd } };
    });
  },

  setSessionState: (sessionId: string, newState: SessionState) => {
    set((state) => ({
      sessionStates: { ...state.sessionStates, [sessionId]: newState },
      paneCwds: { ...state.paneCwds, [sessionId]: newState.localCwd },
      ...(newState.target?.cwd
        ? { paneRemoteCwds: { ...state.paneRemoteCwds, [sessionId]: newState.target.cwd } }
        : {}),
    }));
  },

  openEditorPane: (filePath: string, direction?: "horizontal" | "vertical") => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;

    const existingEditor = findEditorPane(tab.paneRoot);
    if (existingEditor) {
      updateTab(set, tab.id, { focusedPaneId: existingEditor.id });
      return;
    }

    const editorPane: PaneNode = {
      type: "editor",
      id: genPaneId(),
      filePath,
    };

    const focused = findNode(tab.paneRoot, tab.focusedPaneId);
    if (!focused) return;
    const targetId = focused.id;

    const splitNode: PaneNode = {
      type: "split",
      id: genPaneId(),
      direction: direction ?? "horizontal",
      ratio: 0.5,
      children: [focused, editorPane],
    };

    const newRoot = updateNode(tab.paneRoot, targetId, () => splitNode);
    if (!newRoot) return;

    updateTab(set, tab.id, {
      paneRoot: newRoot,
      focusedPaneId: editorPane.id,
    });
  },

  setPaneRoot: (tabId: string, newRoot: PaneNode) => {
    updateTab(set, tabId, { paneRoot: newRoot });
  },

  swapPanes: (sourceId: string, targetId: string) => {
    updateTabForPane(set, get, sourceId, (tab) => ({
      paneRoot: swapLeaves(tab.paneRoot, sourceId, targetId),
    }));
  },

  toggleMoveMode: () => {
    set((state) => ({ moveMode: !state.moveMode }));
  },

  toggleSidebar: () => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map((t) =>
        t.id === activeTabId ? { ...t, sidebarVisible: !t.sidebarVisible } : t,
      ),
    });
  },

  setSidebarVisible: (tabId: string, visible: boolean) => {
    updateTab(set, tabId, { sidebarVisible: visible });
  },

  captureLayout: async () => {
    const { tabs } = get();

    async function captureNode(node: PaneNode): Promise<SavedPaneNode> {
      if (node.type === "editor") {
        return { type: "editor", filePath: node.filePath };
      }
      if (node.type === "terminal") {
        try {
          const info = await vapor.pty.getInfo(node.sessionId);
          const procBase = info?.processName.split("/").pop() ?? "";
          const isShell = !info || KNOWN_SHELLS.has(procBase);
          return {
            type: "terminal",
            cwd: info?.cwd ?? "",
            command: isShell ? "" : info?.command ?? "",
            processName: info?.processName ?? "",
            remoteCwd: info?.remoteCwd ?? "",
            remoteHost: info?.remoteHost ?? "",
          };
        } catch (err) {
          console.error("Failed to get PTY info:", err);
          return { type: "terminal", cwd: "" };
        }
      }
      const [left, right] = await Promise.all([
        captureNode(node.children[0]),
        captureNode(node.children[1]),
      ]);
      return {
        type: "split",
        direction: node.direction,
        ratio: node.ratio,
        children: [left, right],
      };
    }

    const { pinnedHosts } = get();
    const savedTabs: SavedTab[] = [];
    for (const tab of tabs) {
      savedTabs.push({
        title: tab.title,
        paneRoot: await captureNode(tab.paneRoot),
        sidebarVisible: tab.sidebarVisible,
        pinnedHost: pinnedHosts[tab.id],
      });
    }
    return savedTabs;
  },

  restoreLayout: async (savedTabs: SavedTab[]) => {
    const config = await vapor.config.get();
    if (config.layouts?.restoreReplacesExisting) {
      const { tabs: existingTabs } = get();
      for (const tab of existingTabs) {
        const sessionIds = collectSessionIds(tab.paneRoot);
        for (const sid of sessionIds) {
          try {
            await vapor.pty.kill(sid);
          } catch (err) {
            console.error("Failed to kill PTY session during restore:", err);
          }
        }
      }
      set({ tabs: [], activeTabId: "" });
    }

    async function buildNode(saved: SavedPaneNode): Promise<PaneNode | null> {
      if (saved.type === "editor") {
        return {
          type: "editor",
          id: genPaneId(),
          filePath: saved.filePath ?? "",
        };
      }
      if (saved.type === "terminal") {
        try {
          const { sessionId } = await vapor.pty.create({
            cwd: saved.cwd || undefined,
            command: saved.command || undefined,
            remoteCwd: saved.remoteCwd || undefined,
          });
          return { type: "terminal", id: genPaneId(), sessionId };
        } catch (err) {
          console.error("Failed to create PTY during restore:", err);
          return null;
        }
      }
      if (!saved.children) throw new Error("split node missing children");
      const [left, right] = await Promise.all([
        buildNode(saved.children[0]),
        buildNode(saved.children[1]),
      ]);
      if (!left && !right) return null;
      if (!left) return right;
      if (!right) return left;
      return {
        type: "split",
        id: genPaneId(),
        direction: saved.direction!,
        ratio: saved.ratio ?? 0.5,
        children: [left, right],
      };
    }

    for (const saved of savedTabs) {
      let paneRoot = await buildNode(saved.paneRoot);
      if (!paneRoot) {
        try {
          const { sessionId } = await vapor.pty.create({});
          paneRoot = { type: "terminal", id: genPaneId(), sessionId };
        } catch {
          continue;
        }
      }
      const tabId = `tab-${++nextTabId}`;
      const tab: Tab = {
        id: tabId,
        title: saved.title,
        hasCustomTitle: true,
        paneRoot,
        focusedPaneId: firstTerminalId(paneRoot),
        sidebarVisible: saved.sidebarVisible ?? false,
      };
      set((state) => {
        const updates: Partial<TabPaneStore> = {
          tabs: [...state.tabs, tab],
          activeTabId: tabId,
        };
        if (saved.pinnedHost) {
          updates.pinnedHosts = { ...state.pinnedHosts, [tabId]: saved.pinnedHost };
          if (saved.pinnedHost.type === "ssh") {
            updates.sshHosts = { ...state.sshHosts, [tabId]: saved.pinnedHost.host };
          } else {
            updates.containerNames = { ...state.containerNames, [tabId]: saved.pinnedHost.host };
          }
        }
        return updates;
      });
    }
  },
}));
