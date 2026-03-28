import { app, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { execFile } from "child_process";
import type { RecentHost } from "../shared/types";

const MAX_RECENT_HOSTS = 20;

let sshConfigHostsCache: string[] | null = null;

export function listSSHConfigHosts(): string[] {
  if (sshConfigHostsCache) return sshConfigHostsCache;
  const hosts = new Set<string>();
  try {
    const configPath = path.join(os.homedir(), ".ssh", "config");
    const content = fs.readFileSync(configPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*Host\s+(.+)/i);
      if (m) {
        for (const h of m[1].split(/\s+/)) {
          if (!h.includes("*") && !h.includes("?")) hosts.add(h);
        }
      }
    }
  } catch {
    // No SSH config or unreadable
  }
  sshConfigHostsCache = Array.from(hosts).sort();
  return sshConfigHostsCache;
}

export function listDockerContainers(): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(
      "docker",
      ["ps", "--format", "{{.Names}}"],
      { timeout: 5000 },
      (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        const names = stdout
          .trim()
          .split("\n")
          .filter((n) => n.length > 0);
        resolve(names);
      },
    );
  });
}

function getRecentHostsPath(): string {
  return path.join(app.getPath("userData"), "recent-hosts.json");
}

export function loadRecentHosts(): RecentHost[] {
  try {
    const raw = fs.readFileSync(getRecentHostsPath(), "utf-8");
    const hosts = JSON.parse(raw) as RecentHost[];
    return hosts.sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime(),
    );
  } catch {
    return [];
  }
}

export function addRecentHost(entry: { type: "ssh" | "docker"; host: string }): void {
  const hosts = loadRecentHosts();
  const key = `${entry.type}:${entry.host}`;
  const existingIdx = hosts.findIndex(
    (h) => `${h.type}:${h.host}` === key,
  );

  const now = new Date().toISOString();

  if (existingIdx >= 0) {
    hosts[existingIdx].lastUsed = now;
  } else {
    hosts.push({ type: entry.type, host: entry.host, lastUsed: now });
  }

  hosts.sort(
    (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime(),
  );

  const trimmed = hosts.slice(0, MAX_RECENT_HOSTS);

  const dir = path.dirname(getRecentHostsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getRecentHostsPath(), JSON.stringify(trimmed, null, 2), "utf-8");
}

export function removeRecentHost(entry: { type: "ssh" | "docker"; host: string }): void {
  const hosts = loadRecentHosts();
  const key = `${entry.type}:${entry.host}`;
  const filtered = hosts.filter((h) => `${h.type}:${h.host}` !== key);

  const dir = path.dirname(getRecentHostsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getRecentHostsPath(), JSON.stringify(filtered, null, 2), "utf-8");
}

export function setupHostHandlers(): void {
  ipcMain.handle("hosts:list-ssh-config", () => {
    return listSSHConfigHosts();
  });

  ipcMain.handle("hosts:list-docker-containers", async () => {
    return listDockerContainers();
  });

  ipcMain.handle("hosts:get-recent", () => {
    return loadRecentHosts();
  });

  ipcMain.handle(
    "hosts:add-recent",
    (_event, entry: { type: "ssh" | "docker"; host: string }) => {
      addRecentHost(entry);
    },
  );

  ipcMain.handle(
    "hosts:remove-recent",
    (_event, entry: { type: "ssh" | "docker"; host: string }) => {
      removeRecentHost(entry);
    },
  );
}

export function resetSSHConfigCache(): void {
  sshConfigHostsCache = null;
}
