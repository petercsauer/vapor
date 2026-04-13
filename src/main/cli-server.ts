import * as net from "net";
import * as path from "path";
import * as fs from "fs";
import { app, BrowserWindow } from "electron";
import log from "electron-log/main";

const SOCKET_DIR = path.join(app.getPath("home"), ".vapor");
const SOCKET_PATH = path.join(SOCKET_DIR, "cli.sock");

let server: net.Server | null = null;

export function getSocketPath(): string {
  return SOCKET_PATH;
}

export function startCliServer(): void {
  if (!fs.existsSync(SOCKET_DIR)) {
    fs.mkdirSync(SOCKET_DIR, { recursive: true });
  }

  try {
    fs.unlinkSync(SOCKET_PATH);
  } catch {
    // no stale socket
  }

  server = net.createServer((conn) => {
    let buf = "";
    let handled = false;

    const tryHandle = () => {
      if (handled) return;
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        handled = true;
        handleCliMessage(buf.slice(0, nl).trim());
        conn.end();
      }
    };

    conn.on("data", (chunk) => {
      buf += chunk.toString();
      tryHandle();
    });
    conn.on("end", () => {
      if (!handled) {
        handled = true;
        handleCliMessage(buf.trim());
      }
    });
    conn.on("error", () => {
      // Ignore connection errors
    });
  });

  server.on("error", (err) => {
    log.error("CLI server error:", err);
  });

  server.listen(SOCKET_PATH, () => {
    try {
      fs.chmodSync(SOCKET_PATH, 0o600);
    } catch {
      // best effort
    }
  });
}

export function stopCliServer(): void {
  if (server) {
    server.close();
    server = null;
  }
  try {
    fs.unlinkSync(SOCKET_PATH);
  } catch {
    // already gone
  }
}

function handleCliMessage(raw: string): void {
  let msg: { action?: string; filePath?: string; direction?: string };
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.action === "open" && msg.filePath) {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;

    const direction = msg.direction === "below" ? "vertical" : "horizontal";

    win.webContents
      .executeJavaScript(
        `(async () => {
          if (!window.__vprOpenFile) return;
          await window.__vprOpenFile(${JSON.stringify(msg.filePath)}, ${JSON.stringify(direction)});
        })()`,
      )
      .catch(() => {
        // Ignore execution errors
      });

    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    app.dock?.bounce("informational");
  }
}

export function handleOpenFileArgs(argv: string[]): void {
  let filePath: string | null = null;
  let direction = "horizontal";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-b" || arg === "--below") {
      direction = "vertical";
    } else if (
      i > 0 && // Skip argv[0] which is the executable
      !arg.startsWith("-") &&
      !arg.includes("electron") &&
      !arg.includes(".webpack") &&
      !arg.includes(".app/") &&
      !arg.toLowerCase().includes("vapor")
    ) {
      const resolved = path.isAbsolute(arg) ? arg : path.resolve(arg);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        filePath = resolved;
      }
    }
  }

  if (!filePath) return;

  const tryOpen = () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    win.webContents
      .executeJavaScript(
        `(async () => {
          if (!window.__vprOpenFile) return;
          await window.__vprOpenFile(${JSON.stringify(filePath)}, ${JSON.stringify(direction)});
        })()`,
      )
      .catch(() => {
        // Ignore execution errors
      });
  };

  setTimeout(tryOpen, 2000);
}
