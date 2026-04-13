// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

vi.mock("node-pty", () => ({ spawn: vi.fn() }));
vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn(), getAllWindows: vi.fn(() => []) },
}));
vi.mock("electron-log/main", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), initialize: vi.fn(), transports: { file: {} } },
}));
vi.mock("./config", () => ({ getConfig: vi.fn(() => ({ shell: { path: "", args: [] } })) }));

import * as pty from "node-pty";
import { ipcMain, BrowserWindow } from "electron";
import { parseOsc7, parseOsc133D, hasCommandStart, parseOsc633Property, parseOsc633Command, hasPromptStart, hasPromptEnd, parseRemotePrompt, parseContainerName, cleanupTempFiles, setupPtyHandlers, waitForPrompt } from "./pty-manager";

describe("parseOsc7", () => {
  it("parses BEL-terminated OSC 7", () => {
    const data = "\x1b]7;file://myhost/home/user\x07";
    const result = parseOsc7(data);
    expect(result).toEqual({ hostname: "myhost", cwd: "/home/user" });
  });

  it("parses ST-terminated OSC 7", () => {
    const data = "\x1b]7;file://server/tmp/dir\x1b\\";
    const result = parseOsc7(data);
    expect(result).toEqual({ hostname: "server", cwd: "/tmp/dir" });
  });

  it("returns last match when multiple OSC 7 sequences exist", () => {
    const data = "\x1b]7;file://h1/first\x07some output\x1b]7;file://h2/second\x07";
    const result = parseOsc7(data);
    expect(result).toEqual({ hostname: "h2", cwd: "/second" });
  });

  it("returns null when no OSC 7 present", () => {
    expect(parseOsc7("just regular output")).toBeNull();
  });

  it("decodes percent-encoded paths", () => {
    const data = "\x1b]7;file://host/home/user/my%20dir\x07";
    const result = parseOsc7(data);
    expect(result).toEqual({ hostname: "host", cwd: "/home/user/my dir" });
  });

  it("handles empty hostname", () => {
    const data = "\x1b]7;file:///usr/local\x07";
    const result = parseOsc7(data);
    expect(result).toEqual({ hostname: "", cwd: "/usr/local" });
  });

  it("returns null for malformed percent-encoding instead of throwing", () => {
    const data = "\x1b]7;file://host/home/%ZZbadpath\x07";
    expect(parseOsc7(data)).toBeNull();
  });

  it("skips malformed sequence but keeps valid earlier match", () => {
    const data =
      "\x1b]7;file://host/good/path\x07" +
      "\x1b]7;file://host/bad/%ZZpath\x07";
    const result = parseOsc7(data);
    expect(result).toEqual({ hostname: "host", cwd: "/good/path" });
  });
});

describe("parseOsc133D", () => {
  it("parses exit code 0", () => {
    const data = "\x1b]133;D;0\x07";
    expect(parseOsc133D(data)).toBe(0);
  });

  it("parses non-zero exit code", () => {
    const data = "\x1b]133;D;127\x07";
    expect(parseOsc133D(data)).toBe(127);
  });

  it("defaults to 0 when no code specified", () => {
    const data = "\x1b]133;D\x07";
    expect(parseOsc133D(data)).toBe(0);
  });

  it("parses ST-terminated sequence", () => {
    const data = "\x1b]133;D;1\x1b\\";
    expect(parseOsc133D(data)).toBe(1);
  });

  it("returns last exit code when multiple present", () => {
    const data = "\x1b]133;D;0\x07some output\x1b]133;D;42\x07";
    expect(parseOsc133D(data)).toBe(42);
  });

  it("returns null when no OSC 133 D present", () => {
    expect(parseOsc133D("regular output")).toBeNull();
  });
});

describe("hasCommandStart", () => {
  it("detects OSC 133 B (BEL)", () => {
    expect(hasCommandStart("\x1b]133;B\x07")).toBe(true);
  });

  it("detects OSC 133 C (BEL)", () => {
    expect(hasCommandStart("\x1b]133;C\x07")).toBe(true);
  });

  it("detects OSC 133 B (ST)", () => {
    expect(hasCommandStart("\x1b]133;B\x1b\\")).toBe(true);
  });

  it("returns false for other data", () => {
    expect(hasCommandStart("just text")).toBe(false);
  });
});

