import { ipcMain } from "electron";
import { getConnectionPool } from "./ssh-connection-pool";
import type { FsEntry, FsStat } from "../shared/types";
import * as path from "path";
import {
  shellReaddir,
  shellReadFile,
  shellWriteFile,
  shellStat,
  shellMkdir,
  shellRename,
  shellDelete,
} from "./ssh-shell-executor";

interface ConnectionCapabilities {
  hasSFTP: boolean;
  checkedAt: number;
}

const capabilitiesCache = new Map<string, ConnectionCapabilities>();
const CAPABILITIES_TTL = 300000;
const SFTP_TIMEOUT = 30000;

function isSFTPSubsystemError(err: any): boolean {
  return err.message?.includes("subsystem") || err.message?.includes("sftp");
}

function markSFTPUnavailable(host: string): void {
  capabilitiesCache.set(host, { hasSFTP: false, checkedAt: Date.now() });
}

async function checkRemoteCapabilities(host: string): Promise<ConnectionCapabilities> {
  const cached = capabilitiesCache.get(host);
  if (cached && Date.now() - cached.checkedAt < CAPABILITIES_TTL) {
    return cached;
  }

  let hasSFTP = false;
  try {
    const pool = getConnectionPool();
    await pool.getConnection(host);
    hasSFTP = true;
  } catch (err: any) {
    if (!isSFTPSubsystemError(err)) throw err;
  }

  const capabilities = { hasSFTP, checkedAt: Date.now() };
  capabilitiesCache.set(host, capabilities);
  return capabilities;
}

/**
 * Try an SFTP operation; on subsystem failure, mark host as no-SFTP and
 * fall back to the shell equivalent. Non-subsystem errors propagate.
 */
async function withSFTPFallback<T>(
  host: string,
  sftpOp: (sftp: any) => Promise<T>,
  shellFallback: () => Promise<T>,
): Promise<T> {
  const capabilities = await checkRemoteCapabilities(host);
  if (capabilities.hasSFTP) {
    try {
      const pool = getConnectionPool();
      const sftp = await pool.getConnection(host);
      return await sftpOp(sftp);
    } catch (err: any) {
      if (!isSFTPSubsystemError(err)) throw err;
      markSFTPUnavailable(host);
    }
  }
  return shellFallback();
}

const SFTP_STATUS_CODE = {
  OK: 0,
  EOF: 1,
  NO_SUCH_FILE: 2,
  PERMISSION_DENIED: 3,
  FAILURE: 4,
  BAD_MESSAGE: 5,
  NO_CONNECTION: 6,
  CONNECTION_LOST: 7,
  OP_UNSUPPORTED: 8,
};

