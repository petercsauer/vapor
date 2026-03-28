// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/test-vapor") },
  ipcMain: { handle: vi.fn() },
  shell: { openPath: vi.fn() },
}));

import { deepMerge } from "./config";

describe("deepMerge", () => {
  it("merges flat objects", () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 3 });
    expect(result).toEqual({ a: 1, b: 3 });
  });

  it("deep merges nested objects", () => {
    const result = deepMerge(
      { font: { size: 14, family: "mono" } },
      { font: { size: 16 } },
    );
    expect(result).toEqual({ font: { size: 16, family: "mono" } });
  });

  it("preserves override-only keys", () => {
    const result = deepMerge({ a: 1 }, { a: 2, b: 3 });
    expect(result).toEqual({ a: 2, b: 3 });
  });

  it("handles arrays by replacing (not merging)", () => {
    const result = deepMerge({ args: [1, 2] }, { args: [3] });
    expect(result).toEqual({ args: [3] });
  });

  it("preserves defaults when overrides is empty", () => {
    const result = deepMerge({ a: 1, b: { c: 2 } }, {});
    expect(result).toEqual({ a: 1, b: { c: 2 } });
  });

  it("handles deeply nested structures", () => {
    const result = deepMerge(
      { l1: { l2: { l3: "default" } } },
      { l1: { l2: { l3: "override" } } },
    );
    expect(result).toEqual({ l1: { l2: { l3: "override" } } });
  });

  it("preserves nested override-only keys", () => {
    const result = deepMerge(
      { nested: { x: 1 } },
      { nested: { x: 2, y: 3 }, extra: "val" },
    );
    expect(result).toEqual({ nested: { x: 2, y: 3 }, extra: "val" });
  });
});

describe("loadConfig / getConfig", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("loads and merges partial config from file", async () => {
    vi.doMock("electron", () => ({
      app: { getPath: vi.fn(() => "/tmp/test-vapor") },
      ipcMain: { handle: vi.fn() },
      shell: { openPath: vi.fn() },
    }));
    vi.doMock("fs", () => ({
      readFileSync: vi.fn(() => JSON.stringify({ font: { size: 20 } })),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
    }));
    const { getConfig } = await import("./config");
    const config = getConfig();
    expect(config.font.size).toBe(20);
    expect(config.font.family).toContain("SFMono");
    expect(config.font.ligatures).toBe(true);
  });

  it("creates defaults when config file does not exist", async () => {
    const mockWriteFileSync = vi.fn();
    vi.doMock("electron", () => ({
      app: { getPath: vi.fn(() => "/tmp/test-vapor") },
      ipcMain: { handle: vi.fn() },
      shell: { openPath: vi.fn() },
    }));
    vi.doMock("fs", () => ({
      readFileSync: vi.fn(() => {
        throw new Error("ENOENT");
      }),
      writeFileSync: mockWriteFileSync,
      mkdirSync: vi.fn(),
    }));
    const { getConfig } = await import("./config");
    const config = getConfig();
    expect(config.font.family).toContain("SFMono");
    expect(config.font.size).toBe(12);
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
  });

  it("caches config after first load", async () => {
    const mockReadFileSync = vi.fn(() =>
      JSON.stringify({ font: { size: 18 } }),
    );
    vi.doMock("electron", () => ({
      app: { getPath: vi.fn(() => "/tmp/test-vapor") },
      ipcMain: { handle: vi.fn() },
      shell: { openPath: vi.fn() },
    }));
    vi.doMock("fs", () => ({
      readFileSync: mockReadFileSync,
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
    }));
    const { getConfig } = await import("./config");
    getConfig();
    getConfig();
    expect(mockReadFileSync).toHaveBeenCalledOnce();
  });
});
