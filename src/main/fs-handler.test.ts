// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReaddir = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockStat = vi.fn();
const mockRename = vi.fn();
const mockMkdir = vi.fn();

vi.mock("fs/promises", () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  rename: (...args: unknown[]) => mockRename(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

vi.mock("fs", () => ({
  watch: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  shell: { trashItem: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn() },
}));

import { ipcMain, dialog, shell, BrowserWindow } from "electron";
import { setupFsHandlers } from "./fs-handler";

type IpcHandler = (...args: unknown[]) => unknown;
const handlers = new Map<string, IpcHandler>();
const listeners = new Map<string, IpcHandler>();

beforeEach(() => {
  mockReaddir.mockReset();
  mockReadFile.mockReset();
  mockWriteFile.mockReset();
  mockStat.mockReset();
  mockRename.mockReset();
  mockMkdir.mockReset();
  handlers.clear();
  listeners.clear();

  vi.mocked(ipcMain.handle).mockReset();
  vi.mocked(ipcMain.on).mockReset();
  vi.mocked(ipcMain.handle).mockImplementation(
    ((channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }) as any,
  );
  vi.mocked(ipcMain.on).mockImplementation(
    ((channel: string, handler: IpcHandler) => {
      listeners.set(channel, handler);
    }) as any,
  );

  setupFsHandlers();
});

describe("fs:readdir", () => {
  it("returns sorted FsEntry array from directory", async () => {
    mockReaddir.mockResolvedValue([
      { name: "readme.md", isFile: () => true, isDirectory: () => false },
      { name: "src", isFile: () => false, isDirectory: () => true },
      { name: "app.ts", isFile: () => true, isDirectory: () => false },
    ]);

    const handler = handlers.get("fs:readdir")!;
    const result = (await handler({}, "/test/dir")) as {
      name: string;
      type: string;
      path: string;
    }[];

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      name: "src",
      type: "directory",
      path: "/test/dir/src",
    });
    expect(result[1]).toEqual({
      name: "app.ts",
      type: "file",
      path: "/test/dir/app.ts",
    });
    expect(result[2]).toEqual({
      name: "readme.md",
      type: "file",
      path: "/test/dir/readme.md",
    });
  });

  it("filters out entries that are neither file nor directory", async () => {
    mockReaddir.mockResolvedValue([
      { name: "link", isFile: () => false, isDirectory: () => false },
      { name: "file.txt", isFile: () => true, isDirectory: () => false },
    ]);

    const handler = handlers.get("fs:readdir")!;
    const result = (await handler({}, "/test")) as unknown[];
    expect(result).toHaveLength(1);
  });
});

describe("fs:read-file", () => {
  it("returns file content as string", async () => {
    mockReadFile.mockResolvedValue("hello world");

    const handler = handlers.get("fs:read-file")!;
    const result = await handler({}, "/test/file.txt");
    expect(result).toBe("hello world");
    expect(mockReadFile).toHaveBeenCalledWith("/test/file.txt", "utf-8");
  });
});

describe("fs:write-file", () => {
  it("writes content to file", async () => {
    mockWriteFile.mockResolvedValue(undefined);

    const handler = handlers.get("fs:write-file")!;
    await handler({}, "/test/out.txt", "content");
    expect(mockWriteFile).toHaveBeenCalledWith(
      "/test/out.txt",
      "content",
      "utf-8",
    );
  });
});

describe("fs:stat", () => {
  it("returns stat object with correct shape", async () => {
    mockStat.mockResolvedValue({
      size: 1024,
      mtimeMs: 1700000000000,
      isDirectory: () => false,
      isFile: () => true,
    });

    const handler = handlers.get("fs:stat")!;
    const result = (await handler({}, "/test/file.txt")) as Record<
      string,
      unknown
    >;
    expect(result).toEqual({
      size: 1024,
      modified: 1700000000000,
      isDirectory: false,
      isFile: true,
    });
  });
});

describe("fs:rename", () => {
  it("calls rename with old and new path", async () => {
    mockRename.mockResolvedValue(undefined);

    const handler = handlers.get("fs:rename")!;
    await handler({}, "/old/path.txt", "/new/path.txt");
    expect(mockRename).toHaveBeenCalledWith("/old/path.txt", "/new/path.txt");
  });
});

describe("fs:mkdir", () => {
  it("creates directory recursively", async () => {
    mockMkdir.mockResolvedValue(undefined);

    const handler = handlers.get("fs:mkdir")!;
    await handler({}, "/test/new/dir");
    expect(mockMkdir).toHaveBeenCalledWith("/test/new/dir", {
      recursive: true,
    });
  });
});

describe("fs:delete", () => {
  it("calls shell.trashItem", async () => {
    vi.mocked(shell.trashItem).mockResolvedValue(undefined);

    const handler = handlers.get("fs:delete")!;
    await handler({}, "/test/file.txt");
    expect(shell.trashItem).toHaveBeenCalledWith("/test/file.txt");
  });
});

describe("fs:open-folder", () => {
  it("returns selected folder path", async () => {
    const mockWin = {} as Electron.BrowserWindow;
    vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(mockWin);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["/selected/folder"],
    });

    const handler = handlers.get("fs:open-folder")!;
    const result = await handler();
    expect(result).toBe("/selected/folder");
  });

  it("returns null when dialog is canceled", async () => {
    const mockWin = {} as Electron.BrowserWindow;
    vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(mockWin);
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    const handler = handlers.get("fs:open-folder")!;
    const result = await handler();
    expect(result).toBeNull();
  });

  it("returns null when no focused window", async () => {
    vi.mocked(BrowserWindow.getFocusedWindow).mockReturnValue(null);

    const handler = handlers.get("fs:open-folder")!;
    const result = await handler();
    expect(result).toBeNull();
  });
});

describe("error propagation", () => {
  it("propagates ENOENT from readFile", async () => {
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(err);

    const handler = handlers.get("fs:read-file")!;
    await expect(handler({}, "/nonexistent")).rejects.toThrow("ENOENT");
  });

  it("propagates error from readdir", async () => {
    mockReaddir.mockRejectedValue(new Error("EACCES"));

    const handler = handlers.get("fs:readdir")!;
    await expect(handler({}, "/forbidden")).rejects.toThrow("EACCES");
  });
});
