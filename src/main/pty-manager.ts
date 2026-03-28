import * as pty from "node-pty";
import { ipcMain, BrowserWindow } from "electron";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { execSync, execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
import { getConfig } from "./config";
import type { SessionState } from "../shared/types";

function shellQuote(s: string): string {
  if (!s) return "''";
  if (/^[a-zA-Z0-9_.\/\-]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

interface Osc7Info {
  hostname: string;
  cwd: string;
}

interface PtySession {
  process: pty.IPty;
  windowId: number;
  lastOsc7: Osc7Info | null;
  recentOutput: string;
  timeouts: ReturnType<typeof setTimeout>[];
  tempFiles: string[];
  state: SessionState;
  lastStateUpdate: number;
}

const sessions = new Map<string, PtySession>();

const SHELL_NAMES = new Set(["zsh", "bash", "fish", "sh", "tcsh", "csh", "-zsh", "-bash"]);

// eslint-disable-next-line no-control-regex
const OSC7_RE = /\x1b\]7;file:\/\/([^/]*)(\/[^\x07\x1b]*)\x07|\x1b\]7;file:\/\/([^/]*)(\/[^\x07\x1b]*)\x1b\\/g;

export function parseOsc7(data: string): Osc7Info | null {
  let last: Osc7Info | null = null;
  let match: RegExpExecArray | null;
  OSC7_RE.lastIndex = 0;
  while ((match = OSC7_RE.exec(data)) !== null) {
    const hostname = match[1] ?? match[3] ?? "";
    const rawPath = match[2] ?? match[4] ?? "/";
    try {
      last = { hostname, cwd: decodeURIComponent(rawPath) };
    } catch {
      continue;
    }
  }
  return last;
}

// eslint-disable-next-line no-control-regex
const OSC133D_RE = /\x1b\]133;D(?:;(\d+))?\x07|\x1b\]133;D(?:;(\d+))?\x1b\\/g;
// eslint-disable-next-line no-control-regex
const OSC133B_RE = /\x1b\]133;[BC]\x07|\x1b\]133;[BC]\x1b\\/;

export function parseOsc133D(data: string): number | null {
  let last: number | null = null;
  let match: RegExpExecArray | null;
  OSC133D_RE.lastIndex = 0;
  while ((match = OSC133D_RE.exec(data)) !== null) {
    const code = match[1] ?? match[2] ?? "0";
    last = parseInt(code, 10);
  }
  return last;
}

export function hasCommandStart(data: string): boolean {
  return OSC133B_RE.test(data);
}

// eslint-disable-next-line no-control-regex
const OSC633_PROP_RE = /\x1b\]633;P;([^=]+)=([^\x07\x1b]*?)(?:\x07|\x1b\\)/;

export function parseOsc633Property(data: string): { key: string; value: string } | null {
  const match = OSC633_PROP_RE.exec(data);
  if (!match) return null;
  const key = match[1];
  const value = match[2].replace(/\\x3b/g, ";");
  return { key, value };
}

// eslint-disable-next-line no-control-regex
const OSC633_CMD_RE = /\x1b\]633;E;([^\x07\x1b]*?)(?:\x07|\x1b\\)/;

export function parseOsc633Command(data: string): string | null {
  const match = OSC633_CMD_RE.exec(data);
  if (!match) return null;
  return match[1].replace(/\\x3b/g, ";");
}

// eslint-disable-next-line no-control-regex
const OSC133A_RE = /\x1b\]133;A(?:\x07|\x1b\\)/;

export function hasPromptStart(data: string): boolean {
  return OSC133A_RE.test(data);
}

// eslint-disable-next-line no-control-regex
const OSC133B_ONLY_RE = /\x1b\]133;B(?:\x07|\x1b\\)/;

export function hasPromptEnd(data: string): boolean {
  return OSC133B_ONLY_RE.test(data);
}

let sshConfigHosts: Set<string> | null = null;

function getSshConfigHosts(): Set<string> {
  if (sshConfigHosts) return sshConfigHosts;
  sshConfigHosts = new Set();
  try {
    const configPath = path.join(os.homedir(), ".ssh", "config");
    const content = fs.readFileSync(configPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*Host\s+(.+)/i);
      if (m) {
        for (const h of m[1].split(/\s+/)) {
          if (!h.includes("*") && !h.includes("?")) sshConfigHosts.add(h);
        }
      }
    }
  } catch { /* no config */ }
  return sshConfigHosts;
}

