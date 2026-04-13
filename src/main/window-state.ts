import { app, BrowserWindow, screen } from "electron";
import * as path from "path";
import * as fs from "fs";
import { getConfig } from "./config";

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function getStatePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

function isPositionOnScreen(x: number, y: number): boolean {
  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const { x: dx, y: dy, width, height } = display.bounds;
    return x >= dx && x < dx + width && y >= dy && y < dy + height;
  });
}

export function loadWindowState(): WindowState {
  const config = getConfig();
  const defaults: WindowState = {
    width: config.window.width,
    height: config.window.height,
    isMaximized: false,
  };

  try {
    const raw = fs.readFileSync(getStatePath(), "utf-8");
    const saved = JSON.parse(raw) as WindowState;

    const state: WindowState = {
      width: saved.width > 0 ? saved.width : defaults.width,
      height: saved.height > 0 ? saved.height : defaults.height,
      isMaximized: Boolean(saved.isMaximized),
    };

    if (
      typeof saved.x === "number" &&
      typeof saved.y === "number" &&
      isPositionOnScreen(saved.x, saved.y)
    ) {
      state.x = saved.x;
      state.y = saved.y;
    }

    return state;
  } catch {
    return defaults;
  }
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function writeState(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  try {
    const bounds = win.getBounds();
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized(),
    };
    const dir = path.dirname(getStatePath());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2), "utf-8");
  } catch {
    // Best-effort persistence; don't crash on write failures
  }
}

export function saveWindowState(win: BrowserWindow): void {
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    writeState(win);
  }, 1000);
}

export function flushWindowState(win: BrowserWindow): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  writeState(win);
}
