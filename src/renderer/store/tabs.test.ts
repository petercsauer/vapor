import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { useTabPaneStore, resetNextTabId, type Tab, type PinnedHost } from "./tabs";
import { createVaporMock } from "../../test/vapor-mock";
import { setVaporAPI } from "../api/vapor";
import { collectSessionIds } from "./panes";
import {
  DEFAULT_TAB_TITLE,
  COMMAND_STATUS_DISPLAY_MS,
  MIN_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
} from "../../shared/constants";

let mock: ReturnType<typeof createVaporMock>;

function resetStore() {
  useTabPaneStore.setState({
    tabs: [],
    activeTabId: "",
    moveMode: false,
    commandStatuses: {},
    sshHosts: {},
    containerNames: {},
    pinnedHosts: {},
    paneCwds: {},
    paneGitRoots: {},
  });
  resetNextTabId();
}

let sessionCounter = 0;

beforeEach(() => {
  sessionCounter = 0;
  mock = createVaporMock();
  (mock.pty.create as Mock).mockImplementation(() =>
    Promise.resolve({ sessionId: `session-${++sessionCounter}` }),
  );
  setVaporAPI(mock);
  resetStore();
});

function getState() {
  return useTabPaneStore.getState();
}

async function createOneTab(): Promise<Tab> {
  await getState().createTab();
  const { tabs } = getState();
  return tabs[tabs.length - 1];
}

describe("createTab", () => {
  it("adds a tab and calls pty.create", async () => {
    await getState().createTab();
    const { tabs, activeTabId } = getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].title).toBe(DEFAULT_TAB_TITLE);
    expect(tabs[0].paneRoot.type).toBe("terminal");
    expect(activeTabId).toBe(tabs[0].id);
    expect(mock.pty.create).toHaveBeenCalledTimes(1);
  });

  it("creates multiple tabs with unique IDs", async () => {
    await getState().createTab();
    await getState().createTab();
    const { tabs } = getState();
    expect(tabs).toHaveLength(2);
    expect(tabs[0].id).not.toBe(tabs[1].id);
  });

  it("handles IPC error gracefully", async () => {
    (mock.pty.create as Mock).mockRejectedValueOnce(new Error("IPC failure"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {
      // Suppress console.error in test
    });
    await getState().createTab();
    expect(getState().tabs).toHaveLength(0);
    spy.mockRestore();
  });
});

describe("closeTab", () => {
  it("removes tab and kills PTY sessions", async () => {
    await createOneTab();
    await createOneTab();
    const { tabs } = getState();
    expect(tabs).toHaveLength(2);

    const tabToClose = tabs[0];
    const sessionIds = collectSessionIds(tabToClose.paneRoot);

    getState().closeTab(tabToClose.id);
    expect(getState().tabs).toHaveLength(1);
    for (const sid of sessionIds) {
      expect(mock.pty.kill).toHaveBeenCalledWith(sid);
    }
  });

  it("activates adjacent tab when active tab is closed", async () => {
    await createOneTab();
    await createOneTab();
    const { tabs } = getState();
    getState().activateTab(tabs[0].id);
    getState().closeTab(tabs[0].id);
    expect(getState().activeTabId).toBe(tabs[1].id);
  });

  it("calls window.close when last tab is closed", async () => {
    const closeSpy = vi.fn();
    window.close = closeSpy;
    await createOneTab();
    const { tabs } = getState();
    getState().closeTab(tabs[0].id);
    expect(closeSpy).toHaveBeenCalled();
  });

  it("no-ops for non-existent tab ID", () => {
    getState().closeTab("nonexistent");
    expect(getState().tabs).toHaveLength(0);
  });
});

describe("splitPane", () => {
  it("creates correct tree structure with new PTY", async () => {
    const tab = await createOneTab();
    const rootPaneId = tab.paneRoot.id;

    await getState().splitPane(rootPaneId, "horizontal");

    const updatedTab = getState().tabs[0];
    expect(updatedTab.paneRoot.type).toBe("split");
    if (updatedTab.paneRoot.type === "split") {
      expect(updatedTab.paneRoot.direction).toBe("horizontal");
      expect(updatedTab.paneRoot.children).toHaveLength(2);
      expect(updatedTab.paneRoot.children[0].type).toBe("terminal");
      expect(updatedTab.paneRoot.children[1].type).toBe("terminal");
    }
    expect(mock.pty.create).toHaveBeenCalledTimes(2);
  });

  it("focuses the new pane after split", async () => {
    const tab = await createOneTab();
    await getState().splitPane(tab.paneRoot.id, "vertical");
    const updatedTab = getState().tabs[0];
    if (updatedTab.paneRoot.type === "split") {
      expect(updatedTab.focusedPaneId).toBe(
        updatedTab.paneRoot.children[1].id,
      );
    }
  });

  it("no-ops for non-existent pane ID", async () => {
    await createOneTab();
    await getState().splitPane("nonexistent", "horizontal");
    expect(getState().tabs[0].paneRoot.type).toBe("terminal");
  });
});

