// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/test-vapor") },
  screen: {
    getAllDisplays: vi.fn(() => [
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ]),
  },
  BrowserWindow: vi.fn(),
}));

vi.mock("fs", () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

vi.mock("./config", () => ({
  getConfig: vi.fn(() => ({
    window: { width: 800, height: 600 },
  })),
}));

import { screen } from "electron";
import { loadWindowState } from "./window-state";

beforeEach(() => {
  mockReadFileSync.mockReset();
  mockWriteFileSync.mockReset();
  mockMkdirSync.mockReset();
});

describe("loadWindowState", () => {
  it("returns config defaults when no saved state exists", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const state = loadWindowState();
    expect(state).toEqual({
      width: 800,
      height: 600,
      isMaximized: false,
    });
    expect(state.x).toBeUndefined();
    expect(state.y).toBeUndefined();
  });

  it("returns saved state when file exists and position is on-screen", () => {
    const saved = { x: 100, y: 200, width: 1024, height: 768, isMaximized: false };
    mockReadFileSync.mockReturnValue(JSON.stringify(saved));

    const state = loadWindowState();
    expect(state).toEqual(saved);
  });

  it("returns saved state with maximized flag", () => {
    const saved = { x: 100, y: 200, width: 1024, height: 768, isMaximized: true };
    mockReadFileSync.mockReturnValue(JSON.stringify(saved));

    const state = loadWindowState();
    expect(state.isMaximized).toBe(true);
  });

  it("omits position when saved position is off-screen", () => {
    vi.mocked(screen.getAllDisplays).mockReturnValue([
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } } as Electron.Display,
    ]);

    const saved = { x: 3000, y: 2000, width: 1024, height: 768, isMaximized: false };
    mockReadFileSync.mockReturnValue(JSON.stringify(saved));

    const state = loadWindowState();
    expect(state.width).toBe(1024);
    expect(state.height).toBe(768);
    expect(state.x).toBeUndefined();
    expect(state.y).toBeUndefined();
  });

  it("returns defaults when file contains invalid JSON", () => {
    mockReadFileSync.mockReturnValue("not valid json{{{");

    const state = loadWindowState();
    expect(state).toEqual({
      width: 800,
      height: 600,
      isMaximized: false,
    });
  });

  it("falls back to defaults for invalid dimensions", () => {
    const saved = { x: 100, y: 200, width: -1, height: 0, isMaximized: false };
    mockReadFileSync.mockReturnValue(JSON.stringify(saved));

    const state = loadWindowState();
    expect(state.width).toBe(800);
    expect(state.height).toBe(600);
  });

  it("validates position across multiple displays", () => {
    vi.mocked(screen.getAllDisplays).mockReturnValue([
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } } as Electron.Display,
      { bounds: { x: 1920, y: 0, width: 1920, height: 1080 } } as Electron.Display,
    ]);

    const saved = { x: 2000, y: 500, width: 800, height: 600, isMaximized: false };
    mockReadFileSync.mockReturnValue(JSON.stringify(saved));

    const state = loadWindowState();
    expect(state.x).toBe(2000);
    expect(state.y).toBe(500);
  });
});
