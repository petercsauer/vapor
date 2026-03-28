import { useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useTabPaneStore } from "./store/tabs";
import { useConfigStore } from "./store/config";
import { Header } from "./components/Header";
import { SplitView } from "./components/SplitView";
import { Sidebar } from "./components/Sidebar";
import { AppErrorBoundary } from "./components/ErrorBoundary";
import { useTabNaming } from "./hooks/useTabNaming";
import { useMenuActions } from "./hooks/useMenuActions";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { usePtyEvents } from "./hooks/usePtyEvents";
import { initScreenshotMode } from "./screenshot-mode";
import { vapor } from "./api/vapor";

export function App() {
  const tabs = useTabPaneStore((s) => s.tabs);
  const activeTabId = useTabPaneStore((s) => s.activeTabId);
  const createTab = useTabPaneStore((s) => s.createTab);
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const config = useConfigStore((s) => s.config);

  useEffect(() => {
    loadConfig().then(() => {
      createTab();
      setTimeout(() => initScreenshotMode(), 1000);
    }).catch((err) => {
      console.error("Config load failed:", err);
      createTab();
    });
  }, []);

  useEffect(() => {
    return vapor.config.onUpdated((newConfig) => {
      useConfigStore.setState({ config: newConfig });
    });
  }, []);

  useEffect(() => {
    const isOpaque = config?.background?.transparent === false;
    const color = config?.background?.opaqueColor || "#121212";
    if (isOpaque) {
      document.documentElement.classList.add("opaque-mode");
      document.documentElement.style.setProperty("--bg-opaque", color);
    } else {
      document.documentElement.classList.remove("opaque-mode");
      document.documentElement.style.removeProperty("--bg-opaque");
    }
  }, [config?.background?.transparent, config?.background?.opaqueColor]);

  usePtyEvents();
  useTabNaming();
  useMenuActions();
  useKeyboardNavigation();

  return (
    <AppErrorBoundary>
      <DndProvider backend={HTML5Backend}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Header />
          <div style={{ flex: 1, display: "flex", flexDirection: "row", minHeight: 0 }}>
            <Sidebar />
            <div style={{ flex: 1, position: "relative", minHeight: 0, minWidth: 0 }}>
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  style={{ width: '100%', height: '100%', display: tab.id === activeTabId ? "flex" : "none" }}
                >
                  <SplitView node={tab.paneRoot} tabId={tab.id} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </DndProvider>
    </AppErrorBoundary>
  );
}