describe("closePane", () => {
  it("removes node, kills PTY, and falls back to correct focus", async () => {
    const tab = await createOneTab();
    await getState().splitPane(tab.paneRoot.id, "horizontal");

    const splitTab = getState().tabs[0];
    if (splitTab.paneRoot.type !== "split") throw new Error("expected split");
    const rightPane = splitTab.paneRoot.children[1];
    const leftPane = splitTab.paneRoot.children[0];

    getState().closePane(rightPane.id);

    const afterClose = getState().tabs[0];
    expect(afterClose.paneRoot.type).toBe("terminal");
    expect(afterClose.paneRoot.id).toBe(leftPane.id);
    expect(afterClose.focusedPaneId).toBe(leftPane.id);
    if (rightPane.type === "terminal") {
      expect(mock.pty.kill).toHaveBeenCalledWith(rightPane.sessionId);
    }
  });

  it("closes tab when closing the only pane", async () => {
    await createOneTab();
    await createOneTab();
    const tab = getState().tabs[0];
    getState().closePane(tab.paneRoot.id);
    expect(getState().tabs).toHaveLength(1);
  });

  it("closes editor pane without killing PTY", async () => {
    const tab = await createOneTab();
    getState().openEditorPane("/tmp/test.ts");
    const withEditor = getState().tabs[0];
    if (withEditor.paneRoot.type !== "split") throw new Error("expected split");

    const editorPane = withEditor.paneRoot.children[1];
    expect(editorPane.type).toBe("editor");

    const killCallsBefore = (mock.pty.kill as Mock).mock.calls.length;
    getState().closePane(editorPane.id);

    expect((mock.pty.kill as Mock).mock.calls.length).toBe(killCallsBefore);
    expect(getState().tabs[0].paneRoot.type).toBe("terminal");
  });
});

describe("activateTab", () => {
  it("updates activeTabId", async () => {
    await createOneTab();
    await createOneTab();
    const { tabs } = getState();
    getState().activateTab(tabs[0].id);
    expect(getState().activeTabId).toBe(tabs[0].id);
  });
});

describe("openEditorPane", () => {
  it("adds editor node to the tree", async () => {
    await createOneTab();
    getState().openEditorPane("/tmp/test.ts");
    const tab = getState().tabs[0];
    expect(tab.paneRoot.type).toBe("split");
    if (tab.paneRoot.type === "split") {
      expect(tab.paneRoot.children[1].type).toBe("editor");
      if (tab.paneRoot.children[1].type === "editor") {
        expect(tab.paneRoot.children[1].filePath).toBe("/tmp/test.ts");
      }
    }
  });

  it("does not crash with stale focusedPaneId", async () => {
    await createOneTab();
    useTabPaneStore.setState((s) => ({
      tabs: s.tabs.map((t) => ({ ...t, focusedPaneId: "stale-id" })),
    }));
    getState().openEditorPane("/tmp/test.ts");
    const tab = getState().tabs[0];
    expect(tab.paneRoot.type).toBe("terminal");
  });

  it("reuses existing editor pane instead of creating new one", async () => {
    await createOneTab();
    getState().openEditorPane("/tmp/file1.ts");
    getState().openEditorPane("/tmp/file2.ts");
    const tab = getState().tabs[0];
    if (tab.paneRoot.type === "split") {
      const editorCount = [
        tab.paneRoot.children[0],
        tab.paneRoot.children[1],
      ].filter((c) => c.type === "editor").length;
      expect(editorCount).toBe(1);
    }
  });
});

describe("captureLayout", () => {
  it("serializes terminal panes", async () => {
    await createOneTab();
    const result = await getState().captureLayout();
    expect(result).toHaveLength(1);
    expect(result[0].paneRoot.type).toBe("terminal");
    expect(result[0].title).toBe(DEFAULT_TAB_TITLE);
  });

  it("serializes editor panes with filePath", async () => {
    await createOneTab();
    getState().openEditorPane("/tmp/test.ts");
    const result = await getState().captureLayout();
    expect(result).toHaveLength(1);
    expect(result[0].paneRoot.type).toBe("split");
    if (result[0].paneRoot.children) {
      const editorNode = result[0].paneRoot.children[1];
      expect(editorNode.type).toBe("editor");
      expect(editorNode.filePath).toBe("/tmp/test.ts");
    }
  });
});

