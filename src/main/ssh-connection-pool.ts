import { Client, SFTPWrapper } from "ssh2";
import log from "electron-log/main";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface SSHConfig {
  host: string;
  port: number;
  username: string;
  privateKey?: Buffer;
  passphrase?: string;
  agent?: string;
  agentForward?: boolean;
}

interface ConnectionEntry {
  sftp: SFTPWrapper;
  client: Client;
  lastUsed: number;
  healthCheckTimer?: NodeJS.Timeout;
  reconnectAttempts: number;
}

export class SFTPConnectionPool {
  private connections = new Map<string, ConnectionEntry>();
  private pendingConnections = new Map<string, Promise<SFTPWrapper>>();
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30s
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly CONNECTION_TIMEOUT = 10000; // 10s
  private readonly INITIAL_BACKOFF = 1000; // 1s
  private readonly MAX_BACKOFF = 8000; // 8s

  async getConnection(host: string): Promise<SFTPWrapper> {
    const existing = this.connections.get(host);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.sftp;
    }

    // Check if connection is in progress
    const pending = this.pendingConnections.get(host);
    if (pending) {
      return pending;
    }

    const connectionPromise = this.createConnection(host);
    this.pendingConnections.set(host, connectionPromise);

    try {
      const sftp = await connectionPromise;
      this.pendingConnections.delete(host);
      return sftp;
    } catch (err) {
      this.pendingConnections.delete(host);
      throw err;
    }
  }

  async createConnection(host: string): Promise<SFTPWrapper> {
    const config = await this.getSSHConfigForHost(host);

    return new Promise((resolve, reject) => {
      const client = new Client();
      const timeoutHandle = setTimeout(() => {
        client.destroy();
        reject(new Error(`SSH connection to ${host} timed out after ${this.CONNECTION_TIMEOUT}ms`));
      }, this.CONNECTION_TIMEOUT);

      client.on("ready", () => {
        clearTimeout(timeoutHandle);
        client.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
          if (err) {
            client.end();
            reject(new Error(`Failed to start SFTP session: ${err.message}`));
            return;
          }

          const entry: ConnectionEntry = {
            sftp,
            client,
            lastUsed: Date.now(),
            reconnectAttempts: 0,
          };

          // Set up health check
          entry.healthCheckTimer = setInterval(() => {
            this.healthCheck(host, entry);
          }, this.HEALTH_CHECK_INTERVAL);

          // Handle connection errors
          client.on("error", (err: Error) => {
            log.error(`[SFTPConnectionPool] Connection error for ${host}:`, err);
            this.handleConnectionError(host, entry);
          });

          client.on("end", () => {
            log.info(`[SFTPConnectionPool] Connection ended for ${host}`);
            this.removeConnection(host);
          });

          client.on("close", () => {
            log.info(`[SFTPConnectionPool] Connection closed for ${host}`);
            this.removeConnection(host);
          });

          this.connections.set(host, entry);
          resolve(sftp);
        });
      });

      client.on("error", (err: Error) => {
        clearTimeout(timeoutHandle);
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      client.connect(config);
    });
  }

  private async healthCheck(host: string, entry: ConnectionEntry): Promise<void> {
    try {
      // Simple health check: try to read the root directory
      await new Promise<void>((resolve, reject) => {
        entry.sftp.readdir("/", (err: Error | undefined) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      entry.reconnectAttempts = 0; // Reset on successful check
    } catch (err) {
      log.warn(`[SFTPConnectionPool] Health check failed for ${host}:`, err);
      this.handleConnectionError(host, entry);
    }
  }

  private async handleConnectionError(host: string, entry: ConnectionEntry): Promise<void> {
    if (entry.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      log.error(`[SFTPConnectionPool] Max reconnection attempts reached for ${host}, removing connection`);
      this.removeConnection(host);
      return;
    }

    const backoff = Math.min(
      this.INITIAL_BACKOFF * Math.pow(2, entry.reconnectAttempts),
      this.MAX_BACKOFF,
    );
    entry.reconnectAttempts++;

    log.info(`[SFTPConnectionPool] Reconnecting to ${host} in ${backoff}ms (attempt ${entry.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

    setTimeout(async () => {
      try {
        // Remove old connection
        this.removeConnection(host);
        // Create new connection
        await this.createConnection(host);
        log.info(`[SFTPConnectionPool] Successfully reconnected to ${host}`);
      } catch (err) {
        log.error(`[SFTPConnectionPool] Reconnection failed for ${host}:`, err);
      }
    }, backoff);
  }

  private removeConnection(host: string): void {
    const entry = this.connections.get(host);
    if (entry) {
      if (entry.healthCheckTimer) {
        clearInterval(entry.healthCheckTimer);
      }
      this.connections.delete(host);
    }
  }

  closeConnection(host: string): void {
    const entry = this.connections.get(host);
    if (entry) {
      if (entry.healthCheckTimer) {
        clearInterval(entry.healthCheckTimer);
      }
      entry.client.end();
      this.connections.delete(host);
    }
  }

  closeAllConnections(): void {
    for (const host of this.connections.keys()) {
      this.closeConnection(host);
    }
  }

  listConnections(): string[] {
    return Array.from(this.connections.keys());
  }

  private async getSSHConfigForHost(host: string): Promise<SSHConfig> {
    const config: SSHConfig = {
      host,
      port: 22,
      username: os.userInfo().username,
    };

    // Try to read ~/.ssh/config
    try {
      const sshConfigPath = path.join(os.homedir(), ".ssh", "config");
      const configContent = fs.readFileSync(sshConfigPath, "utf8");
      const parsedConfig = this.parseSSHConfig(configContent, host);

      if (parsedConfig.hostname) {
        config.host = parsedConfig.hostname;
      }
      if (parsedConfig.port) {
        config.port = parsedConfig.port;
      }
      if (parsedConfig.user) {
        config.username = parsedConfig.user;
      }
      if (parsedConfig.identityFile) {
        const keyPath = parsedConfig.identityFile.replace(/^~/, os.homedir());
        config.privateKey = fs.readFileSync(keyPath);
      }
    } catch (err) {
      log.warn(`[SFTPConnectionPool] Could not read SSH config:`, err);
    }

    // Try SSH agent
    const agentSock = process.env.SSH_AUTH_SOCK;
    if (agentSock) {
      config.agent = agentSock;
      config.agentForward = true;
    }

    // Try default identity files if no key specified
    if (!config.privateKey && !config.agent) {
      const defaultKeys = ["id_rsa", "id_ecdsa", "id_ed25519"];
      for (const keyName of defaultKeys) {
        try {
          const keyPath = path.join(os.homedir(), ".ssh", keyName);
          config.privateKey = fs.readFileSync(keyPath);
          break;
        } catch {
          // Try next key
        }
      }
    }

    return config;
  }

  private parseSSHConfig(content: string, targetHost: string): {
    hostname?: string;
    port?: number;
    user?: string;
    identityFile?: string;
  } {
    const result: {
      hostname?: string;
      port?: number;
      user?: string;
      identityFile?: string;
    } = {};

    let currentHost: string | null = null;
    let inTargetHostBlock = false;

    for (const line of content.split("\n")) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Check for Host directive
      const hostMatch = trimmed.match(/^\s*Host\s+(.+)$/i);
      if (hostMatch) {
        const hosts = hostMatch[1].split(/\s+/);
        currentHost = hosts[0];
        inTargetHostBlock = hosts.includes(targetHost);
        continue;
      }

      // Only parse directives if we're in the target host block
      if (!inTargetHostBlock) {
        continue;
      }

      // Parse directives
      const hostnameMatch = trimmed.match(/^\s*HostName\s+(.+)$/i);
      if (hostnameMatch) {
        result.hostname = hostnameMatch[1];
        continue;
      }

      const portMatch = trimmed.match(/^\s*Port\s+(\d+)$/i);
      if (portMatch) {
        result.port = parseInt(portMatch[1], 10);
        continue;
      }

      const userMatch = trimmed.match(/^\s*User\s+(.+)$/i);
      if (userMatch) {
        result.user = userMatch[1];
        continue;
      }

      const identityMatch = trimmed.match(/^\s*IdentityFile\s+(.+)$/i);
      if (identityMatch) {
        result.identityFile = identityMatch[1];
        continue;
      }
    }

    return result;
  }
}

// Singleton instance
let poolInstance: SFTPConnectionPool | null = null;

export function getConnectionPool(): SFTPConnectionPool {
  if (!poolInstance) {
    poolInstance = new SFTPConnectionPool();
  }
  return poolInstance;
}

export function closeConnectionPool(): void {
  if (poolInstance) {
    poolInstance.closeAllConnections();
    poolInstance = null;
  }
}
