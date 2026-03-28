import { useEffect } from "react";
import { useTabPaneStore } from "../store/tabs";
import { vapor } from "../api/vapor";

function switchTab(delta: number) {
  const { tabs, activeTabId, activateTab } = useTabPaneStore.getState();
  if (tabs.length < 2) return;
  const idx = tabs.findIndex((t) => t.id === activeTabId);
  const next = (idx + delta + tabs.length) % tabs.length;
  activateTab(tabs[next].id);
}

export function usePtyEvents() {
  useEffect(() => {
    const cleanupStatus = vapor.pty.onCommandStatus(({ sessionId, exitCode }) => {
      useTabPaneStore.getState().setCommandStatus(sessionId, exitCode);
    });

    const cleanupSwipe = vapor.onSwipeTab((direction) => {
      switchTab(direction === "right" ? 1 : -1);
    });

    return () => {
      cleanupStatus();
      cleanupSwipe();
    };
  }, []);
}
