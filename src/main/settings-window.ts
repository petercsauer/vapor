import { BrowserWindow, screen } from "electron";

declare const SETTINGS_WINDOW_WEBPACK_ENTRY: string;
declare const SETTINGS_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let settingsWindow: BrowserWindow | null = null;

export function openSettingsWindow(): void {
  // If window already exists, focus it
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  settingsWindow = new BrowserWindow({
    width: 640,
    height: 480,
    minWidth: 580,
    minHeight: 400,
    maxWidth: 800,
    maxHeight: 800,
    x: Math.floor((screenWidth - 640) / 2),
    y: Math.floor((screenHeight - 480) / 3),
    title: "Settings",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 20, y: 20 },
    transparent: true,
    vibrancy: "under-window",
    visualEffectState: "active",
    hasShadow: true,
    minimizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: SETTINGS_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadURL(SETTINGS_WINDOW_WEBPACK_ENTRY);

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  if (process.env.NODE_ENV === "development") {
    settingsWindow.webContents.openDevTools({ mode: "detach" });
  }
}