function resolveSSHHost(sshTarget: string, promptHost: string): string {
  if (getSshConfigHosts().has(sshTarget)) return sshTarget;
  return promptHost || sshTarget;
}

// eslint-disable-next-line no-control-regex
const OSC2_TITLE_RE = /\x1b\]2;([^\x07\x1b]*?)(?:\x07|\x1b\\)/g;

export function parseOsc2Title(output: string): { user: string; host: string; cwd: string } | null {
  let last: string | null = null;
  OSC2_TITLE_RE.lastIndex = 0;
  let m;
  while ((m = OSC2_TITLE_RE.exec(output)) !== null) {
    last = m[1];
  }
  if (!last) return null;
  const titleMatch = last.match(/^(\S+)@(\S+?):(.+)$/);
  if (!titleMatch) return null;
  return { user: titleMatch[1], host: titleMatch[2], cwd: titleMatch[3] };
}

export function parseRemotePrompt(
  output: string,
  sshCommand: string,
): { host: string; cwd: string } | null {
  const hostMatch = sshCommand.match(/ssh\s+.*?(?:\S+@)?(\S+)$/);
  const sshTarget = hostMatch?.[1] ?? "";
  if (!sshTarget) return null;

  const titleInfo = parseOsc2Title(output);
  if (titleInfo && titleInfo.cwd) {
    return { host: resolveSSHHost(sshTarget, titleInfo.host), cwd: titleInfo.cwd };
  }

  // eslint-disable-next-line no-control-regex
  const clean = output.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "");
  const lines = clean.split("\n");

  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
    const line = lines[i].trim();
    if (!line) continue;

    const debianMatch = line.match(/\S+@(\S+?):(~?\S*)\s*[$%#>]/);
    if (debianMatch) {
      return { host: resolveSSHHost(sshTarget, debianMatch[1]), cwd: debianMatch[2] || "~" };
    }

    const rhelMatch = line.match(/\[\S+@(\S+)\s+(~?\S*)\]\s*[$%#>]/);
    if (rhelMatch) {
      return { host: resolveSSHHost(sshTarget, rhelMatch[1]), cwd: rhelMatch[2] || "~" };
    }
  }

  return { host: sshTarget, cwd: "" };
}

const FLAGS_WITH_VALUE = new Set([
  "-u", "--user", "-w", "--workdir", "-e", "--env",
  "--name", "--hostname", "--network", "--pid",
  "--volume", "-v", "--mount", "--cpus", "--memory",
]);

export function parseContainerName(command: string): string {
  if (!command) return "";
  const m = command.match(/^(docker|podman|nerdctl)\s+(exec|run)\s+(.*)$/);
  if (!m) return "";
  const rest = m[3];
  const tokens = rest.split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (!tok.startsWith("-")) break;
    if (tok.includes("=")) { i++; continue; }
    if (FLAGS_WITH_VALUE.has(tok)) { i += 2; continue; }
    i++;
  }
  return tokens[i] || "";
}

export function waitForPrompt(
  ptyProcess: pty.IPty,
  timeoutMs: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const fallbackTimer = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);

    const dataHandler = (data: string) => {
      if (hasPromptEnd(data) || hasPromptStart(data)) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          cleanup();
          resolve();
        }, 200);
      }
    };

    const disposable = ptyProcess.onData(dataHandler);

    function cleanup() {
      clearTimeout(fallbackTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      disposable.dispose();
    }
  });
}

let nextId = 0;

function getDefaultShell(): string {
  if (process.platform === "darwin") {
    return process.env.SHELL || "/bin/zsh";
  }
  return process.env.SHELL || "/bin/bash";
}

function getShell(): { shell: string; args: string[] } {
  const config = getConfig();
  if (config.shell.path) {
    return { shell: config.shell.path, args: config.shell.args };
  }
  return { shell: getDefaultShell(), args: [] };
}

async function getCwd(pid: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "/usr/sbin/lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"],
      { encoding: "utf8", timeout: 2000 },
    );
    const line = stdout.split("\n").find((l) => l.startsWith("n"));
    if (line) return line.slice(1);
  } catch {
    // fall through
  }
  return os.homedir();
}

