// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

// Store mock instances for sharing across tests
let mockClientInstances: any[] = [];
let mockSftpInstances: any[] = [];

vi.mock("electron-log/main", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), initialize: vi.fn(), transports: { file: {} } },
}));

// Mock ssh2 - must be hoisted before imports
vi.mock("ssh2", async () => {
  const { EventEmitter } = await import("events");

  class MockClient extends EventEmitter {
    connect = vi.fn();
    end = vi.fn();
    destroy = vi.fn();
    sftp = vi.fn();

    constructor() {
      super();
      mockClientInstances.push(this);
    }
  }

  class MockSFTPWrapper extends EventEmitter {
    readdir = vi.fn();

    constructor() {
      super();
      mockSftpInstances.push(this);
    }
  }

  return {
    Client: MockClient,
    SFTPWrapper: MockSFTPWrapper,
  };
});

// Mock fs
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { Client } from "ssh2";
import * as fs from "fs";
import { SFTPConnectionPool, getConnectionPool, closeConnectionPool } from "./ssh-connection-pool";

describe("SFTPConnectionPool", () => {
  let pool: SFTPConnectionPool;

  // Helper to simulate successful connection
  const simulateConnection = (clientIndex = 0) => {
    const client = mockClientInstances[clientIndex];

    // Setup SFTP mock
    client.sftp.mockImplementation((callback: any) => {
      const mockSftp = { readdir: vi.fn() };
      mockSftpInstances.push(mockSftp);
      // Call callback synchronously to avoid timing issues
      callback(null, mockSftp);
    });

    // Emit ready
    client.emit("ready");
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientInstances = [];
    mockSftpInstances = [];

    // Mock fs.readFileSync to return SSH config
    vi.mocked(fs.readFileSync).mockReturnValue(`
Host testhost
  HostName 192.168.1.100
  Port 2222
  User testuser
  IdentityFile ~/.ssh/id_test
`);

    pool = new SFTPConnectionPool();
  });

  afterEach(() => {
    vi.clearAllTimers();
    pool.closeAllConnections();
  });

  it("creates a new connection for a host", async () => {
    const connectPromise = pool.getConnection("testhost");

    // Wait for client to be created
    await vi.waitFor(() => mockClientInstances.length > 0);

    // Simulate successful connection
    simulateConnection(0);

    const sftp = await connectPromise;

    expect(sftp).toBeDefined();
    expect(mockClientInstances.length).toBe(1);
    expect(mockClientInstances[0].connect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "192.168.1.100",
        port: 2222,
        username: "testuser",
      })
    );
  });

  it("reuses existing connection for the same host", async () => {
    const firstPromise = pool.getConnection("testhost");

    await vi.waitFor(() => mockClientInstances.length > 0);
    simulateConnection(0);

    const first = await firstPromise;

    // Second connection - should reuse
    const second = await pool.getConnection("testhost");

    expect(first).toBe(second);
    expect(mockClientInstances[0].connect).toHaveBeenCalledTimes(1);
  });

  it("handles connection timeout", async () => {
    vi.useFakeTimers();

    const connectPromise = pool.getConnection("testhost");

    // Flush microtasks so the async getSSHConfigForHost resolves
    // and the Client + setTimeout are created under fake timers
    await vi.advanceTimersByTimeAsync(0);
    expect(mockClientInstances.length).toBeGreaterThan(0);

    // Use sync advance to fire the timeout, then await the rejection
    vi.advanceTimersByTime(11000);
    await expect(connectPromise).rejects.toThrow(/timed out/);

    vi.useRealTimers();
  });

  it("handles connection error", async () => {
    const connectPromise = pool.getConnection("testhost");

    await vi.waitFor(() => mockClientInstances.length > 0);

    mockClientInstances[0].emit("error", new Error("Connection refused"));

    await expect(connectPromise).rejects.toThrow(/Connection refused/);
  });

  it("handles SFTP session creation failure", async () => {
    const connectPromise = pool.getConnection("testhost");

    await vi.waitFor(() => mockClientInstances.length > 0);

    const client = mockClientInstances[0];
    client.sftp.mockImplementation((callback: any) => {
      callback(new Error("SFTP failed"), null);
    });
    client.emit("ready");

    await expect(connectPromise).rejects.toThrow(/SFTP failed/);
  });

  it("closes a specific connection", async () => {
    const connectPromise = pool.getConnection("testhost");

    await vi.waitFor(() => mockClientInstances.length > 0);
    simulateConnection(0);

    await connectPromise;

    pool.closeConnection("testhost");

    expect(mockClientInstances[0].end).toHaveBeenCalled();
    expect(pool.listConnections()).toHaveLength(0);
  });

  it("lists active connections", async () => {
    const promise1 = pool.getConnection("host1");
    await vi.waitFor(() => mockClientInstances.length > 0);
    simulateConnection(0);

    const promise2 = pool.getConnection("host2");
    await vi.waitFor(() => mockClientInstances.length > 1);
    simulateConnection(1);

    await Promise.all([promise1, promise2]);

    const connections = pool.listConnections();
    expect(connections).toContain("host1");
    expect(connections).toContain("host2");
    expect(connections).toHaveLength(2);
  });

  it("closes all connections", async () => {
    const promise1 = pool.getConnection("host1");
    await vi.waitFor(() => mockClientInstances.length > 0);
    simulateConnection(0);

    const promise2 = pool.getConnection("host2");
    await vi.waitFor(() => mockClientInstances.length > 1);
    simulateConnection(1);

    await Promise.all([promise1, promise2]);

    pool.closeAllConnections();

    expect(pool.listConnections()).toHaveLength(0);
    expect(mockClientInstances[0].end).toHaveBeenCalled();
    expect(mockClientInstances[1].end).toHaveBeenCalled();
  });

  it("performs health checks on connections", async () => {
    vi.useFakeTimers();

    const connectPromise = pool.getConnection("testhost");
    await vi.waitFor(() => mockClientInstances.length > 0);

    const client = mockClientInstances[0];
    let mockSftp: any;

    client.sftp.mockImplementation((callback: any) => {
      mockSftp = { readdir: vi.fn((path: string, cb: any) => cb(null, [])) };
      mockSftpInstances.push(mockSftp);
      callback(null, mockSftp);
    });

    client.emit("ready");
    await connectPromise;

    mockSftp.readdir.mockClear();

    // Fast-forward to health check
    await vi.advanceTimersByTimeAsync(30000);

    expect(mockSftp.readdir).toHaveBeenCalledWith("/", expect.any(Function));

    vi.useRealTimers();
  });

  it("handles concurrent connection requests to the same host", async () => {
    const promise1 = pool.getConnection("testhost");
    const promise2 = pool.getConnection("testhost");

    await vi.waitFor(() => mockClientInstances.length > 0);
    simulateConnection(0);

    const [sftp1, sftp2] = await Promise.all([promise1, promise2]);

    expect(sftp1).toBe(sftp2);
    expect(mockClientInstances).toHaveLength(1);
  });

  it("falls back to default SSH config when file not found", async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const connectPromise = pool.getConnection("testhost");
    await vi.waitFor(() => mockClientInstances.length > 0);
    simulateConnection(0);

    await connectPromise;

    expect(mockClientInstances[0].connect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "testhost",
        port: 22,
      })
    );
  });

  it("removeConnection calls client.end()", async () => {
    const connectPromise = pool.getConnection("testhost");

    await vi.waitFor(() => mockClientInstances.length > 0);
    simulateConnection(0);

    await connectPromise;

    const client = mockClientInstances[0];
    client.end.mockClear();

    // Trigger removeConnection via the "end" event handler
    client.emit("end");

    expect(client.end).toHaveBeenCalled();
    expect(pool.listConnections()).toHaveLength(0);
  });

  it("reconnect timers cancelled on closeAllConnections", async () => {
    vi.useFakeTimers();
    try {
      const connectPromise = pool.getConnection("testhost");
      await vi.advanceTimersByTimeAsync(0);
      simulateConnection(0);

      await connectPromise;

      const client = mockClientInstances[0];

      // Trigger a connection error to schedule a reconnect timer
      client.sftp.mockImplementation((callback: any) => {
        const mockSftp = { readdir: vi.fn() };
        mockSftpInstances.push(mockSftp);
        callback(null, mockSftp);
      });

      client.emit("error", new Error("Simulated disconnect"));

      // A reconnect timer should now be pending
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      // closeAllConnections should clear the reconnect timer
      pool.closeAllConnections();

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Connection pool singleton", () => {
  afterEach(() => {
    closeConnectionPool();
  });

  it("returns the same instance", () => {
    const pool1 = getConnectionPool();
    const pool2 = getConnectionPool();

    expect(pool1).toBe(pool2);
  });

  it("creates new instance after close", () => {
    const pool1 = getConnectionPool();
    closeConnectionPool();
    const pool2 = getConnectionPool();

    expect(pool1).not.toBe(pool2);
  });
});
