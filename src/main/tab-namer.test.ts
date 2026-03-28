// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import * as os from "os";

const { mockCustomPromisify } = vi.hoisted(() => ({
  mockCustomPromisify: vi.fn(
    (): Promise<{ stdout: string; stderr: string }> =>
      Promise.reject(new Error("not in git repo")),
  ),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock("child_process", () => {
  const fn = Object.assign(
    vi.fn(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error) => void,
      ) => {
        cb(new Error("not in git repo"));
      },
    ),
    {
      __promisify__: mockCustomPromisify,
      [Symbol.for("nodejs.util.promisify.custom")]: mockCustomPromisify,
    },
  );
  return { execFile: fn };
});

import { shortenPath, generateTabName } from "./tab-namer";

describe("shortenPath", () => {
  it("replaces home directory with ~", () => {
    const home = os.homedir();
    expect(shortenPath(home)).toBe("~");
  });

  it("replaces home prefix with ~/", () => {
    const home = os.homedir();
    expect(shortenPath(home + "/projects")).toBe("~/projects");
  });

  it("shortens deep paths to last 2 components", () => {
    const home = os.homedir();
    expect(shortenPath(home + "/a/b/c/d")).toBe("c/d");
  });

  it("keeps short paths intact", () => {
    expect(shortenPath("/tmp")).toBe("/tmp");
  });

  it("handles /home/user paths (remote)", () => {
    expect(shortenPath("/home/someone/projects")).toBe("~/projects");
  });

  it("shortens deep remote paths", () => {
    expect(shortenPath("/home/user/a/b/c")).toBe("b/c");
  });

  it("handles root path", () => {
    expect(shortenPath("/")).toBe("/");
  });
});

describe("generateTabName", () => {
  it("returns shortened remoteCwd when present", async () => {
    const result = await generateTabName({
      cwd: "/local/path",
      processName: "ssh",
      command: "ssh host",
      remoteCwd: "/home/user/projects",
    });
    expect(result).toBe("~/projects");
  });

  it("falls back to local CWD when no remoteCwd", async () => {
    const home = os.homedir();
    const result = await generateTabName({
      cwd: home + "/code",
      processName: "zsh",
      command: "",
    });
    expect(result).toBe("~/code");
  });

  it("returns ~ for home directory", async () => {
    const home = os.homedir();
    const result = await generateTabName({
      cwd: home,
      processName: "zsh",
      command: "",
    });
    expect(result).toBe("~");
  });

  it("shortens deep local paths", async () => {
    const home = os.homedir();
    const result = await generateTabName({
      cwd: home + "/a/b/c/d",
      processName: "zsh",
      command: "",
    });
    expect(result).toBe("c/d");
  });

  it("returns git repo basename when inside a git repo", async () => {
    mockCustomPromisify.mockResolvedValueOnce({
      stdout: "/Users/dev/my-awesome-repo\n",
      stderr: "",
    });

    const result = await generateTabName({
      cwd: "/unique-git-test-cwd",
      processName: "zsh",
      command: "",
    });
    expect(result).toBe("my-awesome-repo");
  });
});
