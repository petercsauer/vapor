// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SFTPWrapper } from "ssh2";

// Mock the connection pool
const mockGetConnection = vi.fn();
vi.mock("./ssh-connection-pool", () => ({
  getConnectionPool: () => ({
    getConnection: mockGetConnection,
  }),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

import { ipcMain } from "electron";
import { setupRemoteFsHandlers } from "./remote-fs-handler";

type IpcHandler = (...args: unknown[]) => unknown;
const handlers = new Map<string, IpcHandler>();

// Mock SFTP wrapper
const createMockSFTP = () => {
  return {
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn(),
    mkdir: vi.fn(),
  } as unknown as SFTPWrapper;
};

beforeEach(() => {
  handlers.clear();
  vi.mocked(ipcMain.handle).mockReset();
  vi.mocked(ipcMain.handle).mockImplementation(
    ((channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }) as any,
  );
  mockGetConnection.mockReset();
  setupRemoteFsHandlers();
});

describe("fs:remote:readdir", () => {
  it("returns sorted FsEntry array from remote directory", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.readdir as any).mockImplementation((path: string, callback: Function) => {
      callback(null, [
        { filename: "readme.md", attrs: { mode: 0o100644 } }, // Regular file
        { filename: "src", attrs: { mode: 0o040755 } }, // Directory
        { filename: "app.ts", attrs: { mode: 0o100644 } }, // Regular file
        { filename: ".", attrs: { mode: 0o040755 } }, // Should be filtered
        { filename: "..", attrs: { mode: 0o040755 } }, // Should be filtered
      ]);
    });

    const handler = handlers.get("fs:remote:readdir")!;
    const result = (await handler({}, "test-host", "/remote/dir")) as {
      name: string;
      type: string;
      path: string;
    }[];

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      name: "src",
      type: "directory",
      path: "/remote/dir/src",
    });
    expect(result[1]).toEqual({
      name: "app.ts",
      type: "file",
      path: "/remote/dir/app.ts",
    });
    expect(result[2]).toEqual({
      name: "readme.md",
      type: "file",
      path: "/remote/dir/readme.md",
    });
  });

  it("normalizes Windows-style paths", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.readdir as any).mockImplementation((path: string, callback: Function) => {
      expect(path).toBe("/remote/dir"); // Should be normalized
      callback(null, []);
    });

    const handler = handlers.get("fs:remote:readdir")!;
    await handler({}, "test-host", "\\remote\\dir");
  });

  it("propagates ENOENT error", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.readdir as any).mockImplementation((path: string, callback: Function) => {
      const err = new Error("No such file") as any;
      err.code = 2; // SFTP NO_SUCH_FILE
      callback(err);
    });

    const handler = handlers.get("fs:remote:readdir")!;
    await expect(handler({}, "test-host", "/nonexistent")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("propagates EACCES error", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.readdir as any).mockImplementation((path: string, callback: Function) => {
      const err = new Error("Permission denied") as any;
      err.code = 3; // SFTP PERMISSION_DENIED
      callback(err);
    });

    const handler = handlers.get("fs:remote:readdir")!;
    await expect(handler({}, "test-host", "/forbidden")).rejects.toMatchObject({
      code: "EACCES",
    });
  });
});

