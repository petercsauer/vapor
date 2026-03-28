import { app, BrowserWindow, nativeImage, ipcMain, shell } from "electron";
import { updateElectronApp } from "update-electron-app";
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

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

app.setName("Vapor");

export const createWindow = (): void => {
  const config = getConfig();

  const mainWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    transparent: true,
    visualEffectState: "active",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    hasShadow: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: false,
      sandbox: false,
    },
  });

  if (config.background?.transparent !== false) {
    const vibrancyType = (config.vibrancy || "under-window") as
      | "under-window"
      | "fullscreen-ui"
      | "header"
      | "sidebar";
    mainWindow.setVibrancy(vibrancyType);
  }

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.on("swipe" as const, (_event: Electron.Event, direction: string) => {
    if (direction === "left" || direction === "right") {
      mainWindow.webContents.send("swipe-tab", direction);
    }
  });
};

app.on("ready", () => {
  updateElectronApp();

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
