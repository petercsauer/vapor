import { ipcMain, dialog, shell, BrowserWindow, clipboard } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { watch, type FSWatcher, createReadStream, createWriteStream } from "fs";
import type { FsEntry } from "../shared/types";

let activeWatcher: FSWatcher | null = null;
let watchedRoot: string | null = null;

export function closeWatcher(): void {
  if (activeWatcher) {
    activeWatcher.close();
    activeWatcher = null;
    watchedRoot = null;
  }
}

export function setupFsHandlers(): void {
  ipcMain.handle("fs:open-folder", async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    "fs:readdir",
    async (_event, dirPath: string): Promise<FsEntry[]> => {
      const resolved = dirPath.startsWith("~")
        ? path.join(os.homedir(), dirPath.slice(1))
        : dirPath;
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() || e.isDirectory())
        .map((e) => ({
          name: e.name,
          type: e.isDirectory() ? ("directory" as const) : ("file" as const),
          path: path.join(dirPath, e.name),
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        });
    },
  );

  ipcMain.handle(
    "fs:read-file",
    async (_event, filePath: string): Promise<string> => {
      return fs.readFile(filePath, "utf-8");
    },
  );

  ipcMain.handle(
    "fs:write-file",
    async (_event, filePath: string, content: string): Promise<void> => {
      await fs.writeFile(filePath, content, "utf-8");
    },
  );

  ipcMain.handle(
    "fs:stat",
    async (_event, filePath: string) => {
      const stat = await fs.stat(filePath);
      return {
        size: stat.size,
        modified: stat.mtimeMs,
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
      };
    },
  );

  ipcMain.handle(
    "fs:rename",
    async (_event, oldPath: string, newPath: string): Promise<void> => {
      await fs.rename(oldPath, newPath);
    },
  );

  ipcMain.handle(
    "fs:delete",
    async (_event, filePath: string): Promise<void> => {
      await shell.trashItem(filePath);
    },
  );

  ipcMain.handle(
    "fs:mkdir",
    async (_event, dirPath: string): Promise<void> => {
      await fs.mkdir(dirPath, { recursive: true });
    },
  );

  ipcMain.handle(
    "fs:git-root",
    async (_event, dirPath: string): Promise<string | null> => {
      try {
        const { execFile } = await import("child_process");
        const { promisify } = await import("util");
        const execFileAsync = promisify(execFile);
        const { stdout } = await execFileAsync(
          "git",
          ["rev-parse", "--show-toplevel"],
          { cwd: dirPath, encoding: "utf8", timeout: 2000 },
        );
        return stdout.trim();
      } catch {
        return null;
      }
    },
  );

  ipcMain.handle(
    "fs:show-in-folder",
    async (_event, filePath: string): Promise<void> => {
      shell.showItemInFolder(filePath);
    },
  );

  ipcMain.handle(
    "fs:open-path",
    async (_event, filePath: string): Promise<string> => {
      return shell.openPath(filePath);
    },
  );

  ipcMain.handle(
    "fs:copy-to",
    async (_event, sourcePaths: string[], destDir: string): Promise<void> => {
      for (const src of sourcePaths) {
        const basename = path.basename(src);
        let dest = path.join(destDir, basename);

        // Avoid overwriting: append (n) if exists
        let counter = 1;
        const ext = path.extname(basename);
        const stem = basename.slice(0, basename.length - ext.length);
        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            await fs.access(dest);
            dest = path.join(destDir, `${stem} (${counter})${ext}`);
            counter++;
          } catch {
            break;
          }
        }

        const stat = await fs.stat(src);
        if (stat.isDirectory()) {
          await fs.cp(src, dest, { recursive: true });
        } else {
          await fs.copyFile(src, dest);
        }
      }
    },
  );

  ipcMain.handle(
    "fs:clipboard-copy-path",
    async (_event, filePath: string): Promise<void> => {
      clipboard.writeText(filePath);
    },
  );

  ipcMain.on("fs:watch", (event, rootPath: string) => {
    if (activeWatcher) {
      activeWatcher.close();
      activeWatcher = null;
    }

    if (!rootPath) {
      watchedRoot = null;
      return;
    }

    watchedRoot = rootPath;
    try {
      activeWatcher = watch(rootPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const fullPath = path.join(rootPath, filename);
        const parentDir = path.dirname(fullPath);
        try {
          event.sender.send("fs:changed", { eventType, path: fullPath, dir: parentDir });
        } catch {
          // sender destroyed
        }
      });
    } catch {
      // watch not supported or path invalid
    }
  });
}