interface SFTPError extends Error {
  code?: number;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

function mapSFTPError(err: SFTPError, operation: string, filePath: string): Error {
  const sftpCode = err.code;

  if (sftpCode === SFTP_STATUS_CODE.NO_SUCH_FILE) {
    const error = new Error(`ENOENT: no such file or directory, ${operation} '${filePath}'`) as NodeJS.ErrnoException;
    error.code = "ENOENT";
    error.errno = -2;
    error.path = filePath;
    error.syscall = operation;
    return error;
  }

  if (sftpCode === SFTP_STATUS_CODE.PERMISSION_DENIED) {
    const error = new Error(`EACCES: permission denied, ${operation} '${filePath}'`) as NodeJS.ErrnoException;
    error.code = "EACCES";
    error.errno = -13;
    error.path = filePath;
    error.syscall = operation;
    return error;
  }

  const error = new Error(`${operation} failed: ${err.message}`) as NodeJS.ErrnoException;
  error.code = "EFAULT";
  error.path = filePath;
  error.syscall = operation;
  return error;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function expandTilde(sftp: any, p: string): Promise<string> {
  if (!p.startsWith("~")) return Promise.resolve(p);
  return new Promise<string>((resolve) => {
    sftp.realpath(".", (err: Error | undefined, absPath: string) => {
      resolve(err ? p.replace("~", "/root") : p.replace("~", absPath));
    });
  });
}

const S_IFDIR = 0o040000;
const S_IFREG = 0o100000;

export function setupRemoteFsHandlers(): void {
  ipcMain.handle(
    "fs:remote:readdir",
    async (_event, host: string, dirPath: string): Promise<FsEntry[]> =>
      withSFTPFallback(
        host,
        async (sftp) => {
          let normalized = normalizePath(dirPath);
          normalized = await expandTilde(sftp, normalized);

          return withTimeout(
            new Promise<FsEntry[]>((resolve, reject) => {
              sftp.readdir(normalized, (err: any, list: any[]) => {
                if (err) return reject(mapSFTPError(err, "readdir", normalized));

                const entries: FsEntry[] = list
                  .filter((item: any) => {
                    if (item.filename === "." || item.filename === "..") return false;
                    return (item.attrs.mode! & S_IFDIR) !== 0 || (item.attrs.mode! & S_IFREG) !== 0;
                  })
                  .map((item: any) => {
                    const isDir = (item.attrs.mode! & S_IFDIR) !== 0;
                    return {
                      name: item.filename,
                      type: isDir ? ("directory" as const) : ("file" as const),
                      path: path.posix.join(normalized, item.filename),
                    };
                  })
                  .sort((a, b) => {
                    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
                    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
                  });

                resolve(entries);
              });
            }),
            SFTP_TIMEOUT,
            "readdir",
          );
        },
        () => shellReaddir(host, dirPath),
      ),
  );

  ipcMain.handle(
    "fs:remote:read-file",
    async (_event, host: string, filePath: string): Promise<string> =>
      withSFTPFallback(
        host,
        (sftp) => {
          const normalized = normalizePath(filePath);
          return withTimeout(
            new Promise<string>((resolve, reject) => {
              sftp.readFile(normalized, "utf8", (err: any, data: any) => {
                if (err) return reject(mapSFTPError(err, "readFile", normalized));
                resolve(data.toString());
              });
            }),
            SFTP_TIMEOUT,
            "read-file",
          );
        },
        () => shellReadFile(host, filePath),
      ),
  );

  ipcMain.handle(
    "fs:remote:write-file",
    async (_event, host: string, filePath: string, content: string): Promise<void> =>
      withSFTPFallback(
        host,
        (sftp) => {
          const normalized = normalizePath(filePath);
          const tmpPath = `${normalized}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;

          return withTimeout(
            new Promise<void>((resolve, reject) => {
              sftp.writeFile(tmpPath, content, "utf8", (writeErr: any) => {
                if (writeErr) return reject(mapSFTPError(writeErr, "writeFile", normalized));

                sftp.rename(tmpPath, normalized, (renameErr: any) => {
                  if (renameErr) {
                    sftp.unlink(tmpPath, (_err: Error | undefined) => { return; });
                    return reject(mapSFTPError(renameErr, "rename", normalized));
                  }
                  resolve();
                });
              });
            }),
            SFTP_TIMEOUT,
            "write-file",
          );
        },
        () => shellWriteFile(host, filePath, content),
      ),
  );

  ipcMain.handle(
    "fs:remote:stat",
    async (_event, host: string, filePath: string): Promise<FsStat> =>
      withSFTPFallback(
        host,
        (sftp) => {
          const normalized = normalizePath(filePath);
          return withTimeout(
            new Promise<FsStat>((resolve, reject) => {
              sftp.stat(normalized, (err: any, stats: any) => {
                if (err) return reject(mapSFTPError(err, "stat", normalized));
                resolve({
                  size: stats.size!,
                  modified: stats.mtime! * 1000,
                  isDirectory: (stats.mode! & S_IFDIR) !== 0,
                  isFile: (stats.mode! & S_IFREG) !== 0,
                });
              });
            }),
            SFTP_TIMEOUT,
            "stat",
          );
        },
        () => shellStat(host, filePath),
      ),
  );

  ipcMain.handle(
    "fs:remote:rename",
    async (_event, host: string, oldPath: string, newPath: string): Promise<void> =>
      withSFTPFallback(
        host,
        (sftp) => {
          const normalizedOld = normalizePath(oldPath);
          const normalizedNew = normalizePath(newPath);
          return withTimeout(
            new Promise<void>((resolve, reject) => {
              sftp.rename(normalizedOld, normalizedNew, (err: any) => {
                if (err) return reject(mapSFTPError(err, "rename", normalizedOld));
                resolve();
              });
            }),
            SFTP_TIMEOUT,
            "rename",
          );
        },
        () => shellRename(host, oldPath, newPath),
      ),
  );

  ipcMain.handle(
    "fs:remote:delete",
    async (_event, host: string, filePath: string): Promise<void> =>
      withSFTPFallback(
        host,
        (sftp) => {
          const normalized = normalizePath(filePath);
          return withTimeout(
            new Promise<void>((resolve, reject) => {
              sftp.stat(normalized, (statErr: any, stats: any) => {
                if (statErr) return reject(mapSFTPError(statErr, "stat", normalized));

                const remove = (stats.mode! & S_IFDIR) !== 0
                  ? (cb: any) => sftp.rmdir(normalized, cb)
                  : (cb: any) => sftp.unlink(normalized, cb);

                remove((err: any) => {
                  if (err) return reject(mapSFTPError(err, (stats.mode! & S_IFDIR) !== 0 ? "rmdir" : "unlink", normalized));
                  resolve();
                });
              });
            }),
            SFTP_TIMEOUT,
            "delete",
          );
        },
        () => shellDelete(host, filePath),
      ),
  );

  ipcMain.handle(
    "fs:remote:mkdir",
    async (_event, host: string, dirPath: string): Promise<void> =>
      withSFTPFallback(
        host,
        (sftp) => {
          const normalized = normalizePath(dirPath);
          const createDir = async (currentPath: string): Promise<void> => {
            return new Promise<void>((resolveDir, rejectDir) => {
              sftp.stat(currentPath, (statErr: any, stats: any) => {
                if (!statErr && stats && (stats.mode! & S_IFDIR) !== 0) return resolveDir();

                sftp.mkdir(currentPath, (mkdirErr: any) => {
                  if (!mkdirErr) return resolveDir();

                  const sftpErr = mkdirErr as SFTPError;
                  if (sftpErr.code !== SFTP_STATUS_CODE.NO_SUCH_FILE) {
                    return rejectDir(mapSFTPError(mkdirErr, "mkdir", currentPath));
                  }

                  const parentPath = path.posix.dirname(currentPath);
                  if (parentPath === currentPath || parentPath === "/") {
                    return rejectDir(mapSFTPError(mkdirErr, "mkdir", currentPath));
                  }

                  createDir(parentPath)
                    .then(() => {
                      sftp.mkdir(currentPath, (retryErr: any) => {
                        if (retryErr) return rejectDir(mapSFTPError(retryErr, "mkdir", currentPath));
                        resolveDir();
                      });
                    })
                    .catch(rejectDir);
                });
              });
            });
          };

          return withTimeout(
            createDir(normalized),
            SFTP_TIMEOUT,
            "mkdir",
          );
        },
        () => shellMkdir(host, dirPath),
      ),
  );
}
