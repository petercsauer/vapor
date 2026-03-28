import { ipcMain } from "electron";
import { getConnectionPool } from "./ssh-connection-pool";

export function setupSSHHandlers(): void {
  ipcMain.handle("ssh:connect", async (_event, { host }: { host: string }) => {
    try {
      const pool = getConnectionPool();
      await pool.getConnection(host);
      return { success: true };
    } catch (err) {
      console.error(`[ssh:connect] Failed to connect to ${host}:`, err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("ssh:disconnect", async (_event, { host }: { host: string }) => {
    try {
      const pool = getConnectionPool();
      pool.closeConnection(host);
      return { success: true };
    } catch (err) {
      console.error(`[ssh:disconnect] Failed to disconnect from ${host}:`, err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("ssh:list-connections", async () => {
    try {
      const pool = getConnectionPool();
      return { connections: pool.listConnections() };
    } catch (err) {
      console.error(`[ssh:list-connections] Failed:`, err);
      return { connections: [] };
    }
  });
}
