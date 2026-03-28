import { execFile } from "child_process";
import type { FsEntry, FsStat } from "../shared/types";
import {
  shellEscape,
  shellReaddir,
  shellReadFile,
  shellWriteFile,
  shellStat,
  shellMkdir,
  shellRename,
  shellDelete,
  expandTildeShell,
} from "./ssh-shell-executor";

export interface RemoteContext {
  readonly type: "ssh" | "docker";
  readonly host: string;
  readdir(dirPath: string): Promise<FsEntry[]>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  stat(filePath: string): Promise<FsStat>;
  mkdir(dirPath: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  delete(targetPath: string): Promise<void>;
  expandTilde(filePath: string): Promise<string>;
  getCwd(): Promise<string>;
}

export class SSHRemoteContext implements RemoteContext {
  readonly type = "ssh" as const;
  constructor(readonly host: string) {}

  async readdir(dirPath: string): Promise<FsEntry[]> {
    return shellReaddir(this.host, dirPath);
  }

  async readFile(filePath: string): Promise<string> {
    return shellReadFile(this.host, filePath);
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    return shellWriteFile(this.host, filePath, content);
  }

  async stat(filePath: string): Promise<FsStat> {
    return shellStat(this.host, filePath);
  }

  async mkdir(dirPath: string): Promise<void> {
    return shellMkdir(this.host, dirPath);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    return shellRename(this.host, oldPath, newPath);
  }

  async delete(targetPath: string): Promise<void> {
    return shellDelete(this.host, targetPath);
  }

  async expandTilde(filePath: string): Promise<string> {
    return expandTildeShell(this.host, filePath);
  }

  async getCwd(): Promise<string> {
    const expanded = await expandTildeShell(this.host, "~");
    return expanded;
  }
}

export interface DockerExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function executeDockerCommand(
  containerName: string,
  command: string,
  options: { timeout?: number; stdin?: string } = {},
): Promise<DockerExecResult> {
  return new Promise((resolve) => {
    const args = ["exec"];
    if (options.stdin) args.push("-i");
    args.push(containerName, "sh", "-c", command);

    execFile(
      "docker",
      args,
      {
        encoding: "utf8",
        timeout: options.timeout || 10000,
        maxBuffer: 10 * 1024 * 1024,
        ...(options.stdin ? { input: options.stdin } : {}),
      },
      (err, stdout, stderr) => {
        if (err) {
          resolve({
            stdout: (err as any).stdout || "",
            stderr: (err as any).stderr || err.message || "Unknown error",
            exitCode: (err as any).code || 1,
          });
          return;
        }
        resolve({ stdout, stderr, exitCode: 0 });
      },
    );
  });
}

export class DockerRemoteContext implements RemoteContext {
  readonly type = "docker" as const;
  private _homeDir: string | null = null;

  constructor(readonly host: string) {}

  async readdir(dirPath: string): Promise<FsEntry[]> {
    const expanded = await this.expandTilde(dirPath);
    const cmd = `cd ${shellEscape(expanded)} && ls -1Ap --color=never 2>/dev/null || ls -1Ap`;
    const result = await executeDockerCommand(this.host, cmd);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to read directory: ${result.stderr}`);
    }

    const lines = result.stdout.trim().split("\n").filter((l) => l);
    return lines
      .map((line) => {
        const isDir = line.endsWith("/");
        const name = isDir ? line.slice(0, -1) : line;
        return {
          name,
          type: isDir ? ("directory" as const) : ("file" as const),
          path: `${expanded}/${name}`,
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }

  async readFile(filePath: string): Promise<string> {
    const expanded = await this.expandTilde(filePath);
    const cmd = `cat ${shellEscape(expanded)} | base64`;
    const result = await executeDockerCommand(this.host, cmd);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to read file: ${result.stderr}`);
    }

    return Buffer.from(result.stdout.trim(), "base64").toString("utf-8");
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const expanded = await this.expandTilde(filePath);
    const base64Content = Buffer.from(content, "utf-8").toString("base64");
    const tmpPath = `${expanded}.tmp.${Date.now()}`;

    const cmd = `echo ${shellEscape(base64Content)} | base64 -d > ${shellEscape(tmpPath)} && mv ${shellEscape(tmpPath)} ${shellEscape(expanded)}`;
    const result = await executeDockerCommand(this.host, cmd);

    if (result.exitCode !== 0) {
      await executeDockerCommand(this.host, `rm -f ${shellEscape(tmpPath)}`);
      throw new Error(`Failed to write file: ${result.stderr}`);
    }
  }

  async stat(filePath: string): Promise<FsStat> {
    const expanded = await this.expandTilde(filePath);
    const cmd = `stat -c "%s %Y %F" ${shellEscape(expanded)} 2>/dev/null || stat -f "%z %m %HT" ${shellEscape(expanded)}`;
    const result = await executeDockerCommand(this.host, cmd);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to stat: ${result.stderr}`);
    }

    const parts = result.stdout.trim().split(" ");
    const size = parseInt(parts[0], 10);
    const modified = parseInt(parts[1], 10) * 1000;
    const typeStr = parts.slice(2).join(" ");

    return {
      size,
      modified,
      isDirectory: typeStr.includes("directory"),
      isFile: !typeStr.includes("directory"),
    };
  }

  async mkdir(dirPath: string): Promise<void> {
    const expanded = await this.expandTilde(dirPath);
    const result = await executeDockerCommand(
      this.host,
      `mkdir -p ${shellEscape(expanded)}`,
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to create directory: ${result.stderr}`);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const [expandedOld, expandedNew] = await Promise.all([
      this.expandTilde(oldPath),
      this.expandTilde(newPath),
    ]);
    const result = await executeDockerCommand(
      this.host,
      `mv ${shellEscape(expandedOld)} ${shellEscape(expandedNew)}`,
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to rename: ${result.stderr}`);
    }
  }

  async delete(targetPath: string): Promise<void> {
    const expanded = await this.expandTilde(targetPath);
    const result = await executeDockerCommand(
      this.host,
      `rm -rf ${shellEscape(expanded)}`,
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to delete: ${result.stderr}`);
    }
  }

  async expandTilde(filePath: string): Promise<string> {
    if (!filePath.startsWith("~")) return filePath;

    if (!this._homeDir) {
      const result = await executeDockerCommand(this.host, "echo $HOME");
      this._homeDir =
        result.exitCode === 0 && result.stdout.trim()
          ? result.stdout.trim()
          : "/root";
    }

    return filePath.replace("~", this._homeDir);
  }

  async getCwd(): Promise<string> {
    const result = await executeDockerCommand(this.host, "pwd");
    return result.exitCode === 0 ? result.stdout.trim() : "/";
  }
}

export function createRemoteContext(target: {
  type: "ssh" | "docker";
  host: string;
}): RemoteContext {
  if (target.type === "ssh") return new SSHRemoteContext(target.host);
  if (target.type === "docker") return new DockerRemoteContext(target.host);
  throw new Error(`Unknown target type: ${(target as any).type}`);
}
