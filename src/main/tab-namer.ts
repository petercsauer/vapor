import { ipcMain } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);

const gitCache = new Map<string, { result: string | null; timestamp: number }>();
const GIT_CACHE_TTL = 5000;

async function getGitRepoName(cwd: string): Promise<string | null> {
  const cached = gitCache.get(cwd);
  if (cached && Date.now() - cached.timestamp < GIT_CACHE_TTL) return cached.result;
  try {
    const { stdout } = await execFileAsync(
      "git", ["rev-parse", "--show-toplevel"],
      { cwd, encoding: "utf8", timeout: 1000 },
    );
    const result = path.basename(stdout.trim());
    gitCache.set(cwd, { result, timestamp: Date.now() });
    return result;
  } catch {
    gitCache.set(cwd, { result: null, timestamp: Date.now() });
    return null;
  }
}

export function shortenPath(p: string): string {
  const home = os.homedir();
  let rel = p;
  if (p.startsWith(home + "/")) rel = "~/" + p.slice(home.length + 1);
  else if (p === home) rel = "~";
  else if (p.startsWith("/home/")) {
    const rest = p.replace(/^\/home\/[^/]+/, "~");
    rel = rest;
  }
  const parts = rel.split("/");
  if (parts.length <= 2) return rel;
  return parts.slice(-2).join("/");
}

export async function generateTabName(context: {
  cwd: string;
  processName: string;
  command: string;
  remoteCwd?: string;
  remoteHost?: string;
}): Promise<string> {
  if (context.remoteCwd) {
    return shortenPath(context.remoteCwd);
  }

  const repo = await getGitRepoName(context.cwd);
  if (repo) return repo;

  return shortenPath(context.cwd);
}

export function setupTabNamer(): void {
  ipcMain.handle(
    "tab-namer:suggest",
    async (
      _event,
      context: { cwd: string; processName: string; command: string },
    ) => {
      return generateTabName(context);
    },
  );

  ipcMain.handle("tab-namer:available", () => true);
}