describe("fs:remote:read-file", () => {
  it("returns file content as string", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.readFile as any).mockImplementation(
      (path: string, encoding: string, callback: Function) => {
        callback(null, Buffer.from("hello world"));
      },
    );

    const handler = handlers.get("fs:remote:read-file")!;
    const result = await handler({}, "test-host", "/remote/file.txt");
    expect(result).toBe("hello world");
  });

  it("propagates ENOENT error", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.readFile as any).mockImplementation(
      (path: string, encoding: string, callback: Function) => {
        const err = new Error("No such file") as any;
        err.code = 2;
        callback(err);
      },
    );

    const handler = handlers.get("fs:remote:read-file")!;
    await expect(handler({}, "test-host", "/nonexistent.txt")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

describe("fs:remote:write-file", () => {
  it("writes content atomically", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    let tmpFilePath: string | null = null;

    (mockSFTP.writeFile as any).mockImplementation(
      (path: string, content: string, encoding: string, callback: Function) => {
        tmpFilePath = path;
        expect(path).toMatch(/\/remote\/out\.txt\.tmp\./);
        expect(content).toBe("test content");
        callback(null);
      },
    );

    (mockSFTP.rename as any).mockImplementation(
      (oldPath: string, newPath: string, callback: Function) => {
        expect(oldPath).toBe(tmpFilePath);
        expect(newPath).toBe("/remote/out.txt");
        callback(null);
      },
    );

    const handler = handlers.get("fs:remote:write-file")!;
    await handler({}, "test-host", "/remote/out.txt", "test content");
  });

  it("cleans up temp file on rename failure", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    let tmpFilePath: string | null = null;
    let unlinkCalled = false;

    (mockSFTP.writeFile as any).mockImplementation(
      (path: string, content: string, encoding: string, callback: Function) => {
        tmpFilePath = path;
        callback(null);
      },
    );

    (mockSFTP.rename as any).mockImplementation(
      (oldPath: string, newPath: string, callback: Function) => {
        const err = new Error("Rename failed") as any;
        err.code = 4;
        callback(err);
      },
    );

    (mockSFTP.unlink as any).mockImplementation((path: string, callback: Function) => {
      expect(path).toBe(tmpFilePath);
      unlinkCalled = true;
      callback(null);
    });

    const handler = handlers.get("fs:remote:write-file")!;
    await expect(
      handler({}, "test-host", "/remote/out.txt", "content"),
    ).rejects.toThrow();
    expect(unlinkCalled).toBe(true);
  });
});

describe("fs:remote:stat", () => {
  it("returns stat object for file", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.stat as any).mockImplementation((path: string, callback: Function) => {
      callback(null, {
        mode: 0o100644, // Regular file
        size: 1024,
        mtime: 1700000000, // Unix timestamp in seconds
      });
    });

    const handler = handlers.get("fs:remote:stat")!;
    const result = (await handler({}, "test-host", "/remote/file.txt")) as Record<
      string,
      unknown
    >;
    expect(result).toEqual({
      size: 1024,
      modified: 1700000000000, // Converted to milliseconds
      isDirectory: false,
      isFile: true,
    });
  });

  it("returns stat object for directory", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.stat as any).mockImplementation((path: string, callback: Function) => {
      callback(null, {
        mode: 0o040755, // Directory
        size: 4096,
        mtime: 1700000000,
      });
    });

    const handler = handlers.get("fs:remote:stat")!;
    const result = (await handler({}, "test-host", "/remote/dir")) as Record<
      string,
      unknown
    >;
    expect(result).toEqual({
      size: 4096,
      modified: 1700000000000,
      isDirectory: true,
      isFile: false,
    });
  });
});

describe("fs:remote:rename", () => {
  it("renames file or directory", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.rename as any).mockImplementation(
      (oldPath: string, newPath: string, callback: Function) => {
        expect(oldPath).toBe("/remote/old.txt");
        expect(newPath).toBe("/remote/new.txt");
        callback(null);
      },
    );

    const handler = handlers.get("fs:remote:rename")!;
    await handler({}, "test-host", "/remote/old.txt", "/remote/new.txt");
  });
});

describe("fs:remote:delete", () => {
  it("deletes file using unlink", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.stat as any).mockImplementation((path: string, callback: Function) => {
      callback(null, { mode: 0o100644 }); // Regular file
    });

    (mockSFTP.unlink as any).mockImplementation((path: string, callback: Function) => {
      expect(path).toBe("/remote/file.txt");
      callback(null);
    });

    const handler = handlers.get("fs:remote:delete")!;
    await handler({}, "test-host", "/remote/file.txt");
  });

  it("deletes directory using rmdir", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.stat as any).mockImplementation((path: string, callback: Function) => {
      callback(null, { mode: 0o040755 }); // Directory
    });

    (mockSFTP.rmdir as any).mockImplementation((path: string, callback: Function) => {
      expect(path).toBe("/remote/dir");
      callback(null);
    });

    const handler = handlers.get("fs:remote:delete")!;
    await handler({}, "test-host", "/remote/dir");
  });
});

