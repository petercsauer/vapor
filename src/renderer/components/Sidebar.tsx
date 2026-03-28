import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import {
  FolderOpen,
  PanelLeftClose,
  PinOff,
  RefreshCw,
} from "lucide-react";
import { useSidebarStore } from "../store/sidebar";
import { useTabPaneStore } from "../store/tabs";
import { findNode, collectSessionIds } from "../store/panes";
import { FileTree } from "./FileTree";
import { vapor } from "../api/vapor";

export const Sidebar = React.memo(function Sidebar() {
  const width = useSidebarStore((s) => s.width);
  const pinnedPath = useSidebarStore((s) => s.pinnedPath);
  const setWidth = useSidebarStore((s) => s.setWidth);
  const setPinnedPath = useSidebarStore((s) => s.setPinnedPath);
  const expandToPath = useSidebarStore((s) => s.expandToPath);
  const setRemoteHost = useSidebarStore((s) => s.setRemoteHost);

  const activeTabId = useTabPaneStore((s) => s.activeTabId);
  const tabs = useTabPaneStore((s) => s.tabs);
  const visible = useTabPaneStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.sidebarVisible ?? false;
  });
  const paneCwds = useTabPaneStore((s) => s.paneCwds);
  const paneGitRoots = useTabPaneStore((s) => s.paneGitRoots);
  const paneRemoteCwds = useTabPaneStore((s) => s.paneRemoteCwds);
  const sessionStates = useTabPaneStore((s) => s.sessionStates);
  const sshHosts = useTabPaneStore((s) => s.sshHosts);
  const containerNames = useTabPaneStore((s) => s.containerNames);

  const focusedSessionId = useMemo(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return null;
    const focused = findNode(tab.paneRoot, tab.focusedPaneId);
    if (focused?.type === "terminal") return focused.sessionId;
    const sids = collectSessionIds(tab.paneRoot);
    return sids[0] ?? null;
  }, [tabs, activeTabId]);

  const currentTarget = useMemo(() => {
    if (focusedSessionId) {
      const state = sessionStates[focusedSessionId];
      if (state?.target && state.target.type !== "local") return state.target;
    }
    const sshHost = sshHosts[activeTabId];
    if (sshHost) return { type: "ssh" as const, host: sshHost, cwd: "", user: undefined };
    const container = containerNames[activeTabId];
    if (container) return { type: "docker" as const, host: container, cwd: "", user: undefined };
    return null;
  }, [focusedSessionId, sessionStates, activeTabId, sshHosts, containerNames]);

  const focusedCwd = useMemo(() => {
    if (!focusedSessionId) return null;
    const state = sessionStates[focusedSessionId];
    if (state?.target && state.target.type !== "local" && state.target.cwd) {
      return state.target.cwd;
    }
    if (currentTarget) {
      const remoteCwd = paneRemoteCwds[focusedSessionId];
      return remoteCwd || "~";
    }
    return paneCwds[focusedSessionId] ?? null;
  }, [focusedSessionId, paneCwds, paneRemoteCwds, sessionStates, currentTarget]);

  const focusedGitRoot = useMemo(() => {
    if (currentTarget) return null;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return null;
    const focused = findNode(tab.paneRoot, tab.focusedPaneId);
    if (!focused || focused.type !== "terminal") {
      const sids = collectSessionIds(tab.paneRoot);
      if (sids.length === 0) return null;
      return paneGitRoots[sids[0]] ?? null;
    }
    return paneGitRoots[focused.sessionId] ?? null;
  }, [tabs, activeTabId, paneGitRoots, currentTarget]);

  const effectiveRoot = pinnedPath ?? focusedGitRoot ?? focusedCwd ?? null;
  const highlightPath = focusedCwd;

  useLayoutEffect(() => {
    setRemoteHost(currentTarget?.host ?? null);
  }, [currentTarget, setRemoteHost]);

  // Debounced auto-expand to CWD
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!effectiveRoot || !focusedCwd || !focusedCwd.startsWith(effectiveRoot)) return;
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    expandTimerRef.current = setTimeout(() => {
      expandToPath(effectiveRoot, focusedCwd);
    }, 200);
    return () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    };
  }, [effectiveRoot, focusedCwd, expandToPath]);

  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(false);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = true;
      setDragging(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        setWidth(ev.clientX);
      };
      const onUp = () => {
        dragRef.current = false;
        setDragging(false);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [setWidth],
  );

  const handleOpenFolder = useCallback(async () => {
    const folder = await vapor.fs.openFolder();
    if (folder) setPinnedPath(folder);
  }, [setPinnedPath]);

  const handleRefresh = useCallback(() => {
    if (effectiveRoot) {
      const { invalidateDir, loadDir } = useSidebarStore.getState();
      invalidateDir(effectiveRoot);
      loadDir(effectiveRoot);
    }
  }, [effectiveRoot]);

  const handleUnpin = useCallback(() => {
    setPinnedPath(null);
  }, [setPinnedPath]);

  if (!visible) return null;

  const rootName = currentTarget
    ? currentTarget.host.split("@").pop() || currentTarget.host
    : effectiveRoot
      ? effectiveRoot.split("/").pop()
      : "Explorer";

  return (
    <div
      style={{
        width,
        minWidth: 140,
        maxWidth: 600,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--border-subtle)",
        background: "transparent",
        flexShrink: 0,
        position: "relative",
      }}
    >
      <div
        style={{
          height: 32,
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          gap: 4,
          flexShrink: 0,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          overflow: "hidden",
        }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {rootName}
          </span>
          {currentTarget && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: 0.3,
                lineHeight: "12px",
                display: "inline-flex",
                alignItems: "center",
                height: 14,
                color: currentTarget.type === "ssh" ? "var(--ssh-text)" : "var(--container-text)",
                background: currentTarget.type === "ssh" ? "var(--ssh-bg)" : "var(--container-bg)",
                border: `1px solid ${currentTarget.type === "ssh" ? "var(--ssh-border)" : "var(--container-border)"}`,
                borderRadius: 3,
                padding: "0 4px",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {currentTarget.type === "ssh" ? "SSH" : "DOCKER"}
            </span>
          )}
        </div>
        {pinnedPath && (
          <button className="icon-button" title="Unpin folder" onClick={handleUnpin}
            style={{ width: 22, height: 22 }}>
            <PinOff size={14} />
          </button>
        )}
        <button className="icon-button" title="Open Folder" onClick={handleOpenFolder}
          style={{ width: 22, height: 22 }}>
          <FolderOpen size={14} />
        </button>
        <button className="icon-button" title="Refresh" onClick={handleRefresh}
          style={{ width: 22, height: 22 }}>
          <RefreshCw size={14} />
        </button>
        <button className="icon-button" title="Collapse sidebar"
          aria-label="Collapse sidebar"
          onClick={() => useTabPaneStore.getState().toggleSidebar()}
          style={{ width: 22, height: 22 }}>
          <PanelLeftClose size={14} />
        </button>
      </div>

      <FileTree key={currentTarget?.host ?? "local"} rootPath={effectiveRoot ?? ""} highlightPath={highlightPath} />

      {/* Resize handle */}
      <div
        onMouseDown={handleDragStart}
        style={{
          position: "absolute",
          top: 0,
          right: -3,
          width: 6,
          height: "100%",
          cursor: "col-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 1.5,
            height: "100%",
            borderRadius: 1,
            background: dragging ? "var(--bg-divider-active)" : "transparent",
            transition: "background 0.12s ease",
          }}
        />
      </div>
    </div>
  );
});
