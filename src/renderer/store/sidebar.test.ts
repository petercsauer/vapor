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
    path: `/project/${name}`,
  }));

describe("loadDir", () => {
  it("fetches entries via IPC and populates dirCache", async () => {
    const entries = makeEntries("main.ts", "utils.ts");
    (vapor.fs.readdir as any).mockResolvedValue(entries);

    const result = await useSidebarStore.getState().loadDir("/project");
    const state = useSidebarStore.getState();

    expect(vapor.fs.readdir).toHaveBeenCalledWith("/project");
    expect(state.dirCache["/project"]).toBeDefined();
    expect(state.dirCache["/project"].entries).toBe(entries);
    expect(result).toEqual(entries);
  });

  it("returns cached entries within the 30-second window", async () => {
    const entries = makeEntries("a.ts");
    (vapor.fs.readdir as any).mockResolvedValue(entries);

    await useSidebarStore.getState().loadDir("/project");
    (vapor.fs.readdir as any).mockResolvedValue(makeEntries("b.ts"));

    const result = await useSidebarStore.getState().loadDir("/project");
    expect(vapor.fs.readdir).toHaveBeenCalledTimes(1);
    expect(result).toEqual(entries);
  });

  it("re-fetches after cache expires", async () => {
    const entries = makeEntries("a.ts");
    (vapor.fs.readdir as any).mockResolvedValue(entries);
    await useSidebarStore.getState().loadDir("/project");

    useSidebarStore.setState((s) => ({
      dirCache: {
        ...s.dirCache,
        "/project": { ...s.dirCache["/project"], fetchedAt: Date.now() - 31000 },
      },
    }));

    const fresh = makeEntries("b.ts");
    (vapor.fs.readdir as any).mockResolvedValue(fresh);
    const result = await useSidebarStore.getState().loadDir("/project");
    expect(vapor.fs.readdir).toHaveBeenCalledTimes(2);
    expect(result).toEqual(fresh);
  });

  it("filters out excluded names like node_modules and .git", async () => {
    const entries: FsEntry[] = [
      { name: "src", type: "directory", path: "/project/src" },
      { name: "node_modules", type: "directory", path: "/project/node_modules" },
      { name: ".git", type: "directory", path: "/project/.git" },
      { name: "main.ts", type: "file", path: "/project/main.ts" },
    ];
    (vapor.fs.readdir as any).mockResolvedValue(entries);

    const result = await useSidebarStore.getState().loadDir("/project");
    const names = result.map((e) => e.name);
    expect(names).toContain("src");
    expect(names).toContain("main.ts");
    expect(names).not.toContain("node_modules");
    expect(names).not.toContain(".git");
  });

  it("filters out hidden (dot) files", async () => {
    const entries: FsEntry[] = [
      { name: ".env", type: "file", path: "/project/.env" },
      { name: "readme.md", type: "file", path: "/project/readme.md" },
    ];
    (vapor.fs.readdir as any).mockResolvedValue(entries);

    const result = await useSidebarStore.getState().loadDir("/project");
    expect(result.map((e) => e.name)).toEqual(["readme.md"]);
  });

  it("returns empty array on IPC error", async () => {
    (vapor.fs.readdir as any).mockRejectedValue(new Error("EACCES"));
    const result = await useSidebarStore.getState().loadDir("/forbidden");
    expect(result).toEqual([]);
  });
});

describe("toggleExpanded", () => {
  it("adds a path to expandedDirs when collapsed", () => {
    useSidebarStore.getState().toggleExpanded("/project/src");
    expect(useSidebarStore.getState().expandedDirs.has("/project/src")).toBe(true);
  });

  it("removes a path from expandedDirs when expanded", () => {
    useSidebarStore.getState().toggleExpanded("/project/src");
    useSidebarStore.getState().toggleExpanded("/project/src");
    expect(useSidebarStore.getState().expandedDirs.has("/project/src")).toBe(false);
  });
});

describe("setExpanded", () => {
  it("adds a path when expanded is true", () => {
    useSidebarStore.getState().setExpanded("/project/src", true);
    expect(useSidebarStore.getState().expandedDirs.has("/project/src")).toBe(true);
  });

  it("removes a path when expanded is false", () => {
    useSidebarStore.getState().setExpanded("/project/src", true);
    useSidebarStore.getState().setExpanded("/project/src", false);
    expect(useSidebarStore.getState().expandedDirs.has("/project/src")).toBe(false);
  });
});

describe("setPinnedPath", () => {
  it("sets the pinned path", () => {
    useSidebarStore.getState().setPinnedPath("/project");
    expect(useSidebarStore.getState().pinnedPath).toBe("/project");
  });

  it("clears the pinned path when set to null", () => {
    useSidebarStore.getState().setPinnedPath("/project");
    useSidebarStore.getState().setPinnedPath(null);
    expect(useSidebarStore.getState().pinnedPath).toBeNull();
  });
});

describe("setWidth", () => {
  it("sets width within bounds", () => {
    useSidebarStore.getState().setWidth(300);
    expect(useSidebarStore.getState().width).toBe(300);
  });

  it("clamps to minimum of 140", () => {
    useSidebarStore.getState().setWidth(50);
    expect(useSidebarStore.getState().width).toBe(140);
  });

  it("clamps to maximum of 600", () => {
    useSidebarStore.getState().setWidth(1000);
    expect(useSidebarStore.getState().width).toBe(600);
  });
});

describe("invalidateDir", () => {
  it("removes the path from dirCache", async () => {
    const entries = makeEntries("a.ts");
    (vapor.fs.readdir as any).mockResolvedValue(entries);
    await useSidebarStore.getState().loadDir("/project");
    expect(useSidebarStore.getState().dirCache["/project"]).toBeDefined();

    useSidebarStore.getState().invalidateDir("/project");
    expect(useSidebarStore.getState().dirCache["/project"]).toBeUndefined();
  });

  it("is a no-op for a path not in cache", () => {
    useSidebarStore.getState().invalidateDir("/nonexistent");
    expect(useSidebarStore.getState().dirCache).toEqual({});
  });
});

describe("expandToPath", () => {
  it("expands all ancestor directories and loads each", async () => {
    (vapor.fs.readdir as any).mockResolvedValue([]);

    await useSidebarStore.getState().expandToPath("/project", "/project/src/lib/file.ts");
    const state = useSidebarStore.getState();

    expect(state.expandedDirs.has("/project")).toBe(true);
    expect(state.expandedDirs.has("/project/src")).toBe(true);
    expect(state.expandedDirs.has("/project/src/lib")).toBe(true);
    expect(vapor.fs.readdir).toHaveBeenCalledWith("/project");
    expect(vapor.fs.readdir).toHaveBeenCalledWith("/project/src");
    expect(vapor.fs.readdir).toHaveBeenCalledWith("/project/src/lib");
  });

  it("does nothing when targetPath is not under rootPath", async () => {
    await useSidebarStore.getState().expandToPath("/project", "/other/file.ts");
    expect(useSidebarStore.getState().expandedDirs.size).toBe(0);
    expect(vapor.fs.readdir).not.toHaveBeenCalled();
  });
});
