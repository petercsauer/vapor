import React, { useEffect, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import type { PaneNode } from "../store/panes";
import { countTerminals } from "../store/panes";
import { TabChrome } from "./TabChrome";

const DND_ITEM_TYPE = "TAB";

function PaneMinimap({ node, focusedPaneId }: { node: PaneNode; focusedPaneId: string }) {
  if (node.type === "terminal" || node.type === "editor") {
    const isFocused = node.id === focusedPaneId;
    return (
      <div
        style={{
          flex: 1,
          borderRadius: 1,
          background: isFocused
            ? "var(--minimap-focused)"
            : "var(--minimap-unfocused)",
          transition: "background 0.15s ease",
        }}
      />
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: node.direction === "horizontal" ? "row" : "column",
        gap: 1,
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <div style={{ flex: node.ratio, display: "flex", minWidth: 0, minHeight: 0 }}>
        <PaneMinimap node={node.children[0]} focusedPaneId={focusedPaneId} />
      </div>
      <div style={{ flex: 1 - node.ratio, display: "flex", minWidth: 0, minHeight: 0 }}>
        <PaneMinimap node={node.children[1]} focusedPaneId={focusedPaneId} />
      </div>
    </div>
  );
}

interface TabProps {
  tabId: string;
  title: string;
  isActive: boolean;
  isNavSelected: boolean;
  exitCode?: number | null;
  sshHost?: string;
  containerName?: string;
  isPinned?: boolean;
  paneRoot?: PaneNode;
  focusedPaneId?: string;
  index: number;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onRename: (tabId: string, newTitle: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

function statusDotColor(exitCode: number | null | undefined): string | null {
  if (exitCode === undefined) return null;
  if (exitCode === null) return null;
  if (exitCode === 0) return "#4CD964";
  return "#FF3B30";
}

export const Tab = React.memo(function Tab({
  tabId,
  title,
  isActive,
  isNavSelected,
  exitCode,
  sshHost,
  containerName,
  isPinned,
  paneRoot,
  focusedPaneId,
  index,
  onActivate,
  onClose,
  onRename,
  onReorder,
}: TabProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: DND_ITEM_TYPE,
    item: { tabId, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: !editing,
  });

  const [, drop] = useDrop({
    accept: DND_ITEM_TYPE,
    hover: (item: { tabId: string; index: number }) => {
      if (!dragRef.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex) return;

      onReorder(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(dragRef));

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    setEditing(false);
    onRename(tabId, draft);
  };

  const cancelRename = () => {
    setEditing(false);
    setDraft(title);
  };

  const handleDoubleClick = () => {
    setDraft(title);
    setEditing(true);
  };

  const dotColor = statusDotColor(exitCode);

  return (
    <TabChrome
      ref={dragRef}
      isActive={isActive}
      highlighted={isNavSelected}
      hideClose={editing}
      onClick={() => onActivate(tabId)}
      onClose={() => onClose(tabId)}
      onDoubleClick={handleDoubleClick}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      {paneRoot && focusedPaneId && countTerminals(paneRoot) > 1 && (
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 2,
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-muted)",
            padding: 1.5,
            display: "flex",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <PaneMinimap node={paneRoot} focusedPaneId={focusedPaneId} />
        </div>
      )}
      {dotColor && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
            transition: "background 0.2s ease",
          }}
        />
      )}
      {sshHost && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 0.3,
            lineHeight: "12px",
            height: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            color: "var(--ssh-text)",
            background: "var(--ssh-bg)",
            border: "1px solid var(--ssh-border)",
            borderRadius: 3,
            padding: "0 4px",
            flexShrink: 0,
          }}
        >
          {isPinned && (
            <svg width="8" height="8" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="7" width="8" height="6" rx="1" />
              <path d="M5 7V5a2 2 0 0 1 4 0v2" />
            </svg>
          )}
          {sshHost}
        </span>
      )}
      {containerName && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 0.3,
            lineHeight: "12px",
            height: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            color: "var(--container-text)",
            background: "var(--container-bg)",
            border: "1px solid var(--container-border)",
            borderRadius: 3,
            padding: "0 4px",
            flexShrink: 0,
          }}
        >
          {isPinned && (
            <svg width="8" height="8" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="7" width="8" height="6" rx="1" />
              <path d="M5 7V5a2 2 0 0 1 4 0v2" />
            </svg>
          )}
          {containerName}
        </span>
      )}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") cancelRename();
          }}
          onBlur={commitRename}
          onClick={(e) => e.stopPropagation()}
          style={{
            all: "unset",
            flex: 1,
            minWidth: 0,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 0.1,
            color: "var(--text-primary)",
            background: "var(--bg-hover)",
            borderRadius: 3,
            padding: "1px 4px",
            outline: "1px solid var(--accent-outline)",
          }}
        />
      ) : (
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          {title}
        </span>
      )}
    </TabChrome>
  );
});
