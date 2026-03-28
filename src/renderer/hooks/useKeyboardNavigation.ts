import { useEffect } from "react";
import { useTabPaneStore } from "../store/tabs";
import { useNavigationStore, NavTarget } from "../store/navigation";
import { findAdjacentPane, Direction } from "../store/panes";

function resolveNavMove(
  direction: Direction,
  current: NavTarget | null,
): NavTarget | null {
  const state = useTabPaneStore.getState();
  const { tabs, activeTabId } = state;
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (!activeTab) return null;

  if (!current) {
    return { type: "pane", paneId: activeTab.focusedPaneId };
  }

  if (current.type === "tab") {
    const tabIdx = tabs.findIndex((t) => t.id === current.tabId);
    if (direction === "left" && tabIdx > 0) {
      return { type: "tab", tabId: tabs[tabIdx - 1].id };
    }
    if (direction === "right" && tabIdx < tabs.length - 1) {
      return { type: "tab", tabId: tabs[tabIdx + 1].id };
    }
    if (direction === "down") {
      const target = tabs.find((t) => t.id === current.tabId);
      if (target) return { type: "pane", paneId: target.focusedPaneId };
    }
    return current;
  }

  if (current.type === "pane") {
    if (direction === "up") {
      const adj = findAdjacentPane(activeTab.paneRoot, current.paneId, "up");
      if (adj) return { type: "pane", paneId: adj };
      return { type: "tab", tabId: activeTabId };
    }

    const adj = findAdjacentPane(activeTab.paneRoot, current.paneId, direction);
    if (adj) return { type: "pane", paneId: adj };
    return current;
  }

  return current;
}

function confirmNavTarget(target: NavTarget) {
  const state = useTabPaneStore.getState();
  if (target.type === "tab") {
    state.activateTab(target.tabId);
  } else {
    state.setFocusedPane(target.paneId);
  }
}

export function useKeyboardNavigation() {
  useEffect(() => {
    const ARROWS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
    const arrowToDir: Record<string, Direction> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || !e.shiftKey || !ARROWS.has(e.key)) return;
      e.preventDefault();
      e.stopPropagation();

      const nav = useNavigationStore.getState();
      const direction = arrowToDir[e.key];

      if (!nav.isNavigating) {
        const state = useTabPaneStore.getState();
        const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
        if (!activeTab) return;

        const initial: NavTarget = {
          type: "pane",
          paneId: activeTab.focusedPaneId,
        };
        const next = resolveNavMove(direction, initial);
        if (next) {
          nav.startNavigation(next);
        }
      } else {
        const next = resolveNavMove(direction, nav.selectedTarget);
        if (next) {
          nav.setTarget(next);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const nav = useNavigationStore.getState();
      if (!nav.isNavigating) return;

      if (e.key === "Alt" || e.key === "Shift") {
        const target = nav.selectedTarget;
        nav.confirm();
        if (target) confirmNavTarget(target);
      }
      if (e.key === "Escape") {
        nav.cancel();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, []);
}
