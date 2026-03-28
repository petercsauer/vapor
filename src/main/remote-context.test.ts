// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  DockerRemoteContext,
  SSHRemoteContext,
  createRemoteContext,
  executeDockerCommand,
} from "./remote-context";

vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("./ssh-shell-executor", () => ({
  shellEscape: (arg: string) => "'" + arg.replace(/'/g, "'\\''") + "'",
  shellReaddir: vi.fn(),
  shellReadFile: vi.fn(),
  shellWriteFile: vi.fn(),
  shellStat: vi.fn(),
  shellMkdir: vi.fn(),
  shellRename: vi.fn(),
  shellDelete: vi.fn(),
  expandTildeShell: vi.fn(),
}));

import { execFile } from "child_process";
import {
  shellReaddir,
  shellReadFile,
  shellWriteFile,
  shellStat,
  shellMkdir,
  shellRename,
  shellDelete,
  expandTildeShell,
} from "./ssh-shell-executor";

function mockExecFile(stdout: string, stderr = "") {
  (execFile as unknown as Mock).mockImplementation(
    (_cmd: string, _args: string[], _opts: any, cb?: Function) => {
      if (cb) {
        cb(null, stdout, stderr);
        return;
      }
      // promisify path: return a fake ChildProcess with then-ability
    },
  );
}

function mockExecFileError(errorProps: {
  stdout?: string;
  stderr?: string;
  code?: number;
  message?: string;
}) {
  (execFile as unknown as Mock).mockImplementation(
    (_cmd: string, _args: string[], _opts: any, cb?: Function) => {
      if (cb) {
        const err: any = new Error(errorProps.message || "exec error");
        err.stdout = errorProps.stdout || "";
        err.stderr = errorProps.stderr || "";
        err.code = errorProps.code || 1;
        cb(err);
        return;
      }
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeDockerCommand", () => {
  it("runs docker exec with correct arguments", async () => {
    mockExecFile("output\n");
    const result = await executeDockerCommand("my-container", "ls -la");

    expect(execFile).toHaveBeenCalled();
    const call = (execFile as unknown as Mock).mock.calls[0];
    expect(call[0]).toBe("docker");
    expect(call[1]).toContain("exec");
    expect(call[1]).toContain("my-container");
    expect(call[1]).toContain("sh");
    expect(call[1]).toContain("-c");
    expect(call[1]).toContain("ls -la");
    expect(result.stdout).toBe("output\n");
    expect(result.exitCode).toBe(0);
  });

  it("returns error details on failure", async () => {
    mockExecFileError({ stderr: "container not found", code: 1 });
    const result = await executeDockerCommand("bad-container", "ls");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("container not found");
  });

  it("adds -i flag when stdin is provided", async () => {
    mockExecFile("ok");
    await executeDockerCommand("my-container", "cat", { stdin: "input data" });

    const call = (execFile as unknown as Mock).mock.calls[0];
    expect(call[1]).toContain("-i");
  });
});

describe("DockerRemoteContext", () => {
  let ctx: DockerRemoteContext;

  beforeEach(() => {
    ctx = new DockerRemoteContext("test-container");
  });

  it("has correct type and host", () => {
    expect(ctx.type).toBe("docker");
    expect(ctx.host).toBe("test-container");
  });

  it("readdir parses ls output correctly", async () => {
    mockExecFile("docs/\nfile.txt\nscript.sh\nsrc/\n");
    const entries = await ctx.readdir("/app");

    expect(entries).toHaveLength(4);
    // Directories sorted first
    expect(entries[0]).toEqual({
      name: "docs",
      type: "directory",
      path: "/app/docs",
    });
    expect(entries[1]).toEqual({
      name: "src",
      type: "directory",
      path: "/app/src",
    });
    expect(entries[2]).toEqual({
      name: "file.txt",
      type: "file",
      path: "/app/file.txt",
    });
    expect(entries[3]).toEqual({
      name: "script.sh",
      type: "file",
      path: "/app/script.sh",
    });
  });

  it("readFile decodes base64 content", async () => {
    const content = "Hello, World!";
    const encoded = Buffer.from(content, "utf-8").toString("base64");
    mockExecFile(encoded + "\n");
    const result = await ctx.readFile("/app/test.txt");
    expect(result).toBe(content);
  });

  it("readFile throws on failure", async () => {
    mockExecFileError({ stderr: "No such file", code: 1 });
    await expect(ctx.readFile("/app/missing.txt")).rejects.toThrow(
      "Failed to read file",
    );
  });

  it("writeFile uses atomic write pattern", async () => {
    mockExecFile("");
    await ctx.writeFile("/app/out.txt", "new content");

    const call = (execFile as unknown as Mock).mock.calls[0];
    const shellCmd = call[1].find((a: string) => a.includes("base64 -d"));
    expect(shellCmd).toBeDefined();
    expect(shellCmd).toContain("mv ");
  });

  it("writeFile cleans up temp file on failure", async () => {
    let callCount = 0;
    (execFile as unknown as Mock).mockImplementation(
      (_cmd: string, _args: string[], _opts: any, cb?: Function) => {
        callCount++;
        if (callCount === 1) {
          const err: any = new Error("disk full");
          err.stdout = "";
          err.stderr = "disk full";
          err.code = 1;
          cb?.(err);
        } else {
          // Cleanup call succeeds
          cb?.(null, "", "");
        }
      },
    );

    await expect(ctx.writeFile("/app/out.txt", "data")).rejects.toThrow(
      "Failed to write file",
    );
    // Second call should be the rm -f cleanup
    expect(callCount).toBe(2);
  });

  it("stat parses stat output", async () => {
    mockExecFile("4096 1700000000 directory\n");
    const result = await ctx.stat("/app");

    expect(result.size).toBe(4096);
    expect(result.modified).toBe(1700000000 * 1000);
    expect(result.isDirectory).toBe(true);
    expect(result.isFile).toBe(false);
  });

  it("stat identifies regular files", async () => {
    mockExecFile("256 1700000000 regular file\n");
    const result = await ctx.stat("/app/file.txt");

    expect(result.isDirectory).toBe(false);
    expect(result.isFile).toBe(true);
  });

  it("mkdir calls mkdir -p", async () => {
    mockExecFile("");
    await ctx.mkdir("/app/new/nested");

    const call = (execFile as unknown as Mock).mock.calls[0];
    const shellCmd = call[1].find((a: string) => a.includes("mkdir -p"));
    expect(shellCmd).toBeDefined();
  });

  it("rename calls mv", async () => {
    mockExecFile("");
    await ctx.rename("/app/old.txt", "/app/new.txt");

    const call = (execFile as unknown as Mock).mock.calls[0];
    const shellCmd = call[1].find((a: string) => a.includes("mv "));
    expect(shellCmd).toBeDefined();
  });

  it("delete calls rm -rf", async () => {
    mockExecFile("");
    await ctx.delete("/app/trash");

    const call = (execFile as unknown as Mock).mock.calls[0];
    const shellCmd = call[1].find((a: string) => a.includes("rm -rf"));
    expect(shellCmd).toBeDefined();
  });

  it("expandTilde caches home directory", async () => {
    // First call: resolve $HOME
    mockExecFile("/home/user\n");
    const result1 = await ctx.expandTilde("~/docs");
    expect(result1).toBe("/home/user/docs");

    // Second call: should use cached value, no new exec
    vi.clearAllMocks();
    const result2 = await ctx.expandTilde("~/other");
    expect(result2).toBe("/home/user/other");
    expect(execFile).not.toHaveBeenCalled();
  });

  it("expandTilde returns path unchanged when no tilde", async () => {
    const result = await ctx.expandTilde("/absolute/path");
    expect(result).toBe("/absolute/path");
    expect(execFile).not.toHaveBeenCalled();
  });

  it("expandTilde falls back to /root on failure", async () => {
    mockExecFileError({ code: 1 });
    const result = await ctx.expandTilde("~/docs");
    expect(result).toBe("/root/docs");
  });

  it("getCwd returns pwd output", async () => {
    mockExecFile("/workspace\n");
    const cwd = await ctx.getCwd();
    expect(cwd).toBe("/workspace");
  });

  it("getCwd falls back to / on failure", async () => {
    mockExecFileError({ code: 1 });
    const cwd = await ctx.getCwd();
    expect(cwd).toBe("/");
  });
});

describe("SSHRemoteContext", () => {
  let ctx: SSHRemoteContext;

  beforeEach(() => {
    ctx = new SSHRemoteContext("myhost");
  });

  it("has correct type and host", () => {
    expect(ctx.type).toBe("ssh");
    expect(ctx.host).toBe("myhost");
  });

  it("delegates readdir to shellReaddir", async () => {
    const mockEntries = [
      { name: "file.txt", type: "file" as const, path: "/home/file.txt" },
    ];
    (shellReaddir as Mock).mockResolvedValue(mockEntries);
    const result = await ctx.readdir("/home");
    expect(shellReaddir).toHaveBeenCalledWith("myhost", "/home");
    expect(result).toEqual(mockEntries);
  });

  it("delegates readFile to shellReadFile", async () => {
    (shellReadFile as Mock).mockResolvedValue("file contents");
    const result = await ctx.readFile("/home/test.txt");
    expect(shellReadFile).toHaveBeenCalledWith("myhost", "/home/test.txt");
    expect(result).toBe("file contents");
  });

  it("delegates writeFile to shellWriteFile", async () => {
    (shellWriteFile as Mock).mockResolvedValue(undefined);
    await ctx.writeFile("/home/test.txt", "new contents");
    expect(shellWriteFile).toHaveBeenCalledWith(
      "myhost",
      "/home/test.txt",
      "new contents",
    );
  });

  it("delegates stat to shellStat", async () => {
    const mockStat = {
      size: 100,
      modified: 1700000000000,
      isDirectory: false,
      isFile: true,
    };
    (shellStat as Mock).mockResolvedValue(mockStat);
    const result = await ctx.stat("/home/test.txt");
    expect(shellStat).toHaveBeenCalledWith("myhost", "/home/test.txt");
    expect(result).toEqual(mockStat);
  });

  it("delegates mkdir to shellMkdir", async () => {
    (shellMkdir as Mock).mockResolvedValue(undefined);
    await ctx.mkdir("/home/newdir");
    expect(shellMkdir).toHaveBeenCalledWith("myhost", "/home/newdir");
  });

  it("delegates rename to shellRename", async () => {
    (shellRename as Mock).mockResolvedValue(undefined);
    await ctx.rename("/home/old", "/home/new");
    expect(shellRename).toHaveBeenCalledWith("myhost", "/home/old", "/home/new");
  });

  it("delegates delete to shellDelete", async () => {
    (shellDelete as Mock).mockResolvedValue(undefined);
    await ctx.delete("/home/trash");
    expect(shellDelete).toHaveBeenCalledWith("myhost", "/home/trash");
  });

  it("delegates expandTilde to expandTildeShell", async () => {
    (expandTildeShell as Mock).mockResolvedValue("/home/user/docs");
    const result = await ctx.expandTilde("~/docs");
    expect(expandTildeShell).toHaveBeenCalledWith("myhost", "~/docs");
    expect(result).toBe("/home/user/docs");
  });

  it("getCwd returns expanded home directory", async () => {
    (expandTildeShell as Mock).mockResolvedValue("/home/user");
    const cwd = await ctx.getCwd();
    expect(expandTildeShell).toHaveBeenCalledWith("myhost", "~");
    expect(cwd).toBe("/home/user");
  });
});

describe("createRemoteContext", () => {
  it("creates SSHRemoteContext for ssh type", () => {
    const ctx = createRemoteContext({ type: "ssh", host: "myhost" });
    expect(ctx).toBeInstanceOf(SSHRemoteContext);
    expect(ctx.type).toBe("ssh");
    expect(ctx.host).toBe("myhost");
  });

  it("creates DockerRemoteContext for docker type", () => {
    const ctx = createRemoteContext({ type: "docker", host: "my-container" });
    expect(ctx).toBeInstanceOf(DockerRemoteContext);
    expect(ctx.type).toBe("docker");
    expect(ctx.host).toBe("my-container");
  });

  it("throws for unknown type", () => {
    expect(() =>
      createRemoteContext({ type: "unknown" as any, host: "x" }),
    ).toThrow("Unknown target type");
  });
});
