import { useEffect } from "react";
import { useTabPaneStore } from "../store/tabs";
import { useEditorStore } from "../store/editor";
import { useSidebarStore } from "../store/sidebar";
import { vapor } from "../api/vapor";


export function useMenuActions() {
  useEffect(() => {
    window.__vprOpenFile = async (filePath, direction) => {
      await useEditorStore.getState().openFile(filePath);
      useTabPaneStore.getState().openEditorPane(filePath, direction);
    };
    return () => {
      delete window.__vprOpenFile;
    };
  }, []);

  useEffect(() => {
    const cleanup = vapor.onMenuAction((action: string) => {
      const state = useTabPaneStore.getState();
      const activeTab = state.tabs.find((t) => t.id === state.activeTabId);

      if (action.startsWith("menu:tab-")) {
        const idx = parseInt(action.split("-")[1], 10) - 1;
        if (idx < state.tabs.length) {
          state.activateTab(state.tabs[idx].id);
        }
        return;
      }

      switch (action) {
        case "menu:new-tab":
          state.createTab();
          break;
        case "menu:close":
          if (activeTab) state.closePane(activeTab.focusedPaneId);
          break;
        case "menu:split-h":
          if (activeTab) state.splitPane(activeTab.focusedPaneId, "horizontal");
          break;
        case "menu:split-v":
          if (activeTab) state.splitPane(activeTab.focusedPaneId, "vertical");
          break;
        case "menu:find":
          window.dispatchEvent(new CustomEvent("vapor:find"));
          break;
        case "menu:toggle-sidebar":
          useTabPaneStore.getState().toggleSidebar();
          break;
        case "menu:open-folder":
          vapor.fs.openFolder().then((folder) => {
            if (folder) {
              useSidebarStore.getState().setPinnedPath(folder);
              const tabState = useTabPaneStore.getState();
              const activeTab = tabState.tabs.find((t) => t.id === tabState.activeTabId);
              if (activeTab) tabState.setSidebarVisible(activeTab.id, true);
            }
          }).catch((err) => {
            console.error("Open folder failed:", err);
          });
          break;
      }
    });
    return cleanup;
  }, []);
}