describe("parseOsc633Property", () => {
  it("parses Cwd property with BEL terminator", () => {
    expect(parseOsc633Property("\x1b]633;P;Cwd=/home/user\x07"))
      .toEqual({ key: "Cwd", value: "/home/user" });
  });
  it("parses Cwd property with ST terminator", () => {
    expect(parseOsc633Property("\x1b]633;P;Cwd=/tmp\x1b\\"))
      .toEqual({ key: "Cwd", value: "/tmp" });
  });
  it("returns null when no property present", () => {
    expect(parseOsc633Property("regular text")).toBeNull();
  });
  it("handles paths with spaces", () => {
    expect(parseOsc633Property("\x1b]633;P;Cwd=/home/user/my dir\x07"))
      .toEqual({ key: "Cwd", value: "/home/user/my dir" });
  });
  it("handles escaped semicolons in value", () => {
    expect(parseOsc633Property("\x1b]633;P;Cwd=/path\\x3bwith\\x3bsemicolons\x07"))
      .toEqual({ key: "Cwd", value: "/path;with;semicolons" });
  });
});

describe("parseOsc633Command", () => {
  it("parses command text with BEL terminator", () => {
    expect(parseOsc633Command("\x1b]633;E;ls -la\x07")).toBe("ls -la");
  });
  it("parses command text with ST terminator", () => {
    expect(parseOsc633Command("\x1b]633;E;git status\x1b\\")).toBe("git status");
  });
  it("returns null when no command present", () => {
    expect(parseOsc633Command("regular text")).toBeNull();
  });
  it("unescapes semicolons", () => {
    expect(parseOsc633Command("\x1b]633;E;echo hello\\x3b echo world\x07"))
      .toBe("echo hello; echo world");
  });
});

describe("hasPromptStart", () => {
  it("detects OSC 133 A with BEL", () => {
    expect(hasPromptStart("\x1b]133;A\x07")).toBe(true);
  });
  it("detects OSC 133 A with ST", () => {
    expect(hasPromptStart("\x1b]133;A\x1b\\")).toBe(true);
  });
  it("returns false for other data", () => {
    expect(hasPromptStart("regular text")).toBe(false);
  });
});

describe("hasPromptEnd", () => {
  it("detects OSC 133 B with BEL", () => {
    expect(hasPromptEnd("\x1b]133;B\x07")).toBe(true);
  });
  it("detects OSC 133 B with ST", () => {
    expect(hasPromptEnd("\x1b]133;B\x1b\\")).toBe(true);
  });
  it("returns false for other data", () => {
    expect(hasPromptEnd("regular text")).toBe(false);
  });
});

describe("parseRemotePrompt", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("extracts CWD from Debian-style prompt", () => {
    const output = "user@myhost:~/projects$ ";
    const result = parseRemotePrompt(output, "ssh myhost");
    expect(result).toBeDefined();
    expect(result!.cwd).toBe("~/projects");
  });

  it("extracts CWD from RHEL-style prompt", () => {
    const output = "[user@myhost ~/projects]$ ";
    const result = parseRemotePrompt(output, "ssh myhost");
    expect(result).toBeDefined();
    expect(result!.cwd).toBe("~/projects");
  });

  it("handles prompt with user typing after it", () => {
    const output = "user@myhost:~/docs$ ls -la";
    const result = parseRemotePrompt(output, "ssh myhost");
    expect(result).toBeDefined();
    expect(result!.cwd).toBe("~/docs");
  });

  it("uses SSH target as host", () => {
    const output = "user@A3919:~/applied3$ ";
    const result = parseRemotePrompt(output, "ssh avo1");
    expect(result).toBeDefined();
    expect(result!.host).toBeDefined();
  });

  it("returns null for non-SSH commands", () => {
    const result = parseRemotePrompt("some output", "");
    expect(result).toBeNull();
  });

  it("extracts host from ssh command with user@host", () => {
    const output = "some banner text\nno prompt here";
    const result = parseRemotePrompt(output, "ssh admin@server.example.com");
    expect(result).toBeDefined();
    expect(result!.host).toBe("server.example.com");
  });

  it("strips ANSI escape codes before matching", () => {
    const output = "\x1b[32muser@host\x1b[0m:\x1b[34m~/dir\x1b[0m$ ";
    const result = parseRemotePrompt(output, "ssh host");
    expect(result).toBeDefined();
    expect(result!.cwd).toBe("~/dir");
  });

  it("returns home for empty CWD in prompt", () => {
    const output = "user@host:~$ ";
    const result = parseRemotePrompt(output, "ssh host");
    expect(result).toBeDefined();
    expect(result!.cwd).toBe("~");
  });
});