describe("restoreLayout", () => {
  it("round-trips both terminal and editor panes", async () => {
    await createOneTab();
    getState().openEditorPane("/tmp/test.ts");

    const layout = await getState().captureLayout();
    resetStore();
    await getState().restoreLayout(layout);

    const { tabs } = getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].paneRoot.type).toBe("split");
    if (tabs[0].paneRoot.type === "split") {
      expect(tabs[0].paneRoot.children[1].type).toBe("editor");
      if (tabs[0].paneRoot.children[1].type === "editor") {
        expect(tabs[0].paneRoot.children[1].filePath).toBe("/tmp/test.ts");
      }
    }
  });

  it("appends restored tabs to existing ones by default", async () => {
    await createOneTab();
    await createOneTab();
    expect(getState().tabs).toHaveLength(2);

    const savedLayout: import("../../shared/types").SavedTab[] = [
      {
        title: "restored",
        paneRoot: { type: "terminal", cwd: "/tmp" },
        sidebarVisible: false,
      },
    ];

    await getState().restoreLayout(savedLayout);
    expect(getState().tabs).toHaveLength(3);
    expect(getState().tabs[2].title).toBe("restored");
    expect(mock.pty.kill).not.toHaveBeenCalled();
  });

  it("replaces existing tabs when restoreReplacesExisting is true", async () => {
    mock.config.get.mockResolvedValueOnce({ layouts: { restoreReplacesExisting: true } });
    await createOneTab();
    await createOneTab();
    expect(getState().tabs).toHaveLength(2);

    const savedLayout: import("../../shared/types").SavedTab[] = [
      {
        title: "restored",
        paneRoot: { type: "terminal", cwd: "/tmp" },
        sidebarVisible: false,
      },
    ];

    await getState().restoreLayout(savedLayout);
    expect(getState().tabs).toHaveLength(1);
    expect(getState().tabs[0].title).toBe("restored");
    expect(mock.pty.kill).toHaveBeenCalled();
  });

  it("restores empty layout as no-op by default", async () => {
    await createOneTab();
    await getState().restoreLayout([]);
    expect(getState().tabs).toHaveLength(1);
  });
});

describe("restoreLayout error handling", () => {
  it("skips pane when PTY creation fails for a terminal", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const savedLayout: import("../../shared/types").SavedTab[] = [
      {
        title: "split-with-failure",
        paneRoot: {
          type: "split",
          direction: "horizontal",
          ratio: 0.5,
          children: [
            { type: "terminal", cwd: "/tmp/left" },
            { type: "terminal", cwd: "/tmp/right" },
          ],
        },
        sidebarVisible: false,
      },
    ];

    let callCount = 0;
    (mock.pty.create as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("PTY failure"));
      return Promise.resolve({ sessionId: `session-${++sessionCounter}` });
    });

    await getState().restoreLayout(savedLayout);
    const { tabs } = getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].paneRoot.type).toBe("terminal");
    if (tabs[0].paneRoot.type === "terminal") {
      expect(tabs[0].paneRoot.sessionId).not.toBe("failed");
    }
    spy.mockRestore();
  });

  it("creates fresh terminal when all panes in a tab fail", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const savedLayout: import("../../shared/types").SavedTab[] = [
      {
        title: "all-fail",
        paneRoot: { type: "terminal", cwd: "/tmp" },
        sidebarVisible: false,
      },
    ];

    let callCount = 0;
    (mock.pty.create as Mock).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("PTY failure"));
      return Promise.resolve({ sessionId: `session-${++sessionCounter}` });
    });

    await getState().restoreLayout(savedLayout);
    const { tabs } = getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].paneRoot.type).toBe("terminal");
    if (tabs[0].paneRoot.type === "terminal") {
      expect(tabs[0].paneRoot.sessionId).not.toBe("failed");
      expect(tabs[0].paneRoot.sessionId).toMatch(/^session-/);
    }
    spy.mockRestore();
  });

  it("skips tab entirely when all PTY creations fail", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const savedLayout: import("../../shared/types").SavedTab[] = [
      {
        title: "doomed",
        paneRoot: { type: "terminal", cwd: "/tmp" },
        sidebarVisible: false,
      },
    ];

    (mock.pty.create as Mock).mockRejectedValue(new Error("PTY failure"));

    await getState().restoreLayout(savedLayout);
    expect(getState().tabs).toHaveLength(0);
    spy.mockRestore();
  });
});