interface PsCache {
  data: Map<number, string>;
  timestamp: number;
}

let psCache: PsCache | null = null;
const PS_CACHE_TTL = 2000;

async function getChildCommandMap(): Promise<Map<number, string>> {
  const now = Date.now();
  if (psCache && now - psCache.timestamp < PS_CACHE_TTL) return psCache.data;

  const result = new Map<number, string>();
  try {
    const { stdout } = await execFileAsync(
      "/bin/ps", ["-ww", "-ax", "-o", "ppid=,args="],
      { encoding: "utf8", timeout: 3000 },
    );
    for (const line of stdout.split("\n")) {
      const trimmed = line.trimStart();
      const spaceIdx = trimmed.indexOf(" ");
      if (spaceIdx < 0) continue;
      const ppid = parseInt(trimmed.slice(0, spaceIdx), 10);
      if (isNaN(ppid)) continue;
      const args = trimmed.slice(spaceIdx + 1);
      if (/^-?(zsh|bash|fish|sh|tcsh|csh)/.test(args)) continue;
      result.set(ppid, args);
    }
  } catch { /* empty */ }
  psCache = { data: result, timestamp: now };
  return result;
}

async function getChildCommand(shellPid: number): Promise<string> {
  const map = await getChildCommandMap();
  return map.get(shellPid) ?? "";
}

function getChildCommandSync(shellPid: number): string {
  try {
    const raw = execSync(
      `/bin/ps -ww -ax -o ppid=,args=`,
      { encoding: "utf8", timeout: 3000 },
    );
    for (const line of raw.split("\n")) {
      const trimmed = line.trimStart();
      const spaceIdx = trimmed.indexOf(" ");
      if (spaceIdx < 0) continue;
      const ppid = parseInt(trimmed.slice(0, spaceIdx), 10);
      if (ppid === shellPid) {
        const args = trimmed.slice(spaceIdx + 1);
        if (/^-?(zsh|bash|fish|sh|tcsh|csh)/.test(args)) continue;
        return args;
      }
    }
    return "";
  } catch {
    return "";
  }
}

function getCwdSync(pid: number): string {
  try {
    const output = execSync(`lsof -a -p ${pid} -d cwd -Fn`, {
      encoding: "utf8",
      timeout: 2000,
    });
    const line = output.split("\n").find((l) => l.startsWith("n"));
    if (line) return line.slice(1);
  } catch { /* empty */ }
  return os.homedir();
}

export function cleanupTempFiles(files: string[]): void {
  for (const f of files) {
    try {
      fs.unlinkSync(f);
    } catch {
      try {
        fs.rmdirSync(f);
      } catch {
        // ENOENT, EBUSY, ENOTEMPTY
      }
    }
  }
}

function cleanupSession(session: PtySession): void {
  for (const t of session.timeouts) {
    clearTimeout(t);
  }
  session.timeouts.length = 0;
  cleanupTempFiles(session.tempFiles);
  session.tempFiles.length = 0;
}

const STATE_UPDATE_MIN_INTERVAL = 200;

function updateSessionState(
  sessionId: string,
  partial: Partial<SessionState>,
): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  Object.assign(session.state, partial);
  session.state.lastUpdated = Date.now();

  const now = Date.now();
  if (now - session.lastStateUpdate < STATE_UPDATE_MIN_INTERVAL) return;
  session.lastStateUpdate = now;

  const win = BrowserWindow.getAllWindows().find((w) => w.id === session.windowId);
  if (win && !win.isDestroyed()) {
    win.webContents.send("pty:state-updated", session.state);
  }
}

