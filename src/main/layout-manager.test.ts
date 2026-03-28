// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SavedLayout } from "../shared/types";

const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/test-layouts") },
  ipcMain: { handle: vi.fn() },
}));

vi.mock("fs", () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

import { ipcMain } from "electron";
import { setupLayoutHandlers } from "./layout-manager";

type IpcHandler = (...args: unknown[]) => unknown;
const handlers = new Map<string, IpcHandler>();

beforeEach(() => {
  mockReadFileSync.mockReset();
  mockWriteFileSync.mockReset();
  mockMkdirSync.mockReset();
  handlers.clear();
  vi.mocked(ipcMain.handle).mockReset();
  vi.mocked(ipcMain.handle).mockImplementation(
    ((channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }) as any,
  );
  setupLayoutHandlers();
});

describe("layouts:list", () => {
  it("returns parsed layouts from file", async () => {
    const layouts: SavedLayout[] = [
      { name: "dev", tabs: [], createdAt: "2025-01-01T00:00:00.000Z" },
    ];
    mockReadFileSync.mockReturnValue(JSON.stringify(layouts));

    const handler = handlers.get("layouts:list")!;
    const result = await handler();
    expect(result).toEqual(layouts);
  });

  it("returns empty array when file is corrupted", async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const handler = handlers.get("layouts:list")!;
    const result = await handler();
    expect(result).toEqual([]);
  });

  it("returns empty array for invalid JSON", async () => {
    mockReadFileSync.mockReturnValue("not json{{{");

    const handler = handlers.get("layouts:list")!;
    const result = await handler();
    expect(result).toEqual([]);
  });
});

describe("layouts:save", () => {
  it("appends a new layout and writes file", async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify([]));

    const handler = handlers.get("layouts:save")!;
    const result = await handler({} /* event */, {
      name: "work",
      tabs: [{ title: "tab1", paneRoot: { type: "terminal" } }],
    });

    expect(result).toHaveLength(1);
    expect((result as { name: string }[])[0].name).toBe("work");
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
  });

  it("replaces an existing layout with the same name", async () => {
    const existing = [
      {
        name: "work",
        tabs: [{ title: "old", paneRoot: { type: "terminal" } }],
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ];
    mockReadFileSync.mockReturnValue(JSON.stringify(existing));

    const handler = handlers.get("layouts:save")!;
    const result = (await handler({}, {
      name: "work",
      tabs: [{ title: "new", paneRoot: { type: "terminal" } }],
    })) as { name: string; tabs: { title: string }[] }[];

    expect(result).toHaveLength(1);
    expect(result[0].tabs[0].title).toBe("new");
  });
});

describe("layouts:delete", () => {
  it("removes layout by name and writes file", async () => {
    const layouts: SavedLayout[] = [
      { name: "keep", tabs: [], createdAt: "2025-01-01T00:00:00.000Z" },
      { name: "remove", tabs: [], createdAt: "2025-01-02T00:00:00.000Z" },
    ];
    mockReadFileSync.mockReturnValue(JSON.stringify(layouts));

    const handler = handlers.get("layouts:delete")!;
    const result = (await handler({}, "remove")) as { name: string }[];

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("keep");
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
  });

  it("returns unchanged list when name not found", async () => {
    const layouts: SavedLayout[] = [
      { name: "keep", tabs: [], createdAt: "2025-01-01T00:00:00.000Z" },
    ];
    mockReadFileSync.mockReturnValue(JSON.stringify(layouts));

    const handler = handlers.get("layouts:delete")!;
    const result = (await handler({}, "nonexistent")) as { name: string }[];

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("keep");
  });
});
