import { app, ipcMain, shell, BrowserWindow } from "electron";
import * as path from "path";
import * as fs from "fs";
import type { VaporConfig } from "../shared/types";
export type { VaporConfig } from "../shared/types";

const DEFAULTS: VaporConfig = {
  font: {
    family:
      "SFMono Nerd Font, MesloLGS NF, MesloLGS Nerd Font, Hack Nerd Font, FiraCode Nerd Font, JetBrainsMono Nerd Font, SF Mono, Monaco, Inconsolata, Fira Mono, Droid Sans Mono, Source Code Pro, monospace",
    size: 12,
    ligatures: true,
  },
  shell: { path: "", args: [] },
  theme: {
    background: "rgba(0, 0, 0, 0.65)",
    foreground: "#FFFFFF",
    cursor: "#0095FF",
    selectionBackground: "rgba(0, 149, 255, 0.65)",
    black: "rgba(0, 0, 0, 0.65)",
    red: "#FF3B30",
    green: "#4CD964",
    yellow: "#FFCC00",
    blue: "#0095FF",
    magenta: "#FF2D55",
    cyan: "#5AC8FA",
    white: "#FFFFFF",
    brightBlack: "#686868",
    brightRed: "#FF3B30",
    brightGreen: "#4CD964",
    brightYellow: "#FFCC00",
    brightBlue: "#0095FF",
    brightMagenta: "#FF2D55",
    brightCyan: "#5AC8FA",
    brightWhite: "#FFFFFF",
  },
  vibrancy: "under-window",
  background: { transparent: true, opaqueColor: "#121212" },
  layouts: { restoreReplacesExisting: false },
  window: { width: 800, height: 600 },
};

let configCache: VaporConfig | null = null;

function getConfigPath(): string {
  return path.join(app.getPath("userData"), "config.json");
}

export function deepMerge(
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults };
  const allKeys = new Set([...Object.keys(defaults), ...Object.keys(overrides)]);
  for (const key of allKeys) {
    if (key in overrides) {
      const defaultVal = defaults[key];
      const overrideVal = overrides[key];
      if (
        defaultVal &&
        typeof defaultVal === "object" &&
        !Array.isArray(defaultVal) &&
        overrideVal &&
        typeof overrideVal === "object" &&
        !Array.isArray(overrideVal)
      ) {
        result[key] = deepMerge(
          defaultVal as Record<string, unknown>,
          overrideVal as Record<string, unknown>,
        );
      } else {
        result[key] = overrideVal;
      }
    }
  }
  return result;
}

function getScreenshotConfigPath(): string {
  // Use environment variable if provided (for screenshot mode)
  if (process.env.VAPOR_CONFIG_PATH) {
    return process.env.VAPOR_CONFIG_PATH;
  }
  // Fall back to looking in project root
  // When running from webpack build, __dirname is .webpack/arm64/main
  // so we need to go up 3 levels to get to project root
  const projectRoot = path.join(__dirname, "..", "..", "..");
  const screenshotConfigPath = path.join(projectRoot, ".vapor-screenshot-config.json");
  return screenshotConfigPath;
}

function loadConfig(): VaporConfig {
  if (configCache) return configCache;

  const configPath = getConfigPath();
  let config = { ...DEFAULTS };

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    config = deepMerge(
      config as unknown as Record<string, unknown>,
      parsed,
    ) as unknown as VaporConfig;
  } catch {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(DEFAULTS, null, 2), "utf-8");
  }

  if (process.env.VAPOR_SCREENSHOT_MODE === "1") {
    config.screenshotMode = true;
    try {
      const screenshotConfigPath = getScreenshotConfigPath();
      if (fs.existsSync(screenshotConfigPath)) {
        const raw = fs.readFileSync(screenshotConfigPath, "utf-8");
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        config = deepMerge(
          config as unknown as Record<string, unknown>,
          parsed,
        ) as unknown as VaporConfig;
      }
    } catch {
      // Optional screenshot overlay config; ignore parse/read errors
    }
  }

  if (process.env.VAPOR_FONT_SIZE) {
    config.font.size = parseInt(process.env.VAPOR_FONT_SIZE, 10);
  }
  if (process.env.VAPOR_FONT_FAMILY) {
    config.font.family = process.env.VAPOR_FONT_FAMILY;
  }
  if (process.env.VAPOR_WINDOW_WIDTH) {
    config.window.width = parseInt(process.env.VAPOR_WINDOW_WIDTH, 10);
  }
  if (process.env.VAPOR_WINDOW_HEIGHT) {
    config.window.height = parseInt(process.env.VAPOR_WINDOW_HEIGHT, 10);
  }

  configCache = config;
  return configCache;
}

export function getConfig(): VaporConfig {
  return loadConfig();
}

export function clearConfigCache(): void {
  configCache = null;
}

export function updateConfig(updates: Record<string, unknown>): VaporConfig {
  const configPath = getConfigPath();
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
  } catch { /* start from empty */ }
  const merged = deepMerge(raw, updates);
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf-8");
  configCache = null;
  return loadConfig();
}

export function broadcastConfig(config: VaporConfig): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("config:updated", config);
  }
}

export function openConfigInEditor(): void {
  const configPath = getConfigPath();
  loadConfig();
  shell.openPath(configPath);
}

export function setupConfigHandlers(): void {
  loadConfig();

  ipcMain.handle("config:get", () => {
    return loadConfig();
  });

  ipcMain.handle("config:get-path", () => {
    return getConfigPath();
  });

  ipcMain.handle("config:set", (_event, updates: Record<string, unknown>) => {
    const config = updateConfig(updates);
    broadcastConfig(config);
    return config;
  });
}
