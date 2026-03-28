import React, { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, PanelLeft } from "lucide-react";
import { useTabPaneStore } from "../store/tabs";
import { useNavigationStore } from "../store/navigation";
import { collectSessionIds } from "../store/panes";
import { HEADER_HEIGHT, HEADER_DRAG_PADDING } from "../constants";
import { Tab } from "./Tab";
import { LayoutDropdown } from "./LayoutDropdown";
import { HostDropdown } from "./HostDropdown";

const MoveModeButton = React.memo(function MoveModeButton() {
  const moveMode = useTabPaneStore((s) => s.moveMode);
  const toggleMoveMode = useTabPaneStore((s) => s.toggleMoveMode);

  return (
    <button
      onClick={toggleMoveMode}
      className="icon-button no-drag"
      aria-label="Toggle Move Mode"
      aria-pressed={moveMode}
      title="Toggle Move Mode"
      style={{
        width: 26,
        height: 26,
        flexShrink: 0,
        marginRight: 2,
        color: moveMode ? "var(--accent)" : undefined,
        background: moveMode ? "var(--accent-bg)" : undefined,
        border: moveMode ? "1px solid var(--accent-border)" : "1px solid transparent",
      }}
    >
      <ArrowLeftRight size={14} />
    </button>
  );
});

const NewTabButton = React.memo(function NewTabButton({
  createTab,
}: {
  createTab: () => void;
}) {
  const [hostDropdownOpen, setHostDropdownOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={createTab}
        onContextMenu={(e) => {
          e.preventDefault();
          setHostDropdownOpen(true);
        }}
        className="icon-button no-drag"
        style={{ fontSize: 16, lineHeight: 1, width: 26, height: 26, flexShrink: 0 }}
      >
        +
      </button>
      <HostDropdown
        open={hostDropdownOpen}
        onClose={() => setHostDropdownOpen(false)}
        anchorRef={buttonRef}
      />
    </>
  );
});

export const Header = React.memo(function Header() {
  const tabs = useTabPaneStore((s) => s.tabs);
  const activeTabId = useTabPaneStore((s) => s.activeTabId);
  const commandStatuses = useTabPaneStore((s) => s.commandStatuses);
  const sshHosts = useTabPaneStore((s) => s.sshHosts);
  const containerNames = useTabPaneStore((s) => s.containerNames);
  const pinnedHosts = useTabPaneStore((s) => s.pinnedHosts);
  const activateTab = useTabPaneStore((s) => s.activateTab);
  const closeTab = useTabPaneStore((s) => s.closeTab);
  const renameTab = useTabPaneStore((s) => s.renameTab);
  const reorderTabs = useTabPaneStore((s) => s.reorderTabs);
  const createTab = useTabPaneStore((s) => s.createTab);

  const exitCodes = useMemo(() => {
    const result: Record<string, number | null | undefined> = {};
    for (const tab of tabs) {
      const sids = collectSessionIds(tab.paneRoot);
      let worst: number | null | undefined = undefined;
      for (const sid of sids) {
        const code = commandStatuses[sid];
        if (code === undefined) continue;
        if (code === null) { worst = null; break; }
        if (worst === undefined || (code !== null && code > (worst ?? 0))) worst = code;
      }
      result[tab.id] = worst;
    }
    return result;
  }, [tabs, commandStatuses]);

  const navTarget = useNavigationStore((s) =>
    s.isNavigating ? s.selectedTarget : null,
  );

  const sidebarVisible = useTabPaneStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.sidebarVisible ?? false;
  });
  const toggleSidebar = useTabPaneStore((s) => s.toggleSidebar);

  return (
    <div
      className="drag-region"
      style={{
        display: "flex",
        alignItems: "center",
        height: HEADER_HEIGHT,
        paddingLeft: HEADER_DRAG_PADDING,
        paddingRight: 4,
        background: "transparent",
        flexShrink: 0,
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <button
        onClick={toggleSidebar}
        className="icon-button no-drag"
        aria-label="Toggle Sidebar"
        title="Toggle Sidebar (⌘B)"
        style={{
          width: 26,
          height: 26,
          flexShrink: 0,
          marginRight: 2,
          color: sidebarVisible ? "var(--text-bright)" : undefined,
          background: sidebarVisible ? "var(--bg-active)" : undefined,
        }}
      >
        <PanelLeft size={14} />
      </button>
      <div
        role="tablist"
        aria-label="Terminal tabs"
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          flex: 1,
          minWidth: 0,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          gap: 2,
          padding: "0 4px",
        }}
      >
        {tabs.map((tab, index) => (
          <Tab
            key={tab.id}
            tabId={tab.id}
            title={tab.title}
            isActive={tab.id === activeTabId}
            isNavSelected={
              navTarget?.type === "tab" && navTarget.tabId === tab.id
            }
            exitCode={exitCodes[tab.id]}
            sshHost={sshHosts[tab.id] || ""}
            containerName={containerNames[tab.id] || ""}
            isPinned={!!pinnedHosts[tab.id]}
            paneRoot={tab.paneRoot}
            focusedPaneId={tab.focusedPaneId}
            index={index}
            onActivate={activateTab}
            onClose={closeTab}
            onRename={renameTab}
            onReorder={reorderTabs}
          />
        ))}
        <NewTabButton createTab={createTab} />
      </div>
      <MoveModeButton />
      <LayoutDropdown />
    </div>
  );
});