describe("parseContainerName", () => {
  it("extracts container name from docker exec", () => {
    expect(parseContainerName("docker exec -it my-container /bin/bash")).toBe("my-container");
  });

  it("extracts container name from docker exec with workdir", () => {
    expect(parseContainerName("docker exec --workdir /workspace my-container /bin/bash")).toBe("my-container");
  });

  it("extracts container name from docker run", () => {
    expect(parseContainerName("docker run -it ubuntu:latest")).toBe("ubuntu:latest");
  });

  it("extracts container name from podman exec", () => {
    expect(parseContainerName("podman exec -it dev-env bash")).toBe("dev-env");
  });

  it("extracts container name from nerdctl exec", () => {
    expect(parseContainerName("nerdctl exec -it mybox sh")).toBe("mybox");
  });

  it("returns empty string for non-container commands", () => {
    expect(parseContainerName("ssh avo1")).toBe("");
  });

  it("returns empty string for empty command", () => {
    expect(parseContainerName("")).toBe("");
  });

  it("handles docker exec with multiple flags", () => {
    expect(parseContainerName("docker exec -it -u root simple-dev-1 /bin/bash -l")).toBe("simple-dev-1");
  });
});

describe("cleanupTempFiles", () => {
  it("deletes existing files", () => {
    const tmpFile = path.join(os.tmpdir(), `vapor-test-cleanup-${Date.now()}.tmp`);
    fs.writeFileSync(tmpFile, "test");
    expect(fs.existsSync(tmpFile)).toBe(true);

    cleanupTempFiles([tmpFile]);

    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  it("removes empty directories via rmdirSync fallback", () => {
    const tmpDir = path.join(os.tmpdir(), `vapor-test-cleanup-dir-${Date.now()}`);
    fs.mkdirSync(tmpDir);
    expect(fs.existsSync(tmpDir)).toBe(true);

    cleanupTempFiles([tmpDir]);

    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  it("ignores nonexistent paths without throwing", () => {
    expect(() => {
      cleanupTempFiles(["/nonexistent/path/that/does/not/exist"]);
    }).not.toThrow();
  });

  it("processes a mix of files, directories, and missing paths", () => {
    const tmpFile = path.join(os.tmpdir(), `vapor-test-mix-file-${Date.now()}.tmp`);
    const tmpDir = path.join(os.tmpdir(), `vapor-test-mix-dir-${Date.now()}`);
    fs.writeFileSync(tmpFile, "test");
    fs.mkdirSync(tmpDir);

    cleanupTempFiles([tmpFile, tmpDir, "/nonexistent"]);

    expect(fs.existsSync(tmpFile)).toBe(false);
    expect(fs.existsSync(tmpDir)).toBe(false);
  });
});

describe("PTY lifecycle", () => {
  let createHandler: (...args: unknown[]) => unknown;
  let killHandler: (...args: unknown[]) => unknown;
  let getStateHandler: (...args: unknown[]) => unknown;

  function createMockPtyProcess() {
    return {
      pid: 12345,
      process: "bash",
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onExit: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
    };
  }

  const mockEvent = {
    sender: {
      isDestroyed: vi.fn(() => false),
      send: vi.fn(),
    },
  };

  beforeAll(() => {
    setupPtyHandlers();
    const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
    createHandler = handleCalls.find((c) => c[0] === "pty:create")![1];
    killHandler = handleCalls.find((c) => c[0] === "pty:kill")![1];
    getStateHandler = handleCalls.find((c) => c[0] === "pty:get-state")![1];
  });

  afterEach(() => {
    vi.mocked(pty.spawn).mockReset();
    vi.useRealTimers();
  });

  it("pty:kill clears all pending timeouts for the session", () => {
    vi.useFakeTimers();

    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);

    const { sessionId } = createHandler(mockEvent, { command: "ls" });

    mockProcess.write.mockClear();

    killHandler({}, { sessionId });

    vi.advanceTimersByTime(5000);
    expect(mockProcess.write).not.toHaveBeenCalled();
  });

  it("pty:create with failing spawn cleans up temp files and throws", () => {
    const defaultShell = process.env.SHELL || (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
    const shellBase = path.basename(defaultShell);

    vi.mocked(pty.spawn).mockImplementation(() => {
      throw new Error("spawn failed");
    });

    expect(() => createHandler(mockEvent, {})).toThrow(/Failed to spawn/);

    if (shellBase === "zsh" || shellBase === "-zsh") {
      const zshenvPath = path.join(os.tmpdir(), `vapor-zsh-${process.pid}`, ".zshenv");
      expect(fs.existsSync(zshenvPath)).toBe(false);
    } else if (shellBase === "bash" || shellBase === "-bash") {
      const tmpEntries = fs.readdirSync(os.tmpdir());
      const bashFiles = tmpEntries.filter(
        (f) => f.startsWith(`vapor-bash-${process.pid}-`) && f.endsWith(".sh"),
      );
      expect(bashFiles).toHaveLength(0);
    }
  });

  it("temp files are deleted when session is killed", () => {
    const defaultShell = process.env.SHELL || (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
    const shellBase = path.basename(defaultShell);
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);

    const { sessionId } = createHandler(mockEvent, {});

    if (shellBase === "zsh" || shellBase === "-zsh") {
      const zshenvPath = path.join(os.tmpdir(), `vapor-zsh-${process.pid}`, ".zshenv");
      expect(fs.existsSync(zshenvPath)).toBe(true);

      killHandler({}, { sessionId });

      expect(fs.existsSync(zshenvPath)).toBe(false);
    } else {
      killHandler({}, { sessionId });

      const tmpEntries = fs.readdirSync(os.tmpdir());
      const bashFiles = tmpEntries.filter(
        (f) => f.startsWith(`vapor-bash-${process.pid}-`) && f.endsWith(".sh"),
      );
      expect(bashFiles).toHaveLength(0);
    }
  });

  it("pty:create initializes SessionState with correct defaults", () => {
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);

    const { sessionId } = createHandler(mockEvent, { cwd: "/tmp/test" });

    const state = getStateHandler({}, { sessionId });
    expect(state).not.toBeNull();
    expect(state.sessionId).toBe(sessionId);
    expect(state.localCwd).toBe("/tmp/test");
    expect(state.target).toBeNull();
    expect(state.integrationLevel).toBe("passive");
    expect(state.childProcess).toBe("");
    expect(state.childCommand).toBe("");
    expect(state.containerName).toBe("");
    expect(state.lastUpdated).toBeGreaterThan(0);

    killHandler({}, { sessionId });
  });

  it("pty:create uses homedir when cwd not specified", () => {
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);

    const { sessionId } = createHandler(mockEvent, {});

    const state = getStateHandler({}, { sessionId });
    expect(state.localCwd).toBe(os.homedir());

    killHandler({}, { sessionId });
  });

  it("pty:get-state returns null for nonexistent session", () => {
    const result = getStateHandler({}, { sessionId: "nonexistent-session" });
    expect(result).toBeNull();
  });

  it("onData updates SessionState localCwd on local OSC 7", () => {
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    const { sessionId } = createHandler(mockEvent, {});

    const onDataCallback = mockProcess.onData.mock.calls[0][0];
    const localHostname = os.hostname();
    onDataCallback(`\x1b]7;file://${localHostname}/home/user/projects\x07`);

    const state = getStateHandler({}, { sessionId });
    expect(state.localCwd).toBe("/home/user/projects");

    killHandler({}, { sessionId });
  });

  it("onData updates SessionState target on remote OSC 7", () => {
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    const { sessionId } = createHandler(mockEvent, {});

    const onDataCallback = mockProcess.onData.mock.calls[0][0];
    onDataCallback("\x1b]7;file://remote-server.example.com/var/www\x07");

    const state = getStateHandler({}, { sessionId });
    expect(state.target).toEqual({
      type: "ssh",
      host: "remote-server.example.com",
      cwd: "/var/www",
    });

    killHandler({}, { sessionId });
  });

  it("updateSessionState sends pty:state-updated IPC event", () => {
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);

    const mockWin = { id: 1, isDestroyed: () => false, webContents: { send: vi.fn() } };
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockWin as any);
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWin] as any);

    const { sessionId } = createHandler(mockEvent, {});

    const onDataCallback = mockProcess.onData.mock.calls[0][0];
    const localHostname = os.hostname();
    onDataCallback(`\x1b]7;file://${localHostname}/new/path\x07`);

    const sendCalls = mockWin.webContents.send.mock.calls;
    const stateUpdateCall = sendCalls.find(
      (c: unknown[]) => c[0] === "pty:state-updated",
    );
    expect(stateUpdateCall).toBeDefined();
    expect(stateUpdateCall![1].localCwd).toBe("/new/path");

    killHandler({}, { sessionId });
  });
});

