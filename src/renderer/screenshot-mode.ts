import { useTabPaneStore } from "./store/tabs";
import { useEditorStore } from "./store/editor";
import { useSidebarStore } from "./store/sidebar";
import { useConfigStore } from "./store/config";
import { findNode, collectSessionIds } from "./store/panes";

export interface ScreenshotModeAPI {
  active: boolean;
  splitPaneHorizontal: () => Promise<boolean>;
  splitPaneVertical: () => Promise<boolean>;
  toggleSidebar: () => Promise<boolean>;
  openEditor: (filePath: string) => Promise<boolean>;
  createTab: () => Promise<string>;
  renameTab: (tabId: string, name: string) => Promise<boolean>;
  setTabSSHHost: (tabId: string, host: string) => Promise<boolean>;
  setTabContainerName: (tabId: string, name: string) => Promise<boolean>;
  setPinnedHost: (tabId: string, type: 'ssh' | 'docker', host: string) => Promise<boolean>;
  setHostDropdownData: (data: { ssh: string[]; docker: string[]; recent: { type: 'ssh' | 'docker'; host: string; lastUsed: string }[] }) => Promise<boolean>;
  setCwd: (cwd: string) => Promise<boolean>;
  expandPath: (rootPath: string, targetPath: string) => Promise<boolean>;
  switchToTab: (tabIndex: number) => Promise<boolean>;
  closeAllTabs: () => Promise<boolean>;
  getState: () => any;
}

export function initScreenshotMode(): void {
  // Always initialize screenshot mode API for automation
  console.log("[Screenshot Mode] Initializing screenshot mode API...");

  const config = useConfigStore.getState().config;
  const configScreenshotMode = config?.screenshotMode === true;

  const api: ScreenshotModeAPI = {
    active: configScreenshotMode,

    splitPaneHorizontal: async () => {
      try {
        const state = useTabPaneStore.getState();
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        if (!activeTab) return false;

        await state.splitPane(activeTab.focusedPaneId, "horizontal");
        console.log("[Screenshot Mode] Split pane horizontally");
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to split horizontally:", e);
        return false;
      }
    },

    splitPaneVertical: async () => {
      try {
        const state = useTabPaneStore.getState();
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        if (!activeTab) return false;

        await state.splitPane(activeTab.focusedPaneId, "vertical");
        console.log("[Screenshot Mode] Split pane vertically");
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to split vertically:", e);
        return false;
      }
    },

    toggleSidebar: async () => {
      try {
        const state = useTabPaneStore.getState();
        state.toggleSidebar();
        console.log("[Screenshot Mode] Toggled sidebar");
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to toggle sidebar:", e);
        return false;
      }
    },

    openEditor: async (filePath: string) => {
      try {
        const state = useTabPaneStore.getState();
        state.openEditorPane(filePath);
        await useEditorStore.getState().openFile(filePath);
        console.log("[Screenshot Mode] Opened editor:", filePath);
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to open editor:", e);
        return false;
      }
    },

    createTab: async () => {
      try {
        const state = useTabPaneStore.getState();
        const beforeTabs = state.tabs.length;
        await state.createTab();
        const newTabId = useTabPaneStore.getState().activeTabId;
        console.log("[Screenshot Mode] Created new tab:", newTabId);
        return newTabId;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to create tab:", e);
        return "";
      }
    },

    renameTab: async (tabId: string, name: string) => {
      try {
        const state = useTabPaneStore.getState();
        state.renameTab(tabId, name);
        console.log("[Screenshot Mode] Renamed tab:", tabId, "to", name);
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to rename tab:", e);
        return false;
      }
    },

    setTabSSHHost: async (tabId: string, host: string) => {
      try {
        const state = useTabPaneStore.getState();
        state.setTabSSHHost(tabId, host);
        console.log("[Screenshot Mode] Set SSH host:", tabId, "to", host);
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to set SSH host:", e);
        return false;
      }
    },

    setTabContainerName: async (tabId: string, name: string) => {
      try {
        const state = useTabPaneStore.getState();
        state.setTabContainerName(tabId, name);
        console.log("[Screenshot Mode] Set container name:", tabId, "to", name);
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to set container name:", e);
        return false;
      }
    },

    setPinnedHost: async (tabId: string, type: 'ssh' | 'docker', host: string) => {
      try {
        const state = useTabPaneStore.getState();
        const pinnedHosts = { ...state.pinnedHosts, [tabId]: { type, host } };
        if (type === 'ssh') {
          state.setTabSSHHost(tabId, host);
        } else {
          state.setTabContainerName(tabId, host);
        }
        (useTabPaneStore as any).setState({ pinnedHosts });
        console.log("[Screenshot Mode] Set pinned host:", tabId, type, host);
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to set pinned host:", e);
        return false;
      }
    },

    setHostDropdownData: async (data) => {
      try {
        (window as any).__hostDropdownOverride = data;
        console.log("[Screenshot Mode] Set host dropdown override data");
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to set dropdown data:", e);
        return false;
      }
    },

    setCwd: async (cwd: string) => {
      try {
        const state = useTabPaneStore.getState();
        const tab = state.tabs.find(t => t.id === state.activeTabId);
        if (!tab) return false;
        const focused = findNode(tab.paneRoot, tab.focusedPaneId);
        const sessionId = focused?.type === "terminal"
          ? focused.sessionId
          : collectSessionIds(tab.paneRoot)[0];
        if (!sessionId) return false;
        state.setPaneCwd(sessionId, cwd);
        console.log("[Screenshot Mode] Set CWD:", sessionId, "to", cwd);
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to set CWD:", e);
        return false;
      }
    },

    expandPath: async (rootPath: string, targetPath: string) => {
      try {
        await useSidebarStore.getState().expandToPath(rootPath, targetPath);
        console.log("[Screenshot Mode] Expanded path:", rootPath, "->", targetPath);
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to expand path:", e);
        return false;
      }
    },

    switchToTab: async (tabIndex: number) => {
      try {
        const state = useTabPaneStore.getState();
        if (tabIndex >= 0 && tabIndex < state.tabs.length) {
          const tab = state.tabs[tabIndex];
          state.activateTab(tab.id);
          console.log("[Screenshot Mode] Switched to tab index:", tabIndex);
          return true;
        }
        return false;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to switch tab:", e);
        return false;
      }
    },

    closeAllTabs: async () => {
      try {
        const state = useTabPaneStore.getState();
        const oldTabIds = state.tabs.map(t => t.id);
        await state.createTab();
        for (const tabId of oldTabIds) {
          useTabPaneStore.getState().closeTab(tabId);
        }
        console.log("[Screenshot Mode] Reset tabs — created fresh, closed", oldTabIds.length, "old");
        return true;
      } catch (e) {
        console.error("[Screenshot Mode] Failed to reset tabs:", e);
        return false;
      }
    },

    getState: () => {
      const state = useTabPaneStore.getState();
      return {
        tabs: state.tabs.length,
        activeTabId: state.activeTabId,
        activeTab: state.tabs.find(t => t.id === state.activeTabId),
        sshHosts: state.sshHosts,
        containerNames: state.containerNames,
        tabIds: state.tabs.map(t => t.id),
      };
    },
  };

  (window as any).screenshotMode = api;
  console.log("[Screenshot Mode] API exposed to window.screenshotMode");
  console.log(`[Screenshot Mode] Active: ${configScreenshotMode}`);
}
