import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEditorStore, fileKey, parseFileKey } from "./editor";
import { vapor } from "../api/vapor";

beforeEach(() => {
  useEditorStore.setState({
    openFiles: {},
    tabOrder: [],
    activeFile: null,
  });
});

describe("openFile", () => {
  it("reads the file via IPC and adds it to openFiles", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("hello world");

    const result = await useEditorStore.getState().openFile("/tmp/test.ts");
    const state = useEditorStore.getState();

    expect(vapor.fs.readFile).toHaveBeenCalledWith("/tmp/test.ts");
    expect(result).toEqual({
      path: "/tmp/test.ts",
      content: "hello world",
      dirty: false,
      language: "typescript",
    });
    expect(state.openFiles["/tmp/test.ts"]).toEqual(result);
    expect(state.activeFile).toBe("/tmp/test.ts");
    expect(state.tabOrder).toContain("/tmp/test.ts");
  });

  it("does not duplicate when opening the same file twice", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("content");

    await useEditorStore.getState().openFile("/tmp/a.ts");
    const firstFile = useEditorStore.getState().openFiles["/tmp/a.ts"];

    (vapor.fs.readFile as any).mockResolvedValue("new content");
    const result = await useEditorStore.getState().openFile("/tmp/a.ts");

    expect(result).toBe(firstFile);
    expect(vapor.fs.readFile).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().tabOrder.filter((p) => p === "/tmp/a.ts")).toHaveLength(1);
  });

  it("sets activeFile even when file is already open", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("a");
    await useEditorStore.getState().openFile("/tmp/a.ts");

    (vapor.fs.readFile as any).mockResolvedValue("b");
    await useEditorStore.getState().openFile("/tmp/b.ts");
    expect(useEditorStore.getState().activeFile).toBe("/tmp/b.ts");

    await useEditorStore.getState().openFile("/tmp/a.ts");
    expect(useEditorStore.getState().activeFile).toBe("/tmp/a.ts");
  });
});

describe("closeTab", () => {
  it("removes the file and switches activeFile to neighbor", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("x");
    await useEditorStore.getState().openFile("/tmp/a.ts");
    await useEditorStore.getState().openFile("/tmp/b.ts");
    await useEditorStore.getState().openFile("/tmp/c.ts");
    useEditorStore.getState().activateFile("/tmp/b.ts");

    useEditorStore.getState().closeTab("/tmp/b.ts");
    const state = useEditorStore.getState();

    expect(state.openFiles["/tmp/b.ts"]).toBeUndefined();
    expect(state.tabOrder).not.toContain("/tmp/b.ts");
    expect(state.activeFile).toBe("/tmp/c.ts");
  });

  it("sets activeFile to null when closing the last tab", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("x");
    await useEditorStore.getState().openFile("/tmp/a.ts");

    useEditorStore.getState().closeTab("/tmp/a.ts");
    const state = useEditorStore.getState();

    expect(state.activeFile).toBeNull();
    expect(state.tabOrder).toHaveLength(0);
    expect(Object.keys(state.openFiles)).toHaveLength(0);
  });

  it("does not change activeFile when closing a non-active tab", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("x");
    await useEditorStore.getState().openFile("/tmp/a.ts");
    await useEditorStore.getState().openFile("/tmp/b.ts");
    useEditorStore.getState().activateFile("/tmp/a.ts");

    useEditorStore.getState().closeTab("/tmp/b.ts");
    expect(useEditorStore.getState().activeFile).toBe("/tmp/a.ts");
  });
});

describe("closeFile", () => {
  it("removes the file and picks the first remaining tab as active", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("x");
    await useEditorStore.getState().openFile("/tmp/a.ts");
    await useEditorStore.getState().openFile("/tmp/b.ts");

    useEditorStore.getState().closeFile("/tmp/b.ts");
    const state = useEditorStore.getState();

    expect(state.openFiles["/tmp/b.ts"]).toBeUndefined();
    expect(state.activeFile).toBe("/tmp/a.ts");
  });
});

describe("saveFile", () => {
  it("writes content via IPC and clears dirty flag", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("original");
    (vapor.fs.writeFile as any).mockResolvedValue(undefined);

    await useEditorStore.getState().openFile("/tmp/a.ts");
    useEditorStore.getState().setContent("/tmp/a.ts", "modified");
    expect(useEditorStore.getState().openFiles["/tmp/a.ts"].dirty).toBe(true);

    await useEditorStore.getState().saveFile("/tmp/a.ts");

    expect(vapor.fs.writeFile).toHaveBeenCalledWith("/tmp/a.ts", "modified");
    expect(useEditorStore.getState().openFiles["/tmp/a.ts"].dirty).toBe(false);
  });

  it("does nothing when file is not open", async () => {
    (vapor.fs.writeFile as any).mockResolvedValue(undefined);
    await useEditorStore.getState().saveFile("/tmp/nonexistent.ts");
    expect(vapor.fs.writeFile).not.toHaveBeenCalled();
  });
});