describe("integration level detection", () => {
  let createHandler: (...args: unknown[]) => any;
  let killHandler: (...args: unknown[]) => any;
  let getStateHandler: (...args: unknown[]) => any;

  function createMockPtyProcess() {
    return {
      pid: 12345,
      process: "bash",
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onExit: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
    };
  }

  const mockEvent = {
    sender: {
      isDestroyed: vi.fn(() => false),
      send: vi.fn(),
    },
  };

  beforeAll(() => {
    const handleCalls = vi.mocked(ipcMain.handle).mock.calls;
    createHandler = handleCalls.find((c) => c[0] === "pty:create")![1];
    killHandler = handleCalls.find((c) => c[0] === "pty:kill")![1];
    getStateHandler = handleCalls.find((c) => c[0] === "pty:get-state")![1];
  });

  afterEach(() => {
    vi.mocked(pty.spawn).mockReset();
  });

  it("upgrades to full on OSC 633 P;Cwd", () => {
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    const { sessionId } = createHandler(mockEvent, {});
    const state = getStateHandler({}, { sessionId });
    expect(state.integrationLevel).toBe("passive");

    const onDataCallback = mockProcess.onData.mock.calls[0][0];
    onDataCallback("\x1b]633;P;Cwd=/home/user\x07");

    const updated = getStateHandler({}, { sessionId });
    expect(updated.integrationLevel).toBe("full");

    killHandler({}, { sessionId });
  });

  it("upgrades to full on OSC 133 A (prompt start)", () => {
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    const { sessionId } = createHandler(mockEvent, {});

    const onDataCallback = mockProcess.onData.mock.calls[0][0];
    onDataCallback("\x1b]133;A\x07");

    const updated = getStateHandler({}, { sessionId });
    expect(updated.integrationLevel).toBe("full");

    killHandler({}, { sessionId });
  });

  it("upgrades to full on OSC 133 D (command finished)", () => {
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    const { sessionId } = createHandler(mockEvent, {});

    const onDataCallback = mockProcess.onData.mock.calls[0][0];
    onDataCallback("\x1b]133;D;0\x07");

    const updated = getStateHandler({}, { sessionId });
    expect(updated.integrationLevel).toBe("full");

    killHandler({}, { sessionId });
  });

  it("upgrades to full on OSC 633 E (command text)", () => {
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    const { sessionId } = createHandler(mockEvent, {});

    const onDataCallback = mockProcess.onData.mock.calls[0][0];
    onDataCallback("\x1b]633;E;ls -la\x07");

    const updated = getStateHandler({}, { sessionId });
    expect(updated.integrationLevel).toBe("full");

    killHandler({}, { sessionId });
  });

  it("stays passive without integration sequences", () => {
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    const { sessionId } = createHandler(mockEvent, {});

    const onDataCallback = mockProcess.onData.mock.calls[0][0];
    onDataCallback("regular terminal output with no OSC sequences");
    onDataCallback("more plain text\r\nand newlines");

    const state = getStateHandler({}, { sessionId });
    expect(state.integrationLevel).toBe("passive");

    killHandler({}, { sessionId });
  });

  it("does not downgrade once upgraded to full", () => {
    const mockProcess = createMockPtyProcess();
    vi.mocked(pty.spawn).mockReturnValue(mockProcess as any);
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    const { sessionId } = createHandler(mockEvent, {});

    const onDataCallback = mockProcess.onData.mock.calls[0][0];
    onDataCallback("\x1b]133;A\x07");

    let state = getStateHandler({}, { sessionId });
    expect(state.integrationLevel).toBe("full");

    onDataCallback("plain text after upgrade");
    state = getStateHandler({}, { sessionId });
    expect(state.integrationLevel).toBe("full");

    killHandler({}, { sessionId });
  });
});

