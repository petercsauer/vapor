import React, { useCallback, useEffect, useState, useRef } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { createPortal } from "react-dom";
import { useSidebarStore } from "../store/sidebar";
import { useTabPaneStore } from "../store/tabs";
import { useEditorStore } from "../store/editor";
import { FileTypeIcon } from "./FileIcon";
import {
  FileTreeContextMenu,
  type ContextMenuEntry,
} from "./FileTreeContextMenu";
import { vapor } from "../api/vapor";
import type { FsEntry } from "../../shared/types";

interface FileTreeProps {
  rootPath: string;
  highlightPath: string | null;
}

interface TreeNodeProps {
  entry: FsEntry;
  depth: number;
  highlightPath: string | null;
  rootPath: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  entry: FsEntry;
  parentDir: string;
}

function InlineRename({
  initialName,
  onCommit,
  onCancel,
}: {
  initialName: string;
  onCommit: (newName: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const dot = initialName.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : initialName.length);
  }, [initialName]);

  const commit = () => {
    const val = inputRef.current?.value.trim();
    if (val && val !== initialName) onCommit(val);
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      defaultValue={initialName}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onCancel();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        flex: 1,
        height: 18,
        fontSize: 12,
        padding: "0 4px",
        color: "var(--text-primary)",
        background: "var(--bg-input)",
        border: "1px solid var(--accent-outline)",
        borderRadius: 3,
        outline: "none",
        minWidth: 0,
      }}
    />
  );
}

function InlineNewItem({
  onCommit,
  onCancel,
}: {
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const commit = () => {
    const val = inputRef.current?.value.trim();
    if (val) onCommit(val);
    else onCancel();
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 24,
        paddingRight: 8,
        gap: 4,
      }}
    >
      <input
        ref={inputRef}
        placeholder="name…"
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onCancel();
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          height: 18,
          fontSize: 12,
          padding: "0 4px",
          color: "var(--text-primary)",
          background: "var(--bg-input)",
          border: "1px solid var(--accent-outline)",
          borderRadius: 3,
          outline: "none",
          minWidth: 0,
        }}
      />
    </div>
  );
}

