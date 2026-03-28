import { app, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import type { SavedPaneNode, SavedTab, SavedLayout } from "../shared/types";

function getLayoutsPath(): string {
  return path.join(app.getPath("userData"), "layouts.json");
}

function loadLayouts(): SavedLayout[] {
  try {
    const raw = fs.readFileSync(getLayoutsPath(), "utf-8");
    return JSON.parse(raw) as SavedLayout[];
  } catch {
    return [];
  }
}

function writeLayouts(layouts: SavedLayout[]): void {
  const dir = path.dirname(getLayoutsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getLayoutsPath(), JSON.stringify(layouts, null, 2), "utf-8");
}

export function setupLayoutHandlers(): void {
  ipcMain.handle("layouts:list", () => {
    return loadLayouts();
  });

  ipcMain.handle(
    "layouts:save",
    (_event, layout: { name: string; tabs: SavedTab[] }) => {
      const layouts = loadLayouts();
      const existing = layouts.findIndex((l) => l.name === layout.name);
      const entry: SavedLayout = {
        name: layout.name,
        tabs: layout.tabs,
        createdAt: new Date().toISOString(),
      };
      if (existing >= 0) {
        layouts[existing] = entry;
      } else {
        layouts.push(entry);
      }
      writeLayouts(layouts);
      return layouts;
    },
  );

  ipcMain.handle("layouts:delete", (_event, name: string) => {
    const layouts = loadLayouts().filter((l) => l.name !== name);
    writeLayouts(layouts);
    return layouts;
  });
}