describe("setContent", () => {
  it("updates content and marks file dirty", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("original");
    await useEditorStore.getState().openFile("/tmp/a.ts");

    useEditorStore.getState().setContent("/tmp/a.ts", "changed");
    const file = useEditorStore.getState().openFiles["/tmp/a.ts"];

    expect(file.content).toBe("changed");
    expect(file.dirty).toBe(true);
  });

  it("is a no-op for a file that is not open", () => {
    const before = useEditorStore.getState();
    useEditorStore.getState().setContent("/tmp/missing.ts", "data");
    expect(useEditorStore.getState()).toBe(before);
  });
});

describe("setDirty", () => {
  it("sets the dirty flag on an open file", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("content");
    await useEditorStore.getState().openFile("/tmp/a.ts");

    useEditorStore.getState().setDirty("/tmp/a.ts", true);
    expect(useEditorStore.getState().openFiles["/tmp/a.ts"].dirty).toBe(true);

    useEditorStore.getState().setDirty("/tmp/a.ts", false);
    expect(useEditorStore.getState().openFiles["/tmp/a.ts"].dirty).toBe(false);
  });
});

describe("activateFile", () => {
  it("sets the active file", () => {
    useEditorStore.getState().activateFile("/tmp/a.ts");
    expect(useEditorStore.getState().activeFile).toBe("/tmp/a.ts");
  });
});

describe("reloadFile", () => {
  it("re-reads the file and clears dirty", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("original");
    await useEditorStore.getState().openFile("/tmp/a.ts");
    useEditorStore.getState().setContent("/tmp/a.ts", "edited");

    (vapor.fs.readFile as any).mockResolvedValue("from disk");
    await useEditorStore.getState().reloadFile("/tmp/a.ts");

    const file = useEditorStore.getState().openFiles["/tmp/a.ts"];
    expect(file.content).toBe("from disk");
    expect(file.dirty).toBe(false);
  });

  it("silently handles errors when file was deleted", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("content");
    await useEditorStore.getState().openFile("/tmp/a.ts");

    (vapor.fs.readFile as any).mockRejectedValue(new Error("ENOENT"));
    await useEditorStore.getState().reloadFile("/tmp/a.ts");

    expect(useEditorStore.getState().openFiles["/tmp/a.ts"].content).toBe("content");
  });
});

describe("language detection", () => {
  const cases: [string, string][] = [
    ["/test.ts", "typescript"],
    ["/test.tsx", "typescript"],
    ["/test.js", "javascript"],
    ["/test.jsx", "javascript"],
    ["/test.py", "python"],
    ["/test.md", "markdown"],
    ["/test.json", "json"],
    ["/test.html", "html"],
    ["/test.css", "css"],
    ["/test.go", "go"],
    ["/test.rs", "rust"],
    ["/test.java", "java"],
    ["/test.sh", "shell"],
    ["/test.yaml", "yaml"],
    ["/test.sql", "sql"],
    ["/test.unknown", "plaintext"],
    ["/noext", "plaintext"],
  ];

  it.each(cases)("detects %s as %s", async (filePath, expectedLang) => {
    (vapor.fs.readFile as any).mockResolvedValue("");
    const result = await useEditorStore.getState().openFile(filePath);
    expect(result.language).toBe(expectedLang);
  });
});

describe("fileKey / parseFileKey", () => {
  it("returns plain path for local files", () => {
    expect(fileKey("/home/user/file.txt")).toBe("/home/user/file.txt");
    expect(fileKey("/home/user/file.txt", null)).toBe("/home/user/file.txt");
    expect(fileKey("/home/user/file.txt", undefined)).toBe("/home/user/file.txt");
  });

  it("returns host:path for remote files", () => {
    expect(fileKey("/home/user/file.txt", "myhost")).toBe("myhost:/home/user/file.txt");
  });

  it("parses local keys", () => {
    expect(parseFileKey("/home/user/file.txt")).toEqual({
      path: "/home/user/file.txt",
      remoteHost: null,
    });
  });

  it("parses remote keys", () => {
    expect(parseFileKey("myhost:/home/user/file.txt")).toEqual({
      path: "/home/user/file.txt",
      remoteHost: "myhost",
    });
  });
});

