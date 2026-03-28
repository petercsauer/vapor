// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn().mockReturnValue("/tmp/vapor-test-userdata"),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

import * as fs from "fs";
import { execFile } from "child_process";
import {
  listSSHConfigHosts,
  listDockerContainers,
  loadRecentHosts,
  addRecentHost,
  setupHostHandlers,
  resetSSHConfigCache,
} from "./host-manager";
import { ipcMain } from "electron";

describe("listSSHConfigHosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSSHConfigCache();
  });

  it("parses SSH config and returns sorted host names", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      "Host zebra\n  HostName 10.0.0.1\n\nHost alpha\n  HostName 10.0.0.2\n\nHost beta\n  HostName 10.0.0.3\n",
    );

    const hosts = listSSHConfigHosts();

    expect(hosts).toEqual(["alpha", "beta", "zebra"]);
  });

  it("skips wildcard patterns", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(
      "Host *\n  ServerAliveInterval 60\n\nHost prod-?\n  User admin\n\nHost staging\n  HostName staging.example.com\n",
    );

    const hosts = listSSHConfigHosts();

    expect(hosts).toEqual(["staging"]);
  });

  it("handles multiple hosts on one line", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("Host web1 web2 db1\n");

    const hosts = listSSHConfigHosts();

    expect(hosts).toEqual(["db1", "web1", "web2"]);
  });

  it("returns empty array when SSH config is missing", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const hosts = listSSHConfigHosts();

    expect(hosts).toEqual([]);
  });

  it("caches results on subsequent calls", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("Host cached-host\n");

    listSSHConfigHosts();
    listSSHConfigHosts();

    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
  });

  it("handles case-insensitive Host directive", () => {
    vi.mocked(fs.readFileSync).mockReturnValue("host myserver\n  hostname 10.0.0.1\n");

    const hosts = listSSHConfigHosts();

    expect(hosts).toEqual(["myserver"]);
  });
});

describe("listDockerContainers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns container names from docker ps", async () => {
    vi.mocked(execFile).mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        callback(null, "web-app\ndb-server\nredis\n", "");
        return {} as any;
      },
    );

    const containers = await listDockerContainers();

    expect(containers).toEqual(["web-app", "db-server", "redis"]);
  });

  it("returns empty array when docker is not available", async () => {
    vi.mocked(execFile).mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        callback(new Error("command not found: docker"), "", "");
        return {} as any;
      },
    );

    const containers = await listDockerContainers();

    expect(containers).toEqual([]);
  });

  it("returns empty array on timeout", async () => {
    vi.mocked(execFile).mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        const err = new Error("ETIMEDOUT") as any;
        err.killed = true;
        callback(err, "", "");
        return {} as any;
      },
    );

    const containers = await listDockerContainers();

    expect(containers).toEqual([]);
  });

  it("returns empty array when no containers are running", async () => {
    vi.mocked(execFile).mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        callback(null, "", "");
        return {} as any;
      },
    );

    const containers = await listDockerContainers();

    expect(containers).toEqual([]);
  });
});

describe("recent hosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadRecentHosts", () => {
    it("returns hosts sorted by lastUsed descending", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify([
          { type: "ssh", host: "old", lastUsed: "2024-01-01T00:00:00.000Z" },
          { type: "ssh", host: "new", lastUsed: "2024-06-01T00:00:00.000Z" },
          { type: "docker", host: "mid", lastUsed: "2024-03-01T00:00:00.000Z" },
        ]),
      );

      const hosts = loadRecentHosts();

      expect(hosts[0].host).toBe("new");
      expect(hosts[1].host).toBe("mid");
      expect(hosts[2].host).toBe("old");
    });

    it("returns empty array when file does not exist", () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const hosts = loadRecentHosts();

      expect(hosts).toEqual([]);
    });

    it("returns empty array for corrupt JSON", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("not json{{{");

      const hosts = loadRecentHosts();

      expect(hosts).toEqual([]);
    });
  });

  describe("addRecentHost", () => {
    it("adds a new host entry", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([]));

      addRecentHost({ type: "ssh", host: "new-server" });

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written).toHaveLength(1);
      expect(written[0].host).toBe("new-server");
      expect(written[0].type).toBe("ssh");
      expect(written[0].lastUsed).toBeDefined();
    });

    it("updates lastUsed for existing host", () => {
      const oldDate = "2024-01-01T00:00:00.000Z";
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify([{ type: "ssh", host: "existing", lastUsed: oldDate }]),
      );

      addRecentHost({ type: "ssh", host: "existing" });

      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written).toHaveLength(1);
      expect(written[0].host).toBe("existing");
      expect(new Date(written[0].lastUsed).getTime()).toBeGreaterThan(
        new Date(oldDate).getTime(),
      );
    });

    it("does not duplicate when same type+host exists", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify([
          { type: "ssh", host: "server1", lastUsed: "2024-01-01T00:00:00.000Z" },
        ]),
      );

      addRecentHost({ type: "ssh", host: "server1" });

      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written).toHaveLength(1);
    });

    it("treats different types as separate entries", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify([
          { type: "ssh", host: "myhost", lastUsed: "2024-01-01T00:00:00.000Z" },
        ]),
      );

      addRecentHost({ type: "docker", host: "myhost" });

      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written).toHaveLength(2);
    });

    it("evicts oldest entries beyond 20", () => {
      const entries = Array.from({ length: 20 }, (_, i) => ({
        type: "ssh" as const,
        host: `host-${String(i).padStart(2, "0")}`,
        lastUsed: new Date(2024, 0, i + 1).toISOString(),
      }));
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(entries));

      addRecentHost({ type: "ssh", host: "host-new" });

      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written).toHaveLength(20);
      expect(written[0].host).toBe("host-new");
      const allHosts = written.map((h: any) => h.host);
      expect(allHosts).not.toContain("host-00");
    });

    it("handles missing recent-hosts.json gracefully on add", () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("ENOENT");
      });

      addRecentHost({ type: "docker", host: "container-1" });

      const written = JSON.parse(
        vi.mocked(fs.writeFileSync).mock.calls[0][1] as string,
      );
      expect(written).toHaveLength(1);
      expect(written[0].host).toBe("container-1");
    });
  });
});

describe("setupHostHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers all four IPC handlers", () => {
    setupHostHandlers();

    const channels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
    expect(channels).toContain("hosts:list-ssh-config");
    expect(channels).toContain("hosts:list-docker-containers");
    expect(channels).toContain("hosts:get-recent");
    expect(channels).toContain("hosts:add-recent");
  });
});
