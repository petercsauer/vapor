import { describe, it, expect, beforeEach } from "vitest";
import { useSidebarStore } from "./sidebar";
import { vapor } from "../api/vapor";
import type { FsEntry } from "../../shared/types";

beforeEach(() => {
  useSidebarStore.setState({
    width: 220,
    pinnedPath: null,
    dirCache: {},
    expandedDirs: new Set(),
    currentRemoteHost: null,
  });
});

const makeEntries = (...names: string[]): FsEntry[] =>
  names.map((name) => ({
    name,
    type: "file" as const,
    path: `/remote/${name}`,
  }));

describe("Remote host switching", () => {
  it("sets remote host", () => {
    useSidebarStore.getState().setRemoteHost("user@server.com");
    expect(useSidebarStore.getState().currentRemoteHost).toBe("user@server.com");
  });

  it("clears remote host when set to null", () => {
    useSidebarStore.getState().setRemoteHost("user@server.com");
    useSidebarStore.getState().setRemoteHost(null);
    expect(useSidebarStore.getState().currentRemoteHost).toBeNull();
  });
});

describe("Remote loadDir routing", () => {
  it("calls remote readdir when host is set", async () => {
    const entries = makeEntries("remote.txt", "config.json");
    (vapor.fs.remote.readdir as any).mockResolvedValue(entries);

    useSidebarStore.getState().setRemoteHost("user@server.com");
    const result = await useSidebarStore.getState().loadDir("/home/user/project");

    expect(vapor.fs.remote.readdir).toHaveBeenCalledWith("user@server.com", "/home/user/project");
    expect(vapor.fs.readdir).not.toHaveBeenCalled();
    expect(result).toEqual(entries);
  });

  it("calls local readdir when host is null", async () => {
    const entries = makeEntries("local.txt", "package.json");
    (vapor.fs.readdir as any).mockResolvedValue(entries);

    useSidebarStore.getState().setRemoteHost(null);
    const result = await useSidebarStore.getState().loadDir("/Users/dev/project");

    expect(vapor.fs.readdir).toHaveBeenCalledWith("/Users/dev/project");
    expect(vapor.fs.remote.readdir).not.toHaveBeenCalled();
    expect(result).toEqual(entries);
  });

  it("switches from local to remote", async () => {
    const localEntries = makeEntries("local.txt");
    const remoteEntries = makeEntries("remote.txt");
    (vapor.fs.readdir as any).mockResolvedValue(localEntries);
    (vapor.fs.remote.readdir as any).mockResolvedValue(remoteEntries);

    // Load local first
    useSidebarStore.getState().setRemoteHost(null);
    await useSidebarStore.getState().loadDir("/project");
    expect(vapor.fs.readdir).toHaveBeenCalledTimes(1);

    // Switch to remote
    useSidebarStore.getState().setRemoteHost("user@server.com");
    const result = await useSidebarStore.getState().loadDir("/project");

    expect(vapor.fs.remote.readdir).toHaveBeenCalledWith("user@server.com", "/project");
    expect(result).toEqual(remoteEntries);
  });

  it("returns empty array on remote error", async () => {
    (vapor.fs.remote.readdir as any).mockRejectedValue(new Error("SSH connection lost"));
    useSidebarStore.getState().setRemoteHost("user@server.com");

    const result = await useSidebarStore.getState().loadDir("/project");
    expect(result).toEqual([]);
  });
});

describe("Remote cache separation", () => {
  it("caches local and remote separately for same path", async () => {
    const localEntries = makeEntries("local.txt");
    const remoteEntries = makeEntries("remote.txt");
    (vapor.fs.readdir as any).mockResolvedValue(localEntries);
    (vapor.fs.remote.readdir as any).mockResolvedValue(remoteEntries);

    // Load local
    useSidebarStore.getState().setRemoteHost(null);
    const localResult = await useSidebarStore.getState().loadDir("/project");
    expect(localResult).toEqual(localEntries);

    // Verify local is cached
    expect(useSidebarStore.getState().dirCache["/project"]).toBeDefined();
    expect(useSidebarStore.getState().dirCache["/project"].entries).toEqual(localEntries);

    // Switch to remote (clears cache) and load
    useSidebarStore.getState().setRemoteHost("user@server.com");
    const remoteResult = await useSidebarStore.getState().loadDir("/project");
    expect(remoteResult).toEqual(remoteEntries);

    // Only remote cache should exist (host switch clears cache)
    const state = useSidebarStore.getState();
    expect(state.dirCache["user@server.com:/project"]).toBeDefined();
    expect(state.dirCache["user@server.com:/project"].entries).toEqual(remoteEntries);
  });

  it("uses cached remote data within 30s window", async () => {
    const entries = makeEntries("remote.txt");
    (vapor.fs.remote.readdir as any).mockResolvedValue(entries);

    useSidebarStore.getState().setRemoteHost("user@server.com");
    await useSidebarStore.getState().loadDir("/project");

    // Second load should use cache
    (vapor.fs.remote.readdir as any).mockResolvedValue(makeEntries("different.txt"));
    const result = await useSidebarStore.getState().loadDir("/project");

    expect(vapor.fs.remote.readdir).toHaveBeenCalledTimes(1);
    expect(result).toEqual(entries);
  });

  it("invalidates correct remote cache", async () => {
    const entries = makeEntries("remote.txt");
    (vapor.fs.remote.readdir as any).mockResolvedValue(entries);

    useSidebarStore.getState().setRemoteHost("user@server.com");
    await useSidebarStore.getState().loadDir("/project");

    const state = useSidebarStore.getState();
    expect(state.dirCache["user@server.com:/project"]).toBeDefined();

    useSidebarStore.getState().invalidateDir("/project");
    expect(useSidebarStore.getState().dirCache["user@server.com:/project"]).toBeUndefined();
  });

  it("invalidates only remote cache when remote is active", async () => {
    const remoteEntries = makeEntries("remote.txt");
    (vapor.fs.remote.readdir as any).mockResolvedValue(remoteEntries);

    // Switch to remote and load
    useSidebarStore.getState().setRemoteHost("user@server.com");
    await useSidebarStore.getState().loadDir("/project");

    // Verify remote cache exists
    expect(useSidebarStore.getState().dirCache["user@server.com:/project"]).toBeDefined();

    // Invalidate while remote
    useSidebarStore.getState().invalidateDir("/project");

    // Remote cache should be cleared
    const state = useSidebarStore.getState();
    expect(state.dirCache["user@server.com:/project"]).toBeUndefined();
  });
});

describe("Remote expandToPath", () => {
  it("expands remote paths correctly", async () => {
    (vapor.fs.remote.readdir as any).mockResolvedValue([]);
    useSidebarStore.getState().setRemoteHost("user@server.com");

    await useSidebarStore.getState().expandToPath("/home/user", "/home/user/src/lib/file.ts");
    const state = useSidebarStore.getState();

    expect(state.expandedDirs.has("/home/user")).toBe(true);
    expect(state.expandedDirs.has("/home/user/src")).toBe(true);
    expect(state.expandedDirs.has("/home/user/src/lib")).toBe(true);
    expect(vapor.fs.remote.readdir).toHaveBeenCalledWith("user@server.com", "/home/user");
    expect(vapor.fs.remote.readdir).toHaveBeenCalledWith("user@server.com", "/home/user/src");
    expect(vapor.fs.remote.readdir).toHaveBeenCalledWith("user@server.com", "/home/user/src/lib");
  });
});