describe("setCommandStatus", () => {
  it("sets status and clears after timeout", async () => {
    vi.useFakeTimers();

    await createOneTab();
    const tab = getState().tabs[0];
    getState().activateTab(tab.id);

    if (tab.paneRoot.type !== "terminal") throw new Error("expected terminal");
    const sessionId = tab.paneRoot.sessionId;

    getState().setCommandStatus(sessionId, 0);
    expect(getState().commandStatuses[sessionId]).toBe(0);

    vi.advanceTimersByTime(COMMAND_STATUS_DISPLAY_MS);
    expect(getState().commandStatuses[sessionId]).toBeUndefined();

    vi.useRealTimers();
  });

  it("does not auto-clear for inactive tab", async () => {
    vi.useFakeTimers();

    await createOneTab();
    await createOneTab();
    const tab1 = getState().tabs[0];
    getState().activateTab(getState().tabs[1].id);

    if (tab1.paneRoot.type !== "terminal") throw new Error("expected terminal");
    const sessionId = tab1.paneRoot.sessionId;

    getState().setCommandStatus(sessionId, 1);
    expect(getState().commandStatuses[sessionId]).toBe(1);

    vi.advanceTimersByTime(COMMAND_STATUS_DISPLAY_MS + 1000);
    expect(getState().commandStatuses[sessionId]).toBe(1);

    vi.useRealTimers();
  });
});

describe("resizePane", () => {
  it("clamps ratio to bounds", async () => {
    const tab = await createOneTab();
    await getState().splitPane(tab.paneRoot.id, "horizontal");

    const splitTab = getState().tabs[0];
    if (splitTab.paneRoot.type !== "split") throw new Error("expected split");

    getState().resizePane(splitTab.paneRoot.id, 0.01);
    const after1 = getState().tabs[0];
    if (after1.paneRoot.type === "split") {
      expect(after1.paneRoot.ratio).toBe(MIN_SPLIT_RATIO);
    }

    getState().resizePane(splitTab.paneRoot.id, 0.99);
    const after2 = getState().tabs[0];
    if (after2.paneRoot.type === "split") {
      expect(after2.paneRoot.ratio).toBe(MAX_SPLIT_RATIO);
    }
  });
});

describe("renameTab", () => {
  it("sets custom title", async () => {
    const tab = await createOneTab();
    getState().renameTab(tab.id, "My Tab");
    const updated = getState().tabs[0];
    expect(updated.title).toBe("My Tab");
    expect(updated.hasCustomTitle).toBe(true);
  });

  it("clears custom title when empty string passed", async () => {
    const tab = await createOneTab();
    getState().renameTab(tab.id, "Custom");
    getState().renameTab(tab.id, "   ");
    const updated = getState().tabs[0];
    expect(updated.hasCustomTitle).toBe(false);
  });
});

describe("edge cases", () => {
  it("splitPane with invalid (editor) pane is a no-op", async () => {
    await createOneTab();
    getState().openEditorPane("/tmp/test.ts");
    const tab = getState().tabs[0];
    if (tab.paneRoot.type !== "split") throw new Error("expected split");
    const editorPane = tab.paneRoot.children[1];

    await getState().splitPane(editorPane.id, "horizontal");
    const after = getState().tabs[0];
    if (after.paneRoot.type === "split") {
      expect(after.paneRoot.children[1].type).toBe("editor");
    }
  });
});

