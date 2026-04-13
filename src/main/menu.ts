import { app, autoUpdater, Menu, BrowserWindow, MenuItemConstructorOptions, dialog } from "electron";
import { openConfigInEditor, getConfig, updateConfig, broadcastConfig } from "./config";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { createWindow } from "../index";

let isManualCheck = false;

autoUpdater.on("update-available", () => {
  if (isManualCheck) {
    dialog.showMessageBox({
      type: "info",
      title: "Update Available",
      message: "A new version is available and will be downloaded.",
    });
    isManualCheck = false;
  }
});

autoUpdater.on("update-not-available", () => {
  if (isManualCheck) {
    dialog.showMessageBox({
      type: "info",
      title: "No Updates",
      message: "You are running the latest version of Vapor.",
    });
    isManualCheck = false;
  }
});

autoUpdater.on("error", (err) => {
  if (isManualCheck) {
    dialog.showMessageBox({
      type: "warning",
      title: "Update Error",
      message: "Could not check for updates.",
      detail: err?.message || String(err),
    });
    isManualCheck = false;
  }
});

function sendToRenderer(action: string): void {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.webContents.send("menu:action", action);
  }
}

function installCli(): void {
  const bundledPath = path.join(process.resourcesPath, "vpr");
  const devPath = path.join(app.getAppPath(), "bin", "vpr");
  const srcPath = fs.existsSync(bundledPath) ? bundledPath : devPath;
  const target = "/usr/local/bin/vpr";

  if (!fs.existsSync(srcPath)) {
    dialog.showErrorBox("Install Failed", "Could not find the vpr script in the app bundle.");
    return;
  }

  try {
    if (!fs.existsSync("/usr/local/bin")) {
      fs.mkdirSync("/usr/local/bin", { recursive: true });
    }
    try { fs.unlinkSync(target); } catch { /* didn't exist */ }
    fs.symlinkSync(srcPath, target);
    dialog.showMessageBox({
      type: "info",
      title: "CLI Installed",
      message: "The 'vpr' command has been installed.",
      detail: `You can now use 'vpr <file>' to open files in Vapor.\n\nUse 'vpr -b <file>' to split below.`,
    });
  } catch {
    try {
      execSync(
        `osascript -e 'do shell script "ln -sf \\"${srcPath}\\" \\"${target}\\"" with administrator privileges'`,
      );
      dialog.showMessageBox({
        type: "info",
        title: "CLI Installed",
        message: "The 'vpr' command has been installed.",
        detail: `You can now use 'vpr <file>' to open files in Vapor.\n\nUse 'vpr -b <file>' to split below.`,
      });
    } catch {
      dialog.showErrorBox(
        "Install Failed",
        `Could not create symlink at ${target}.\nTry running: ln -sf "${srcPath}" ${target}`,
      );
    }
  }
}

export function setupMenu(): void {
  app.setAboutPanelOptions({
    applicationName: "Vapor",
    applicationVersion: app.getVersion(),
    copyright: "Copyright 2026 Peter Sauer. MIT License.",
  });

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Settings...",
          accelerator: "Cmd+,",
          click: () => openConfigInEditor(),
        },
        {
          label: "Check for Updates...",
          click: () => {
            isManualCheck = true;
            autoUpdater.checkForUpdates();
          },
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Shell",
      submenu: [
        {
          label: "New Window",
          accelerator: "Cmd+N",
          click: () => createWindow(),
        },
        {
          label: "New Tab",
          accelerator: "Cmd+T",
          click: () => sendToRenderer("menu:new-tab"),
        },
        {
          label: "Close",
          accelerator: "Cmd+W",
          click: () => sendToRenderer("menu:close"),
        },
        { type: "separator" },
        {
          label: "Install Command Line Tool...",
          click: () => installCli(),
        },
        { type: "separator" },
        {
          label: "Split Horizontally",
          accelerator: "Cmd+D",
          click: () => sendToRenderer("menu:split-h"),
        },
        {
          label: "Split Vertically",
          accelerator: "Cmd+Shift+D",
          click: () => sendToRenderer("menu:split-v"),
        },
        { type: "separator" },
        ...Array.from({ length: 9 }, (_, i) => ({
          label: `Select Tab ${i + 1}`,
          accelerator: `Cmd+${i + 1}` as string,
          click: () => sendToRenderer(`menu:tab-${i + 1}`),
        })),
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "selectAll" as const },
        { type: "separator" as const },
        {
          label: "Find...",
          accelerator: "Cmd+F",
          click: () => sendToRenderer("menu:find"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Sidebar",
          accelerator: "Cmd+B",
          click: () => sendToRenderer("menu:toggle-sidebar"),
        },
        { type: "separator" },
        {
          label: "Open Folder...",
          accelerator: "Cmd+Shift+O",
          click: () => sendToRenderer("menu:open-folder"),
        },
        { type: "separator" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "resetZoom" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { type: "separator" },
        {
          label: "Toggle Developer Tools",
          accelerator: "Cmd+Option+I",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "close" },
        { type: "separator" },
        {
          label: "Remove Transparency",
          type: "checkbox",
          checked: getConfig().background?.transparent === false,
          click: (menuItem) => {
            const removeTransparency = menuItem.checked;
            const config = updateConfig({
              background: { transparent: !removeTransparency },
            });

            for (const win of BrowserWindow.getAllWindows()) {
              if (removeTransparency) {
                win.setVibrancy(null as Parameters<typeof win.setVibrancy>[0]);
              } else {
                const vibrancyType = (config.vibrancy || "under-window") as Parameters<typeof win.setVibrancy>[0];
                win.setVibrancy(vibrancyType);
              }
            }

            broadcastConfig(config);
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