export function setupPtyHandlers(): void {
  ipcMain.handle(
    "pty:create",
    (event, options?: { cwd?: string; command?: string; remoteCwd?: string }) => {
      const sessionId = `pty-${++nextId}`;
      const { shell, args: baseArgs } = getShell();
      let args = [...baseArgs];
      const webContents = event.sender;
      const win = BrowserWindow.fromWebContents(webContents);

      const shellBase = path.basename(shell);
      const envExtra: Record<string, string> = {
        VAPOR_SHELL_INTEGRATION: "1",
        COLORTERM: "truecolor",
      };
      const tempFiles: string[] = [];

      if (shellBase === "zsh" || shellBase === "-zsh") {
        const integrationDir = path.join(os.tmpdir(), `vapor-zsh-${process.pid}`);
        fs.mkdirSync(integrationDir, { recursive: true });
        const zshenvPath = path.join(integrationDir, ".zshenv");
        const realZdotdir = process.env.ZDOTDIR || os.homedir();
        fs.writeFileSync(
          zshenvPath,
          `ZDOTDIR="${realZdotdir}"\n` +
          `[[ -f "$ZDOTDIR/.zshenv" ]] && source "$ZDOTDIR/.zshenv"\n` +
          `__vapor_precmd() {\n` +
          `  local e=$?\n` +
          `  print -Pn "\\e]133;D;\${e}\\a"\n` +
          `  printf '\\e]633;P;Cwd=%s\\a' "$PWD"\n` +
          `  printf '\\e]7;file://%s%s\\a' "\${HOST}" "\${PWD}"\n` +
          `  print -Pn "\\e]133;A\\a"\n` +
          `  return $e\n` +
          `}\n` +
          `__vapor_preexec() {\n` +
          `  print -Pn "\\e]133;C\\a"\n` +
          `  printf '\\e]633;E;%s\\a' "\${1//;/\\\\x3b}"\n` +
          `}\n` +
          `precmd_functions+=(__vapor_precmd)\n` +
          `preexec_functions+=(__vapor_preexec)\n`,
        );
        tempFiles.push(zshenvPath, integrationDir);
        envExtra.ZDOTDIR = integrationDir;
      } else if (shellBase === "bash" || shellBase === "-bash") {
        const integrationFile = path.join(os.tmpdir(), `vapor-bash-${process.pid}-${nextId}.sh`);
        fs.writeFileSync(
          integrationFile,
          `[[ -f ~/.bashrc ]] && source ~/.bashrc\n` +
          `__vapor_prompt() {\n` +
          `  local e=$?\n` +
          `  printf "\\e]133;D;%d\\a" "$e"\n` +
          `  printf '\\e]633;P;Cwd=%s\\a' "$PWD"\n` +
          `  printf '\\e]7;file://%s%s\\a' "$(hostname -s 2>/dev/null || hostname)" "$PWD"\n` +
          `  printf '\\e]133;A\\a'\n` +
          `  return $e\n` +
          `}\n` +
          `__vapor_preexec() {\n` +
          `  if [[ -z "$__vapor_in_cmd" ]]; then\n` +
          `    __vapor_in_cmd=1\n` +
          `    printf '\\e]133;C\\a'\n` +
          `    printf '\\e]633;E;%s\\a' "\${BASH_COMMAND//;/\\\\x3b}"\n` +
          `  fi\n` +
          `}\n` +
          `PROMPT_COMMAND="__vapor_prompt;__vapor_in_cmd='';$\{PROMPT_COMMAND}"\n` +
          `trap '__vapor_preexec' DEBUG\n`,
        );
        tempFiles.push(integrationFile);
        envExtra.BASH_ENV = integrationFile;
        args = ["--rcfile", integrationFile, ...args];
      } else if (shellBase === "fish") {
        const integrationFile = path.join(os.tmpdir(), `vapor-fish-${process.pid}-${nextId}.fish`);
        fs.writeFileSync(
          integrationFile,
          `function __vapor_prompt --on-event fish_prompt\n` +
          `  set -l e $status\n` +
          `  printf '\\e]133;D;%d\\a' $e\n` +
          `  printf '\\e]633;P;Cwd=%s\\a' $PWD\n` +
          `  printf '\\e]7;file://%s%s\\a' (hostname -s 2>/dev/null; or hostname) $PWD\n` +
          `  printf '\\e]133;A\\a'\n` +
          `end\n` +
          `function __vapor_preexec --on-event fish_preexec\n` +
          `  printf '\\e]133;C\\a'\n` +
          `  printf '\\e]633;E;%s\\a' (string replace -a ';' '\\\\x3b' -- $argv)\n` +
          `end\n`,
        );
        tempFiles.push(integrationFile);
        args = ["--init-command", `source ${integrationFile}`, ...args];
      } else if (shellBase === "sh" || shellBase === "ash" || shellBase === "dash") {
        envExtra.PS1 = '$(printf "\\033]7;file://%s%s\\033\\\\" "$(hostname -s 2>/dev/null || hostname)" "$(pwd)")\\$ ';
      }

      let ptyProcess: pty.IPty;
      try {
        ptyProcess = pty.spawn(shell, args, {
          name: "xterm-256color",
          cols: 80,
          rows: 24,
          cwd: options?.cwd || os.homedir(),
          env: {
            ...process.env as Record<string, string>,
            ...envExtra,
          },
        });
      } catch (err) {
        cleanupTempFiles(tempFiles);
        throw new Error(`Failed to spawn "${shell}": ${err instanceof Error ? err.message : String(err)}`);
      }

      const session: PtySession = {
        process: ptyProcess,
        windowId: win?.id ?? -1,
        lastOsc7: null,
        recentOutput: "",
        timeouts: [],
        tempFiles,
        state: {
          sessionId,
          localCwd: options?.cwd || os.homedir(),
          target: null,
          integrationLevel: "passive",
          childProcess: "",
          childCommand: "",
          containerName: "",
          lastUpdated: Date.now(),
        },
        lastStateUpdate: 0,
      };
      sessions.set(sessionId, session);

      if (options?.command) {
        const waitAndReplay = async () => {
          await waitForPrompt(ptyProcess, 5000);
          ptyProcess.write(options.command + "\n");

          if (options.remoteCwd) {
            await waitForPrompt(ptyProcess, 10000);
            const cwd = options.remoteCwd;
            const cdArg = cwd.startsWith("~")
              ? "~" + shellQuote(cwd.slice(1))
              : shellQuote(cwd);
            ptyProcess.write(`cd ${cdArg}\n`);
          }
        };
        waitAndReplay().catch((err) => console.warn("Command replay failed:", err));
      }

    ptyProcess.onData((data: string) => {
      const osc7 = parseOsc7(data);
      if (osc7) {
        session.lastOsc7 = osc7;
        const localHostname = os.hostname();
        const isRemote = osc7.hostname !== ""
          && osc7.hostname !== localHostname
          && !localHostname.startsWith(osc7.hostname + ".");
        if (isRemote) {
          updateSessionState(sessionId, {
            target: { type: "ssh", host: osc7.hostname, cwd: osc7.cwd },
          });
        } else {
          updateSessionState(sessionId, { localCwd: osc7.cwd });
        }
      }

      const titleInfo = parseOsc2Title(data);
      if (titleInfo && session.state.target && session.state.target.type !== "local") {
        const sshTarget = session.state.target.host;
        updateSessionState(sessionId, {
          target: { type: session.state.target.type, host: sshTarget, cwd: titleInfo.cwd, user: titleInfo.user },
        });
      }

      const cwdProp = parseOsc633Property(data);
      if (cwdProp && cwdProp.key === "Cwd") {
        updateSessionState(sessionId, { localCwd: cwdProp.value });
      }
      const cmdText = parseOsc633Command(data);
      if (cmdText) {
        updateSessionState(sessionId, { childCommand: cmdText });
      }

      if (session.state.integrationLevel !== "full") {
        if (cwdProp || cmdText || hasPromptStart(data) || hasPromptEnd(data) || parseOsc133D(data) !== null || hasCommandStart(data)) {
          updateSessionState(sessionId, { integrationLevel: "full" });
        }
      }

      session.recentOutput = (session.recentOutput + data).slice(-2000);

      if (!webContents.isDestroyed()) {
        webContents.send("pty:output", { sessionId, data });

        if (hasCommandStart(data)) {
          webContents.send("pty:command-status", { sessionId, exitCode: null });
        }
        const exitCode = parseOsc133D(data);
        if (exitCode !== null) {
          webContents.send("pty:command-status", { sessionId, exitCode });
        }
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (!webContents.isDestroyed()) {
        webContents.send("pty:exit", { sessionId, exitCode });
      }
      const s = sessions.get(sessionId);
      if (s) cleanupSession(s);
      sessions.delete(sessionId);
    });

    return { sessionId };
  });

  ipcMain.on("pty:input", (_event, { sessionId, data }: { sessionId: string; data: string }) => {
    const session = sessions.get(sessionId);
    if (!session) {
      console.error(`[pty:input] Session not found: ${sessionId}`);
      return;
    }
    try {
      session.process.write(data);
    } catch (error) {
      console.error(`[pty:input] Failed to write to session ${sessionId}:`, error);
    }
  });

  ipcMain.on("pty:resize", (_event, { sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
    const session = sessions.get(sessionId);
    if (!session) {
      console.error(`[pty:resize] Session not found: ${sessionId}`);
      return;
    }
    try {
      session.process.resize(cols, rows);
    } catch (error) {
      console.error(`[pty:resize] Failed to resize session ${sessionId} to ${cols}x${rows}:`, error);
    }
  });

  ipcMain.handle("pty:kill", (_event, { sessionId }: { sessionId: string }) => {
    const session = sessions.get(sessionId);
    if (!session) {
      console.warn(`[pty:kill] Session not found: ${sessionId}`);
      return;
    }
    try {
      cleanupSession(session);
      session.process.kill();
      sessions.delete(sessionId);
    } catch (error) {
      console.error(`[pty:kill] Failed to kill session ${sessionId}:`, error);
      // Still try to clean up
      sessions.delete(sessionId);
    }
  });

  ipcMain.handle(
    "pty:get-state",
    (_event, { sessionId }: { sessionId: string }) => {
      const session = sessions.get(sessionId);
      if (!session) return null;
      return session.state;
    },
  );

  ipcMain.handle(
    "pty:get-info",
    async (_event, { sessionId }: { sessionId: string }) => {
      const session = sessions.get(sessionId);
      if (!session) {
        console.warn(`[pty:get-info] Session not found: ${sessionId}`);
        return null;
      }
      const pid = session.process.pid;
      const processName = session.process.process;
      const cwd = getCwdSync(pid);
      const command = getChildCommandSync(pid);

      const isRemoteShell = !SHELL_NAMES.has(processName) && command !== "";

      let remoteCwd = "";
      let remoteHost = "";

      if (isRemoteShell) {
        const target = session.state.target;
        if (target && target.type !== "local") {
          remoteCwd = target.cwd;
          remoteHost = target.host;
        }
      }

      updateSessionState(sessionId, {
        localCwd: cwd,
        childProcess: processName,
        childCommand: command,
        ...(remoteCwd ? { target: { type: "ssh", host: remoteHost, cwd: remoteCwd } } : {}),
      });

      return { cwd, processName, command, remoteCwd, remoteHost };
    },
  );

  ipcMain.handle(
    "pty:get-context",
    async (_event, { sessionId }: { sessionId: string }) => {
      const session = sessions.get(sessionId);
      if (!session) {
        console.warn(`[pty:get-context] Session not found: ${sessionId}`);
        return null;
      }
      const pid = session.process.pid;
      const processName = session.process.process;
      const [cwd, command] = await Promise.all([getCwd(pid), getChildCommand(pid)]);
      const localHostname = os.hostname();

      const isRemoteShell = !SHELL_NAMES.has(processName) && command !== "";

      let remoteCwd = "";
      let remoteHost = "";

      if (isRemoteShell && processName === "ssh") {
        const osc7 = session.lastOsc7;
        const isRemote = osc7 != null
          && osc7.hostname !== ""
          && osc7.hostname !== localHostname
          && !localHostname.startsWith(osc7.hostname + ".");

        if (isRemote) {
          remoteCwd = osc7!.cwd;
          remoteHost = osc7!.hostname;
        } else {
          const parsed = parseRemotePrompt(session.recentOutput, command);
          if (parsed) {
            remoteCwd = parsed.cwd || "~";
            remoteHost = parsed.host;
          }
        }
      }

      const containerName = parseContainerName(command);

      updateSessionState(sessionId, {
        localCwd: cwd,
        childProcess: processName,
        childCommand: command,
        containerName,
        ...(remoteCwd
          ? { target: { type: "ssh", host: remoteHost, cwd: remoteCwd } }
          : containerName
            ? { target: { type: "docker", host: containerName, cwd: "" } }
            : {}),
      });

      return {
        cwd,
        processName,
        command,
        remoteCwd,
        remoteHost,
        containerName,
      };
    },
  );
}

export function killAllSessions(): void {
  for (const [id, session] of sessions) {
    cleanupSession(session);
    session.process.kill();
    sessions.delete(id);
  }
}