describe("openFile error handling", () => {
  it("rolls back state when readFile rejects", async () => {
    (vapor.fs.readFile as any).mockResolvedValueOnce("content-a");
    await useEditorStore.getState().openFile("/tmp/a.ts");
    expect(useEditorStore.getState().activeFile).toBe("/tmp/a.ts");

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    (vapor.fs.readFile as any).mockRejectedValueOnce(new Error("ENOENT"));
    const result = await useEditorStore.getState().openFile("/tmp/fail.ts");

    expect(result).toBeNull();
    const state = useEditorStore.getState();
    expect(state.tabOrder).not.toContain("/tmp/fail.ts");
    expect(state.activeFile).toBe("/tmp/a.ts");
    expect(state.openFiles["/tmp/fail.ts"]).toBeUndefined();
    spy.mockRestore();
  });

  it("rolls back to null activeFile when no file was previously open", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    (vapor.fs.readFile as any).mockRejectedValueOnce(new Error("ENOENT"));
    const result = await useEditorStore.getState().openFile("/tmp/fail.ts");

    expect(result).toBeNull();
    const state = useEditorStore.getState();
    expect(state.tabOrder).toHaveLength(0);
    expect(state.activeFile).toBeNull();
    spy.mockRestore();
  });

  it("rolls back on remote host readFile failure", async () => {
    (vapor.fs.readFile as any).mockResolvedValueOnce("local-content");
    await useEditorStore.getState().openFile("/tmp/local.ts");

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    (vapor.fs.remote.readFile as any).mockRejectedValueOnce(new Error("SSH error"));
    const result = await useEditorStore.getState().openFile("/home/user/fail.ts", "myhost");

    expect(result).toBeNull();
    const state = useEditorStore.getState();
    expect(state.tabOrder).not.toContain("myhost:/home/user/fail.ts");
    expect(state.activeFile).toBe("/tmp/local.ts");
    expect(state.openFiles["myhost:/home/user/fail.ts"]).toBeUndefined();
    spy.mockRestore();
  });
});

describe("remote file operations", () => {
  it("reads via remote FS API when remoteHost is provided", async () => {
    (vapor.fs.remote.readFile as any).mockResolvedValue("remote content");

    const result = await useEditorStore.getState().openFile("/home/user/file.ts", "myhost");
    const state = useEditorStore.getState();

    expect(vapor.fs.remote.readFile).toHaveBeenCalledWith("myhost", "/home/user/file.ts");
    expect(vapor.fs.readFile).not.toHaveBeenCalled();
    expect(result).toEqual({
      path: "/home/user/file.ts",
      content: "remote content",
      dirty: false,
      language: "typescript",
      remoteHost: "myhost",
    });
    expect(state.activeFile).toBe("myhost:/home/user/file.ts");
    expect(state.tabOrder).toContain("myhost:/home/user/file.ts");
    expect(state.openFiles["myhost:/home/user/file.ts"]).toEqual(result);
  });

  it("separates cache keys for local and remote files at the same path", async () => {
    (vapor.fs.readFile as any).mockResolvedValue("local content");
    (vapor.fs.remote.readFile as any).mockResolvedValue("remote content");

    await useEditorStore.getState().openFile("/home/user/file.ts");
    await useEditorStore.getState().openFile("/home/user/file.ts", "myhost");

    const state = useEditorStore.getState();
    expect(state.openFiles["/home/user/file.ts"]?.content).toBe("local content");
    expect(state.openFiles["myhost:/home/user/file.ts"]?.content).toBe("remote content");
    expect(state.tabOrder).toHaveLength(2);
  });

  it("saves remote files via remote FS API", async () => {
    (vapor.fs.remote.readFile as any).mockResolvedValue("original");
    (vapor.fs.remote.writeFile as any).mockResolvedValue(undefined);

    await useEditorStore.getState().openFile("/home/user/file.ts", "myhost");
    useEditorStore.getState().setContent("myhost:/home/user/file.ts", "modified");

    await useEditorStore.getState().saveFile("myhost:/home/user/file.ts");

    expect(vapor.fs.remote.writeFile).toHaveBeenCalledWith("myhost", "/home/user/file.ts", "modified");
    expect(vapor.fs.writeFile).not.toHaveBeenCalled();
    expect(useEditorStore.getState().openFiles["myhost:/home/user/file.ts"].dirty).toBe(false);
  });

  it("reloads remote files via remote FS API", async () => {
    (vapor.fs.remote.readFile as any).mockResolvedValue("original");
    await useEditorStore.getState().openFile("/home/user/file.ts", "myhost");

    (vapor.fs.remote.readFile as any).mockResolvedValue("updated");
    await useEditorStore.getState().reloadFile("myhost:/home/user/file.ts");

    expect(vapor.fs.remote.readFile).toHaveBeenCalledWith("myhost", "/home/user/file.ts");
    expect(useEditorStore.getState().openFiles["myhost:/home/user/file.ts"].content).toBe("updated");
  });
});