const TreeNode = React.memo(function TreeNode({
  entry,
  depth,
  highlightPath,
  rootPath,
}: TreeNodeProps) {
  const expandedDirs = useSidebarStore((s) => s.expandedDirs);
  const toggleExpanded = useSidebarStore((s) => s.toggleExpanded);
  const loadDir = useSidebarStore((s) => s.loadDir);
  const currentRemoteHost = useSidebarStore((s) => s.currentRemoteHost);
  const openEditorPane = useTabPaneStore((s) => s.openEditorPane);

  const isDir = entry.type === "directory";
  const isExpanded = expandedDirs.has(entry.path);
  const isHighlighted = highlightPath === entry.path;
  const [children, setChildren] = useState<FsEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const [newItem, setNewItem] = useState<"file" | "folder" | null>(null);

  useEffect(() => {
    if (isDir && isExpanded && !loaded) {
      loadDir(entry.path).then((entries) => {
        setChildren(entries);
        setLoaded(true);
      });
    }
  }, [isDir, isExpanded, loaded, entry.path, loadDir]);

  useEffect(() => {
    if (isDir && isExpanded && loaded) {
      loadDir(entry.path).then(setChildren);
    }
  }, [isExpanded]);

  const handleClick = useCallback(() => {
    if (renaming) return;
    if (isDir) {
      toggleExpanded(entry.path);
    } else {
      const remoteHost = useSidebarStore.getState().currentRemoteHost;
      useEditorStore.getState().openFile(entry.path, remoteHost)
        .catch((err) => console.error("Failed to open file:", err));
      openEditorPane(entry.path);
    }
  }, [isDir, entry.path, toggleExpanded, openEditorPane, renaming]);

  const handleRenameCommit = useCallback(
    async (newName: string) => {
      const dir = entry.path.substring(0, entry.path.lastIndexOf("/"));
      const newPath = dir + "/" + newName;
      try {
        if (currentRemoteHost) {
          await vapor.fs.remote.rename(currentRemoteHost, entry.path, newPath);
        } else {
          await vapor.fs.rename(entry.path, newPath);
        }
      } catch (err) {
        console.warn("[FileTree] Operation failed:", err);
      }
      setRenaming(false);
    },
    [entry.path, currentRemoteHost],
  );

  const handleNewItemCommit = useCallback(
    async (name: string) => {
      const fullPath = entry.path + "/" + name;
      try {
        if (currentRemoteHost) {
          if (newItem === "folder") {
            await vapor.fs.remote.mkdir(currentRemoteHost, fullPath);
          } else {
            await vapor.fs.remote.writeFile(currentRemoteHost, fullPath, "");
          }
        } else {
          if (newItem === "folder") {
            await vapor.fs.mkdir(fullPath);
          } else {
            await vapor.fs.writeFile(fullPath, "");
          }
        }
        useSidebarStore.getState().invalidateDir(entry.path);
        loadDir(entry.path).then(setChildren);
      } catch (err) {
        console.warn("[FileTree] Operation failed:", err);
      }
      setNewItem(null);
    },
    [entry.path, newItem, loadDir, currentRemoteHost],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isDir || currentRemoteHost) return;
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropHover(true);
      }
    },
    [isDir, currentRemoteHost],
  );

  const handleDragLeave = useCallback(() => setDropHover(false), []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDropHover(false);
      if (!isDir || currentRemoteHost) return;

      const files = e.dataTransfer.files;
      if (!files.length) return;

      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i] as File & { path?: string };
        if (f.path) paths.push(f.path);
      }

      if (paths.length > 0) {
        try {
          await vapor.fs.copyTo(paths, entry.path);
          useSidebarStore.getState().invalidateDir(entry.path);
          loadDir(entry.path).then(setChildren);
          if (!isExpanded) toggleExpanded(entry.path);
        } catch (err) {
          console.warn("[FileTree] Operation failed:", err);
        }
      }
    },
    [isDir, entry.path, isExpanded, toggleExpanded, loadDir, currentRemoteHost],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const event = new CustomEvent("filetree-context", {
        bubbles: true,
        detail: { x: e.clientX, y: e.clientY, entry, rootPath },
      });
      e.currentTarget.dispatchEvent(event);
    },
    [entry, rootPath],
  );

  // Expose setRenaming / setNewItem via custom event responses
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.path !== entry.path) return;
      if (ce.detail?.action === "rename") setRenaming(true);
      if (ce.detail?.action === "newFile" && isDir) {
        if (!isExpanded) toggleExpanded(entry.path);
        setNewItem("file");
      }
      if (ce.detail?.action === "newFolder" && isDir) {
        if (!isExpanded) toggleExpanded(entry.path);
        setNewItem("folder");
      }
    };
    window.addEventListener("filetree-action", handler);
    return () => window.removeEventListener("filetree-action", handler);
  }, [entry.path, isDir, isExpanded, toggleExpanded]);

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          display: "flex",
          alignItems: "center",
          height: 24,
          paddingLeft: depth * 16 + 4,
          paddingRight: 8,
          cursor: "default",
          fontSize: 12,
          color: "var(--text-secondary)",
          background: dropHover
            ? "var(--accent-bg)"
            : isHighlighted
              ? "var(--accent-bg)"
              : hovered
                ? "var(--bg-hover)"
                : "transparent",
          borderLeft: dropHover
            ? "2px solid var(--accent-border)"
            : isHighlighted
              ? "2px solid var(--accent-outline-dim)"
              : "2px solid transparent",
          transition: "background 0.1s",
          userSelect: "none",
          gap: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {isDir && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.12s ease",
            }}
          >
            <ChevronRight size={10} />
          </span>
        )}
        {!isDir && <span style={{ width: 10, flexShrink: 0 }} />}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            color: "var(--text-muted)",
          }}
        >
          {isDir ? (
            isExpanded ? (
              <FolderOpen size={14} />
            ) : (
              <Folder size={14} />
            )
          ) : (
            <FileTypeIcon fileName={entry.name} size={14} />
          )}
        </span>
        {renaming ? (
          <InlineRename
            initialName={entry.name}
            onCommit={handleRenameCommit}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {entry.name}
          </span>
        )}
      </div>
      {isDir && isExpanded && newItem && (
        <div style={{ paddingLeft: (depth + 1) * 16 + 4 }}>
          <InlineNewItem
            onCommit={handleNewItemCommit}
            onCancel={() => setNewItem(null)}
          />
        </div>
      )}
      {isDir &&
        isExpanded &&
        children.map((child) => (
          <TreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            highlightPath={highlightPath}
            rootPath={rootPath}
          />
        ))}
    </>
  );
});

