import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMenuActions } from "./useMenuActions";

let menuActionCallback: ((action: string) => void) | null = null;

vi.mock("../api/vapor", () => ({
  vapor: {
    onMenuAction: vi.fn((cb: (action: string) => void) => {
      menuActionCallback = cb;
      return () => { menuActionCallback = null; };
    }),
    fs: {
      openFolder: vi.fn().mockResolvedValue(null),
    },
  },
}));

const activateTab = vi.fn();
const createTab = vi.fn();
const closePane = vi.fn();
const splitPane = vi.fn();
const toggleSidebar = vi.fn();
const setSidebarVisible = vi.fn();
const openEditorPane = vi.fn();

vi.mock("../store/tabs", () => ({
  useTabPaneStore: {
    getState: vi.fn(() => ({
      tabs: [
        { id: "tab-a", focusedPaneId: "pane-a" },
        { id: "tab-b", focusedPaneId: "pane-b" },
      ],
      activeTabId: "tab-a",
      activateTab,
      createTab,
      closePane,
      splitPane,
      toggleSidebar,
      setSidebarVisible,
      openEditorPane,
    })),
  },
}));

vi.mock("../store/editor", () => ({
  useEditorStore: {
    getState: vi.fn(() => ({
      openFile: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock("../store/sidebar", () => ({
  useSidebarStore: {
    getState: vi.fn(() => ({
      setPinnedPath: vi.fn(),
    })),
  },
}));

describe("useMenuActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    menuActionCallback = null;
  });

  it("activates valid tab by index", () => {
    renderHook(() => useMenuActions());
    expect(menuActionCallback).not.toBeNull();

    menuActionCallback!("menu:tab-1");
    expect(activateTab).toHaveBeenCalledWith("tab-a");
  });

  it("ignores negative tab index (menu:tab-0)", () => {
    renderHook(() => useMenuActions());
    menuActionCallback!("menu:tab-0");
    expect(activateTab).not.toHaveBeenCalled();
  });

  it("ignores NaN tab index (menu:tab-abc)", () => {
    renderHook(() => useMenuActions());
    menuActionCallback!("menu:tab-abc");
    expect(activateTab).not.toHaveBeenCalled();
  });

  it("ignores out-of-range tab index", () => {
    renderHook(() => useMenuActions());
    menuActionCallback!("menu:tab-99");
    expect(activateTab).not.toHaveBeenCalled();
  });
});