describe("waitForPrompt", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function createMockPtyWithEmitter() {
    type DataHandler = (data: string) => void;
    const handlers: DataHandler[] = [];
    const mockPty = {
      pid: 99999,
      process: "bash",
      onData: vi.fn((handler: DataHandler) => {
        handlers.push(handler);
        return {
          dispose: () => {
            const idx = handlers.indexOf(handler);
            if (idx >= 0) handlers.splice(idx, 1);
          },
        };
      }),
      onExit: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      emit(data: string) {
        for (const h of [...handlers]) h(data);
      },
    };
    return mockPty;
  }

  it("resolves when OSC 133 B (prompt end) is detected", async () => {
    vi.useFakeTimers();
    const mockPty = createMockPtyWithEmitter();

    const promise = waitForPrompt(mockPty as any, 5000);

    mockPty.emit("\x1b]133;B\x07");
    vi.advanceTimersByTime(200);

    await promise;
    expect(mockPty.onData).toHaveBeenCalledTimes(1);
  });

  it("resolves when OSC 133 A (prompt start) is detected", async () => {
    vi.useFakeTimers();
    const mockPty = createMockPtyWithEmitter();

    const promise = waitForPrompt(mockPty as any, 5000);

    mockPty.emit("\x1b]133;A\x07");
    vi.advanceTimersByTime(200);

    await promise;
  });

  it("resolves on timeout if no prompt markers appear", async () => {
    vi.useFakeTimers();
    const mockPty = createMockPtyWithEmitter();

    const promise = waitForPrompt(mockPty as any, 3000);

    mockPty.emit("regular output with no markers");
    vi.advanceTimersByTime(3000);

    await promise;
  });

  it("debounces multiple rapid prompt markers", async () => {
    vi.useFakeTimers();
    const mockPty = createMockPtyWithEmitter();

    let resolved = false;
    const promise = waitForPrompt(mockPty as any, 5000).then(() => {
      resolved = true;
    });

    mockPty.emit("\x1b]133;A\x07");
    vi.advanceTimersByTime(100);
    expect(resolved).toBe(false);

    mockPty.emit("\x1b]133;B\x07");
    vi.advanceTimersByTime(100);
    expect(resolved).toBe(false);

    mockPty.emit("\x1b]133;A\x07");
    vi.advanceTimersByTime(200);
    await promise;
    expect(resolved).toBe(true);
  });

  it("cleans up onData listener after resolving", async () => {
    vi.useFakeTimers();
    const mockPty = createMockPtyWithEmitter();

    const promise = waitForPrompt(mockPty as any, 5000);

    mockPty.emit("\x1b]133;B\x07");
    vi.advanceTimersByTime(200);
    await promise;

    const handlerCountBefore = mockPty.onData.mock.calls.length;
    mockPty.emit("\x1b]133;B\x07");
    expect(mockPty.onData.mock.calls.length).toBe(handlerCountBefore);
  });
});
