import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTabNaming } from "./useTabNaming";

// Mock the vapor API
vi.mock("../api/vapor", () => ({
  vapor: {
    tabNamer: {
      available: vi.fn().mockResolvedValue(true),
      suggest: vi.fn().mockResolvedValue("test-tab"),
    },
    pty: {
      getContext: vi.fn().mockResolvedValue({
        cwd: "/test/path",
        processName: "zsh",
        command: "zsh",
        remoteCwd: "",
        remoteHost: "",
        containerName: "",
      }),
      onOutput: vi.fn().mockReturnValue(() => {}),
      onStateUpdated: vi.fn().mockReturnValue(() => {}),
    },
    fs: {
      gitRoot: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Mock the stores
vi.mock("../store/tabs", () => ({
  useTabPaneStore: {
    getState: vi.fn(() => ({
      tabs: [
        {
          id: "tab-1",
          paneRoot: {
            type: "terminal",
            sessionId: "session-1",
          },
          focusedPaneId: "pane-1",
          hasCustomTitle: false,
        },
      ],
      setTabTitle: vi.fn(),
      setTabSSHHost: vi.fn(),
      setTabContainerName: vi.fn(),
      setPaneCwd: vi.fn(),
      setPaneGitRoot: vi.fn(),
      setPaneRemoteCwd: vi.fn(),
      setSessionState: vi.fn(),
      pinnedHosts: {},
    })),
  },
}));

vi.mock("../store/panes", () => ({
  findNode: vi.fn(() => ({
    type: "terminal",
    sessionId: "session-1",
  })),
  collectSessionIds: vi.fn(() => ["session-1"]),
}));

describe("useTabNaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).screenshotMode;
  });

  it("should run tab naming when screenshot mode is not active", async () => {
    // No screenshot mode set
    delete (window as any).screenshotMode;

    const vaporModule = await import("../api/vapor");

    renderHook(() => useTabNaming());

    // Wait for the effect to run
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Tab namer should be checked
    expect(vaporModule.vapor.tabNamer.available).toHaveBeenCalled();
  });

  it("should run tab naming when screenshot mode exists but is not active", async () => {
    // Set screenshot mode but not active
    (window as any).screenshotMode = { active: false };

    const vaporModule = await import("../api/vapor");

    renderHook(() => useTabNaming());

    // Wait for the effect to run
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Tab namer should be checked
    expect(vaporModule.vapor.tabNamer.available).toHaveBeenCalled();
  });

  it("does not start interval after unmount", async () => {
    vi.useFakeTimers();
    const vaporModule = await import("../api/vapor");

    let resolveAvailable!: (ok: boolean) => void;
    vi.mocked(vaporModule.vapor.tabNamer.available).mockReturnValue(
      new Promise((r) => { resolveAvailable = r; })
    );

    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    const { unmount } = renderHook(() => useTabNaming());

    unmount();

    resolveAvailable(true);
    await vi.advanceTimersByTimeAsync(0);

    const postUnmountCalls = setIntervalSpy.mock.calls.filter(
      ([fn]) => typeof fn === "function"
    );
    expect(postUnmountCalls).toHaveLength(0);

    setIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  it("catches errors in updateTabNames without unhandled rejection", async () => {
    vi.useFakeTimers();
    const vaporModule = await import("../api/vapor");

    vi.mocked(vaporModule.vapor.tabNamer.available).mockResolvedValue(true);
    vi.mocked(vaporModule.vapor.pty.getContext).mockRejectedValue(
      new Error("context fetch failed")
    );

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    renderHook(() => useTabNaming());

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(0);

    expect(warnSpy).toHaveBeenCalledWith(
      "[TabNaming] update failed:",
      expect.any(Error)
    );

    warnSpy.mockRestore();
    vi.useRealTimers();
  });
});