describe("fs:remote:mkdir", () => {
  it("creates directory", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.stat as any).mockImplementation((path: string, callback: Function) => {
      // Directory doesn't exist
      const err = new Error("No such file") as any;
      err.code = 2;
      callback(err);
    });

    (mockSFTP.mkdir as any).mockImplementation((path: string, callback: Function) => {
      expect(path).toBe("/remote/newdir");
      callback(null);
    });

    const handler = handlers.get("fs:remote:mkdir")!;
    await handler({}, "test-host", "/remote/newdir");
  });

  it("creates nested directories recursively", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    const createdDirs: string[] = [];

    (mockSFTP.stat as any).mockImplementation((path: string, callback: Function) => {
      if (path === "/remote" || createdDirs.includes(path)) {
        // Parent exists or already created
        callback(null, { mode: 0o040755 });
      } else {
        // Directory doesn't exist
        const err = new Error("No such file") as any;
        err.code = 2;
        callback(err);
      }
    });

    (mockSFTP.mkdir as any).mockImplementation((path: string, callback: Function) => {
      const parentPath = path.split("/").slice(0, -1).join("/") || "/";
      if (parentPath === "/remote" || createdDirs.includes(parentPath)) {
        createdDirs.push(path);
        callback(null);
      } else {
        // Parent doesn't exist
        const err = new Error("No such file") as any;
        err.code = 2;
        callback(err);
      }
    });

    const handler = handlers.get("fs:remote:mkdir")!;
    await handler({}, "test-host", "/remote/a/b/c");

    expect(createdDirs).toContain("/remote/a");
    expect(createdDirs).toContain("/remote/a/b");
    expect(createdDirs).toContain("/remote/a/b/c");
  });

  it("succeeds if directory already exists", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.stat as any).mockImplementation((path: string, callback: Function) => {
      // Directory already exists
      callback(null, { mode: 0o040755 });
    });

    const handler = handlers.get("fs:remote:mkdir")!;
    await handler({}, "test-host", "/remote/existing");
    expect(mockSFTP.mkdir).not.toHaveBeenCalled();
  });
});

describe("timeout handling", () => {
  it("times out long operations", async () => {
    vi.useFakeTimers();
    try {
      const mockSFTP = createMockSFTP();
      mockGetConnection.mockResolvedValue(mockSFTP);

      let savedCallback: Function | undefined;
      (mockSFTP.readFile as any).mockImplementation(
        (_path: string, _encoding: string, cb: Function) => {
          savedCallback = cb;
        },
      );

      const handler = handlers.get("fs:remote:read-file")!;
      const resultPromise = handler({}, "test-host", "/remote/file.txt");

      // Prevent the rejection from being flagged as unhandled while advancing timers
      resultPromise.catch(() => {});

      await vi.advanceTimersByTimeAsync(30000);

      await expect(resultPromise).rejects.toThrow(/timed out/);

      // Settle the inner promise so it doesn't become an unhandled rejection
      if (savedCallback) savedCallback(null, Buffer.from("late"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("withTimeout clears timer on success", async () => {
    vi.useFakeTimers();
    try {
      const mockSFTP = createMockSFTP();
      mockGetConnection.mockResolvedValue(mockSFTP);

      (mockSFTP.readFile as any).mockImplementation(
        (_path: string, _encoding: string, callback: Function) => {
          callback(null, Buffer.from("data"));
        },
      );

      const handler = handlers.get("fs:remote:read-file")!;
      const result = await handler({}, "test-host", "/remote/file.txt");
      expect(result).toBe("data");

      // After the promise resolved, the timer should have been cleared.
      // Verify no pending timeout rejects by advancing past the timeout window.
      const activeTimerCount = vi.getTimerCount();
      expect(activeTimerCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("error mapping", () => {
  it("maps generic SFTP errors to EFAULT", async () => {
    const mockSFTP = createMockSFTP();
    mockGetConnection.mockResolvedValue(mockSFTP);

    (mockSFTP.readFile as any).mockImplementation(
      (path: string, encoding: string, callback: Function) => {
        const err = new Error("Unknown error") as any;
        err.code = 4; // FAILURE
        callback(err);
      },
    );

    const handler = handlers.get("fs:remote:read-file")!;
    await expect(handler({}, "test-host", "/remote/file.txt")).rejects.toMatchObject({
      code: "EFAULT",
    });
  });
});