export const FileTree = React.memo(function FileTree({
  rootPath,
  highlightPath,
}: FileTreeProps) {
  const loadDir = useSidebarStore((s) => s.loadDir);
  const currentRemoteHost = useSidebarStore((s) => s.currentRemoteHost);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const lastRoot = useRef<string>("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rootPath && rootPath !== lastRoot.current) {
      lastRoot.current = rootPath;
      loadDir(rootPath).then(setEntries);
    }
  }, [rootPath, loadDir]);

  useEffect(() => {
    if (!rootPath) return;
    const cleanup = vapor.fs.onChanged((event) => {
      const { invalidateDir } = useSidebarStore.getState();
      invalidateDir(event.dir);
      if (event.dir === rootPath) {
        loadDir(rootPath).then(setEntries);
      }
    });
    vapor.fs.watch(rootPath);
    return () => {
      cleanup();
      vapor.fs.watch("");
    };
  }, [rootPath, loadDir]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const { x, y, entry } = ce.detail;
      const parentDir = entry.path.substring(0, entry.path.lastIndexOf("/"));
      setContextMenu({ x, y, entry, parentDir });
    };
    el.addEventListener("filetree-context", handler);
    return () => el.removeEventListener("filetree-context", handler);
  }, []);

  const buildMenuItems = useCallback(
    (state: ContextMenuState): ContextMenuEntry[] => {
      const { entry, parentDir } = state;
      const isDir = entry.type === "directory";
      const isRemote = currentRemoteHost !== null;
      const items: ContextMenuEntry[] = [];

      if (!isDir) {
        items.push({
          label: "Open",
          action: () => {
            const remoteHost = useSidebarStore.getState().currentRemoteHost;
            useEditorStore.getState().openFile(entry.path, remoteHost)
              .catch((err) => console.error("Failed to open file:", err));
            useTabPaneStore.getState().openEditorPane(entry.path);
          },
        });
        if (!isRemote) {
          items.push({
            label: "Open with Default App",
            action: () => vapor.fs.openPath(entry.path),
          });
        }
      }

      if (!isRemote) {
        items.push({
          label: "Reveal in Finder",
          action: () => vapor.fs.showInFolder(entry.path),
        });
      }

      items.push({ separator: true });

      items.push({
        label: "Copy Path",
        action: () => vapor.fs.clipboardCopyPath(entry.path),
      });

      if (rootPath) {
        const relative = entry.path.startsWith(rootPath + "/")
          ? entry.path.slice(rootPath.length + 1)
          : entry.name;
        items.push({
          label: "Copy Relative Path",
          action: () => vapor.fs.clipboardCopyPath(relative),
        });
      }

      items.push({ separator: true });

      if (isDir) {
        items.push({
          label: "New File…",
          action: () => {
            window.dispatchEvent(
              new CustomEvent("filetree-action", {
                detail: { path: entry.path, action: "newFile" },
              }),
            );
          },
        });
        items.push({
          label: "New Folder…",
          action: () => {
            window.dispatchEvent(
              new CustomEvent("filetree-action", {
                detail: { path: entry.path, action: "newFolder" },
              }),
            );
          },
        });
        items.push({ separator: true });
      }

      items.push({
        label: "Rename…",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("filetree-action", {
              detail: { path: entry.path, action: "rename" },
            }),
          );
        },
      });

      items.push({
        label: isRemote ? "Delete" : "Move to Trash",
        danger: true,
        action: async () => {
          try {
            if (isRemote && currentRemoteHost) {
              await vapor.fs.remote.delete(currentRemoteHost, entry.path);
            } else {
              await vapor.fs.delete(entry.path);
            }
            useSidebarStore.getState().invalidateDir(parentDir);
            if (parentDir === rootPath) {
              loadDir(rootPath).then(setEntries);
            }
          } catch (err) {
            console.warn("[FileTree] Operation failed:", err);
          }
        },
      });

      return items;
    },
    [rootPath, loadDir, currentRemoteHost],
  );

  const [rootDropHover, setRootDropHover] = useState(false);

  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!rootPath || currentRemoteHost) return;
      if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setRootDropHover(true);
      }
    },
    [rootPath, currentRemoteHost],
  );

  const handleRootDragLeave = useCallback(() => setRootDropHover(false), []);

  const handleRootDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setRootDropHover(false);
      if (!rootPath || currentRemoteHost) return;

      const files = e.dataTransfer.files;
      if (!files.length) return;

      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i] as File & { path?: string };
        if (f.path) paths.push(f.path);
      }

      if (paths.length > 0) {
        try {
          await vapor.fs.copyTo(paths, rootPath);
          useSidebarStore.getState().invalidateDir(rootPath);
          loadDir(rootPath).then(setEntries);
        } catch (err) {
          console.warn("[FileTree] Operation failed:", err);
        }
      }
    },
    [rootPath, loadDir, currentRemoteHost],
  );

  if (!rootPath) {
    return (
      <div
        style={{
          padding: 16,
          fontSize: 12,
          color: "var(--text-dim)",
          textAlign: "center",
        }}
      >
        No folder open
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
        style={{
          overflowY: "auto",
          overflowX: "hidden",
          flex: 1,
          outline: rootDropHover
            ? "2px dashed var(--accent-outline)"
            : "2px dashed transparent",
          outlineOffset: -2,
          borderRadius: 4,
          transition: "outline-color 0.15s",
        }}
      >
        {entries.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            highlightPath={highlightPath}
            rootPath={rootPath}
          />
        ))}
      </div>
      {contextMenu &&
        createPortal(
          <FileTreeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            items={buildMenuItems(contextMenu)}
            onClose={() => setContextMenu(null)}
          />,
          document.body,
        )}
    </>
  );
});
