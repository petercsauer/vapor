import { describe, it, expect, vi } from "vitest";
import { useTabPaneStore } from "../renderer/store/tabs";
import { vapor } from "../renderer/api/vapor";

describe("test infrastructure", () => {
  it("window.vapor is defined and pty.create is a mock function", () => {
    expect(window.vapor).toBeDefined();
    expect(vi.isMockFunction(window.vapor.pty.create)).toBe(true);
  });

  it("useTabPaneStore exists and has createTab method", () => {
    expect(useTabPaneStore).toBeDefined();
    expect(typeof useTabPaneStore.getState().createTab).toBe("function");
  });

  it("vapor abstraction proxies to the mock API", () => {
    expect(vapor).toBeDefined();
    expect(vapor.pty).toBeDefined();
    expect(vi.isMockFunction(vapor.pty.create)).toBe(true);
  });

  it("store action uses IPC abstraction and calls the mock", async () => {
    const store = useTabPaneStore.getState();
    await store.createTab();
    expect(vapor.pty.create).toHaveBeenCalled();
    expect(useTabPaneStore.getState().tabs.length).toBeGreaterThan(0);
  });
});
