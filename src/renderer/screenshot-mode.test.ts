import { describe, it, expect, beforeEach, vi } from "vitest";
import { initScreenshotMode, ScreenshotModeAPI } from "./screenshot-mode";

interface WindowWithScreenshotMode extends Window {
  screenshotMode?: ScreenshotModeAPI;
}

// Mock stores
vi.mock("./store/tabs", () => ({
  useTabPaneStore: {
    getState: vi.fn(() => ({
      tabs: [],
      activeTabId: null,
      createTab: vi.fn(),
      splitPane: vi.fn(),
      toggleSidebar: vi.fn(),
      openEditorPane: vi.fn(),
      renameTab: vi.fn(),
      setTabSSHHost: vi.fn(),
      setTabContainerName: vi.fn(),
      setPaneCwd: vi.fn(),
      activateTab: vi.fn(),
      closeTab: vi.fn(),
    })),
  },
}));

vi.mock("./store/editor", () => ({
  useEditorStore: {
    getState: vi.fn(() => ({
      openFile: vi.fn(),
    })),
  },
}));

vi.mock("./store/sidebar", () => ({
  useSidebarStore: {
    getState: vi.fn(() => ({
      expandToPath: vi.fn(),
    })),
  },
}));

vi.mock("./store/config", () => ({
  useConfigStore: {
    getState: vi.fn(() => ({
      config: null,
    })),
  },
}));

describe("screenshot-mode", () => {
  beforeEach(() => {
    // Clear window.screenshotMode before each test
    delete (window as any).screenshotMode;
    vi.clearAllMocks();
  });

  describe("initScreenshotMode", () => {
    it("should not initialize API in production without VAPOR_SCREENSHOT_MODE", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalScreenshotMode = process.env.VAPOR_SCREENSHOT_MODE;

      process.env.NODE_ENV = "production";
      process.env.VAPOR_SCREENSHOT_MODE = undefined;

      initScreenshotMode();

      expect((window as any).screenshotMode).toBeDefined();
      expect((window as any).screenshotMode.active).toBe(false);

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
      process.env.VAPOR_SCREENSHOT_MODE = originalScreenshotMode;
    });

    it("should initialize API in development", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalScreenshotMode = process.env.VAPOR_SCREENSHOT_MODE;

      process.env.NODE_ENV = "development";
      process.env.VAPOR_SCREENSHOT_MODE = undefined;

      initScreenshotMode();

      expect((window as any).screenshotMode).toBeDefined();
      expect((window as any).screenshotMode.active).toBe(false);

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
      process.env.VAPOR_SCREENSHOT_MODE = originalScreenshotMode;
    });

    it("should initialize API in production when VAPOR_SCREENSHOT_MODE is set", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalScreenshotMode = process.env.VAPOR_SCREENSHOT_MODE;

      process.env.NODE_ENV = "production";
      process.env.VAPOR_SCREENSHOT_MODE = "1";

      initScreenshotMode();

      expect((window as any).screenshotMode).toBeDefined();

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
      process.env.VAPOR_SCREENSHOT_MODE = originalScreenshotMode;
    });

    it("should set active flag based on config.screenshotMode", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalScreenshotMode = process.env.VAPOR_SCREENSHOT_MODE;

      process.env.NODE_ENV = "development";
      process.env.VAPOR_SCREENSHOT_MODE = undefined;

      // Re-import to get mocked version
      const configMock = await import("./store/config");
      vi.mocked(configMock.useConfigStore.getState).mockReturnValue({
        config: { screenshotMode: true },
        loadConfig: vi.fn(),
        saveConfig: vi.fn(),
      } as any);

      initScreenshotMode();

      expect((window as any).screenshotMode).toBeDefined();
      expect((window as any).screenshotMode.active).toBe(true);

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
      process.env.VAPOR_SCREENSHOT_MODE = originalScreenshotMode;
    });

    it("should initialize API when NODE_ENV is undefined", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalScreenshotMode = process.env.VAPOR_SCREENSHOT_MODE;

      process.env.NODE_ENV = undefined;
      process.env.VAPOR_SCREENSHOT_MODE = undefined;

      initScreenshotMode();

      expect((window as any).screenshotMode).toBeDefined();

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
      process.env.VAPOR_SCREENSHOT_MODE = originalScreenshotMode;
    });
  });
});