describe("createTabWithHost", () => {
  it("creates SSH tab with correct pinnedHost, command, and sshHosts", async () => {
    const hostInfo: PinnedHost = { type: "ssh", host: "myserver.com" };
    await getState().createTabWithHost(hostInfo);

    const { tabs, pinnedHosts, sshHosts, containerNames } = getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].title).toBe("myserver.com");
    expect(pinnedHosts[tabs[0].id]).toEqual(hostInfo);
    expect(sshHosts[tabs[0].id]).toBe("myserver.com");
    expect(containerNames[tabs[0].id]).toBeUndefined();
    expect(mock.pty.create).toHaveBeenCalledWith({ command: "ssh myserver.com" });
  });

  it("creates Docker tab with correct pinnedHost, command, and containerNames", async () => {
    const hostInfo: PinnedHost = { type: "docker", host: "my-container" };
    await getState().createTabWithHost(hostInfo);

    const { tabs, pinnedHosts, sshHosts, containerNames } = getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].title).toBe("my-container");
    expect(pinnedHosts[tabs[0].id]).toEqual(hostInfo);
    expect(containerNames[tabs[0].id]).toBe("my-container");
    expect(sshHosts[tabs[0].id]).toBeUndefined();
    expect(mock.pty.create).toHaveBeenCalledWith({
      command: "docker exec -it my-container /bin/sh",
    });
  });

  it("handles IPC error gracefully", async () => {
    (mock.pty.create as Mock).mockRejectedValueOnce(new Error("IPC failure"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await getState().createTabWithHost({ type: "ssh", host: "fail.com" });
    expect(getState().tabs).toHaveLength(0);
    expect(getState().pinnedHosts).toEqual({});
    spy.mockRestore();
  });
});

describe("splitPane with pinned host", () => {
  it("passes SSH command when splitting a pinned tab", async () => {
    await getState().createTabWithHost({ type: "ssh", host: "myserver.com" });
    const tab = getState().tabs[0];

    await getState().splitPane(tab.paneRoot.id, "horizontal");

    expect(mock.pty.create).toHaveBeenCalledTimes(2);
    expect(mock.pty.create).toHaveBeenLastCalledWith({
      command: "ssh myserver.com",
    });
  });

  it("passes Docker command when splitting a pinned tab", async () => {
    await getState().createTabWithHost({ type: "docker", host: "my-container" });
    const tab = getState().tabs[0];

    await getState().splitPane(tab.paneRoot.id, "horizontal");

    expect(mock.pty.create).toHaveBeenCalledTimes(2);
    expect(mock.pty.create).toHaveBeenLastCalledWith({
      command: "docker exec -it my-container /bin/sh",
    });
  });

  it("does not pass command when splitting a non-pinned tab", async () => {
    await getState().createTab();
    const tab = getState().tabs[0];

    await getState().splitPane(tab.paneRoot.id, "horizontal");

    expect(mock.pty.create).toHaveBeenCalledTimes(2);
    expect(mock.pty.create).toHaveBeenLastCalledWith(undefined);
  });
});

describe("closeTab cleans up pinnedHosts", () => {
  it("removes pinnedHost entry when closing a pinned tab", async () => {
    await getState().createTabWithHost({ type: "ssh", host: "myserver.com" });
    await createOneTab();
    const { tabs } = getState();
    const pinnedTabId = tabs[0].id;

    expect(getState().pinnedHosts[pinnedTabId]).toBeDefined();
    getState().closeTab(pinnedTabId);
    expect(getState().pinnedHosts[pinnedTabId]).toBeUndefined();
  });
});

describe("captureLayout/restoreLayout with pinnedHost", () => {
  it("round-trips pinnedHost through capture and restore", async () => {
    const hostInfo: PinnedHost = { type: "ssh", host: "myserver.com" };
    await getState().createTabWithHost(hostInfo);

    const layout = await getState().captureLayout();
    expect(layout[0].pinnedHost).toEqual(hostInfo);

    resetStore();
    await getState().restoreLayout(layout);

    const { tabs, pinnedHosts, sshHosts } = getState();
    expect(tabs).toHaveLength(1);
    expect(pinnedHosts[tabs[0].id]).toEqual(hostInfo);
    expect(sshHosts[tabs[0].id]).toBe("myserver.com");
  });

  it("round-trips Docker pinnedHost through capture and restore", async () => {
    const hostInfo: PinnedHost = { type: "docker", host: "my-container" };
    await getState().createTabWithHost(hostInfo);

    const layout = await getState().captureLayout();
    expect(layout[0].pinnedHost).toEqual(hostInfo);

    resetStore();
    await getState().restoreLayout(layout);

    const { tabs, pinnedHosts, containerNames } = getState();
    expect(tabs).toHaveLength(1);
    expect(pinnedHosts[tabs[0].id]).toEqual(hostInfo);
    expect(containerNames[tabs[0].id]).toBe("my-container");
  });

  it("restores non-pinned tabs without pinnedHost", async () => {
    await createOneTab();

    const layout = await getState().captureLayout();
    expect(layout[0].pinnedHost).toBeUndefined();

    resetStore();
    await getState().restoreLayout(layout);

    const { tabs, pinnedHosts } = getState();
    expect(tabs).toHaveLength(1);
    expect(pinnedHosts[tabs[0].id]).toBeUndefined();
  });
});
