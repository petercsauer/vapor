import React, { useEffect, useRef, useCallback } from "react";

export interface ContextMenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

export interface ContextMenuSeparator {
  separator: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

interface Props {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

function isSeparator(item: ContextMenuEntry): item is ContextMenuSeparator {
  return "separator" in item;
}

export const FileTreeContextMenu = React.memo(function FileTreeContextMenu({
  x,
  y,
  items,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) el.style.left = `${vw - rect.width - 4}px`;
    if (rect.bottom > vh) el.style.top = `${vh - rect.height - 4}px`;
  }, [x, y]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handle, true);
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("mousedown", handle, true);
      document.removeEventListener("keydown", handleKey, true);
    };
  }, [onClose]);

  const handleClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) return;
      onClose();
      item.action();
    },
    [onClose],
  );

  return (
    <div
      ref={ref}
      className="dropdown-surface"
      style={{ position: "fixed", left: x, top: y, zIndex: 9999, minWidth: 180, padding: "4px 0" }}
    >
      {items.map((item, i) =>
        isSeparator(item) ? (
          <div key={`sep-${i}`} className="menu-separator" />
        ) : (
          <div
            key={item.label}
            onClick={() => handleClick(item)}
            className={`menu-row${item.disabled ? " disabled" : ""}${item.danger ? " danger" : ""}`}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span style={{ color: "var(--text-dim)", fontSize: 11, marginLeft: 16 }}>
                {item.shortcut}
              </span>
            )}
          </div>
        ),
      )}
    </div>
  );
});
