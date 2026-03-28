import { app, BrowserWindow, nativeImage, ipcMain, shell } from "electron";
import { updateElectronApp } from "update-electron-app";
import log from "electron-log/main";
import * as path from "path";
import { setupPtyHandlers, killAllSessions } from "./main/pty-manager";
import { setupMenu } from "./main/menu";
import { setupConfigHandlers, getConfig } from "./main/config";
import { setupLayoutHandlers } from "./main/layout-manager";
import { setupTabNamer } from "./main/tab-namer";
import { setupFsHandlers, closeWatcher } from "./main/fs-handler";
import { setupRemoteFsHandlers } from "./main/remote-fs-handler";
import { startCliServer, stopCliServer, handleOpenFileArgs } from "./main/cli-server";
import { setupSSHHandlers } from "./main/ssh-handler";
import { setupHostHandlers } from "./main/host-manager";
import { closeConnectionPool } from "./main/ssh-connection-pool";
import { loadWindowState, saveWindowState } from "./main/window-state";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

app.setName("Vapor");

log.initialize({ preload: true });
log.transports.file.level = "info";
log.transports.file.maxSize = 5 * 1024 * 1024;

process.on("uncaughtException", (err) => {
  log.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
  log.error("Unhandled rejection:", reason);
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on("second-instance", (_event, argv) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
    handleOpenFileArgs(argv);
  }
});

let isFirstWindow = true;

export const createWindow = (): void => {
  const config = getConfig();

  let windowOpts: Electron.BrowserWindowConstructorOptions = {
    width: config.window.width,
    height: config.window.height,
  };

  let shouldMaximize = false;

  if (isFirstWindow) {
    const savedState = loadWindowState();
    windowOpts.width = savedState.width;
    windowOpts.height = savedState.height;
    if (savedState.x !== undefined && savedState.y !== undefined) {
      windowOpts.x = savedState.x;
      windowOpts.y = savedState.y;
    }
    shouldMaximize = savedState.isMaximized;
    isFirstWindow = false;
  }

  const mainWindow = new BrowserWindow({
    ...windowOpts,
    transparent: true,
    visualEffectState: "active",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    hasShadow: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (shouldMaximize) {
    mainWindow.maximize();
  }

  if (config.background?.transparent !== false) {
    const vibrancyType = (config.vibrancy || "under-window") as
      | "under-window"
      | "fullscreen-ui"
      | "header"
      | "sidebar";
    mainWindow.setVibrancy(vibrancyType);
  }

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.on("resize", () => saveWindowState(mainWindow));
  mainWindow.on("move", () => saveWindowState(mainWindow));
  mainWindow.on("close", () => saveWindowState(mainWindow));

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log.error("Render process gone:", details.reason, "exitCode:", details.exitCode);
  });

  mainWindow.on("unresponsive", () => {
    log.warn("Window became unresponsive");
  });

  mainWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });

  mainWindow.on("swipe" as const, (_event: Electron.Event, direction: string) => {
    if (direction === "left" || direction === "right") {
      mainWindow.webContents.send("swipe-tab", direction);
    }
  });
};

app.on("ready", () => {
  updateElectronApp({
    updateInterval: "1 hour",
    notifyUser: true,
  });

  const iconDirs = [
    path.join(app.getAppPath(), "assets"),
    path.join(__dirname, "..", "assets"),
    path.join(process.cwd(), "assets"),
  ];
  for (const dir of iconDirs) {
    try {
      const icon = nativeImage.createFromPath(path.join(dir, "icon.png"));
      if (!icon.isEmpty() && app.dock) {
        app.dock.setIcon(icon);
        break;
      }
    } catch {
      continue;
    }
  }

  // Setup dock menu (macOS)
  if (app.dock) {
    const dockMenu = require("electron").Menu.buildFromTemplate([
      {
        label: "New Window",
        click: () => createWindow(),
      },
    ]);
    app.dock.setMenu(dockMenu);
  }

  ipcMain.on("open-external", (_event, url: string) => {
    if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
      shell.openExternal(url);
    }
  });

  setupConfigHandlers();
  setupPtyHandlers();
  setupSSHHandlers();
  setupHostHandlers();
  setupLayoutHandlers();
  setupTabNamer();
  setupFsHandlers();
  setupRemoteFsHandlers();
  setupMenu();
  startCliServer();
  createWindow();

  handleOpenFileArgs(process.argv);
});

app.on("window-all-closed", () => {
  killAllSessions();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  killAllSessions();
  closeConnectionPool();
  closeWatcher();
  stopCliServer();
});

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send("cli:open-file", {
      filePath,
      direction: "horizontal",
    });
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});
