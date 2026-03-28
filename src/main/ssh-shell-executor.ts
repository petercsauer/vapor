import { execFile } from 'child_process';
import { promisify } from 'util';
import type { FsEntry, FsStat } from '../shared/types';

const execFileAsync = promisify(execFile);

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a shell command on a remote host via SSH.
 * Uses separate SSH connection from the interactive terminal.
 */
export async function executeRemoteShellCommand(
  host: string,
  command: string,
  options: { timeout?: number } = {}
): Promise<ShellResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      'ssh',
      [
        '-o', 'ConnectTimeout=5',
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=accept-new',
        host,
        command
      ],
      {
        encoding: 'utf8',
        timeout: options.timeout || 10000,
        maxBuffer: 10 * 1024 * 1024 // 10MB
      }
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || 'Unknown error',
      exitCode: err.code || 1
    };
  }
}

/**
 * Escape a string for safe use in shell commands.
 * Uses single quotes and escapes embedded single quotes.
 */
export function shellEscape(arg: string): string {
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

/**
 * Expand ~ to the actual home directory path on the remote host.
 * Caches the result per host to avoid repeated lookups.
 */
const homeDirectoryCache = new Map<string, string>();

export async function expandTildeShell(host: string, path: string): Promise<string> {
  if (!path.startsWith('~')) return path;

  // Check cache
  let homeDir = homeDirectoryCache.get(host);

  if (!homeDir) {
    // Get home directory
    const result = await executeRemoteShellCommand(host, 'echo $HOME');
    if (result.exitCode !== 0) {
      // Fallback to pwd in home
      const pwdResult = await executeRemoteShellCommand(host, 'cd && pwd');
      if (pwdResult.exitCode === 0) {
        homeDir = pwdResult.stdout.trim();
      } else {
        // Last resort: assume /root
        homeDir = '/root';
      }
    } else {
      homeDir = result.stdout.trim();
    }

    homeDirectoryCache.set(host, homeDir);
  }

  return path.replace('~', homeDir);
}

/**
 * List directory contents using shell commands.
 */
export async function shellReaddir(host: string, dirPath: string): Promise<FsEntry[]> {
  const expandedPath = await expandTildeShell(host, dirPath);
  // Use ls -1Ap: one per line, classify, all files
  const cmd = `cd ${shellEscape(expandedPath)} && ls -1Ap --color=never 2>/dev/null || ls -1Ap`;
  const result = await executeRemoteShellCommand(host, cmd);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to read directory: ${result.stderr}`);
  }

  const lines = result.stdout.trim().split('\n').filter(l => l);
  return lines.map(line => {
    const isDir = line.endsWith('/');
    const name = isDir ? line.slice(0, -1) : line;
    return {
      name,
      type: isDir ? 'directory' as const : 'file' as const,
      path: `${expandedPath}/${name}`
    };
  }).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/**
 * Read file contents using shell commands.
 * Uses base64 encoding for binary-safe transfer.
 */
export async function shellReadFile(host: string, filePath: string): Promise<string> {
  const expandedPath = await expandTildeShell(host, filePath);
  // Use base64 for binary-safe transfer
  const cmd = `cat ${shellEscape(expandedPath)} | base64`;
  const result = await executeRemoteShellCommand(host, cmd);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to read file: ${result.stderr}`);
  }

  return Buffer.from(result.stdout.trim(), 'base64').toString('utf-8');
}

/**
 * Write file contents using shell commands.
 * Uses atomic write-then-rename pattern.
 */
export async function shellWriteFile(host: string, filePath: string, content: string): Promise<void> {
  const expandedPath = await expandTildeShell(host, filePath);
  const base64Content = Buffer.from(content, 'utf-8').toString('base64');
  const tmpPath = `${expandedPath}.tmp.${Date.now()}`;

  // Write to temp file, then atomic rename
  const cmd = `echo ${shellEscape(base64Content)} | base64 -d > ${shellEscape(tmpPath)} && mv ${shellEscape(tmpPath)} ${shellEscape(expandedPath)}`;
  const result = await executeRemoteShellCommand(host, cmd);

  if (result.exitCode !== 0) {
    // Try to cleanup temp file
    await executeRemoteShellCommand(host, `rm -f ${shellEscape(tmpPath)}`);
    throw new Error(`Failed to write file: ${result.stderr}`);
  }
}

/**
 * Get file/directory stats using shell commands.
 */
export async function shellStat(host: string, filePath: string): Promise<FsStat> {
  const expandedPath = await expandTildeShell(host, filePath);
  // Try Linux stat format first, fallback to macOS
  const cmd = `stat -c "%s %Y %F" ${shellEscape(expandedPath)} 2>/dev/null || stat -f "%z %m %HT" ${shellEscape(expandedPath)}`;
  const result = await executeRemoteShellCommand(host, cmd);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to stat: ${result.stderr}`);
  }

  const parts = result.stdout.trim().split(' ');
  const size = parseInt(parts[0], 10);
  const modified = parseInt(parts[1], 10) * 1000;
  const typeStr = parts.slice(2).join(' ');

  return {
    size,
    modified,
    isDirectory: typeStr.includes('directory'),
    isFile: !typeStr.includes('directory')
  };
}

/**
 * Create directory recursively using shell commands.
 */
export async function shellMkdir(host: string, dirPath: string): Promise<void> {
  const expandedPath = await expandTildeShell(host, dirPath);
  const cmd = `mkdir -p ${shellEscape(expandedPath)}`;
  const result = await executeRemoteShellCommand(host, cmd);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to create directory: ${result.stderr}`);
  }
}

/**
 * Rename/move file or directory using shell commands.
 */
export async function shellRename(host: string, oldPath: string, newPath: string): Promise<void> {
  const expandedOld = await expandTildeShell(host, oldPath);
  const expandedNew = await expandTildeShell(host, newPath);
  const cmd = `mv ${shellEscape(expandedOld)} ${shellEscape(expandedNew)}`;
  const result = await executeRemoteShellCommand(host, cmd);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to rename: ${result.stderr}`);
  }
}

/**
 * Delete file or directory using shell commands.
 */
export async function shellDelete(host: string, filePath: string): Promise<void> {
  const expandedPath = await expandTildeShell(host, filePath);
  // Try trash command first (if available), fallback to rm
  const cmd = `trash ${shellEscape(expandedPath)} 2>/dev/null || rm -rf ${shellEscape(expandedPath)}`;
  const result = await executeRemoteShellCommand(host, cmd);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to delete: ${result.stderr}`);
  }
}
