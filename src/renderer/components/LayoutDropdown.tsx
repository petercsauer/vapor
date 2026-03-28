import React, { useEffect, useRef, useState } from "react";
import { useTabPaneStore } from "../store/tabs";
import { vapor } from "../api/vapor";
import type { SavedLayout } from "../../shared/types";

export const LayoutDropdown = React.memo(function LayoutDropdown() {
  const [open, setOpen] = useState(false);
  const [layouts, setLayouts] = useState<SavedLayout[]>([]);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const captureLayout = useTabPaneStore((s) => s.captureLayout);
  const restoreLayout = useTabPaneStore((s) => s.restoreLayout);

  const loadLayouts = async () => {
    const list = await vapor.layouts.list();
    setLayouts(list);
  };

  useEffect(() => {
    if (open) loadLayouts();
  }, [open]);

  useEffect(() => {
    if (naming) inputRef.current?.focus();
  }, [naming]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setNaming(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const tabs = await captureLayout();
    await vapor.layouts.save(trimmed, tabs);
    setDraft("");
    setNaming(false);
    await loadLayouts();
  };

  const handleRestore = async (layout: SavedLayout) => {
    setOpen(false);
    await restoreLayout(layout.tabs);
  };

  const handleDelete = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    const updated = await vapor.layouts.delete(name);
    setLayouts(updated);
  };

  return (
    <div
      ref={dropdownRef}
      className="no-drag"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        height: "100%",
        flexShrink: 0,
        paddingRight: 3,
      }}
    >
      <button
        onClick={() => {
          setOpen((prev) => !prev);
          setNaming(false);
        }}
        className="icon-button"
        aria-label="Layouts"
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          background: open ? "var(--bg-active)" : undefined,
          color: open ? "var(--text-bright)" : undefined,
          fontSize: 13,
          lineHeight: 1,
          width: 26,
          height: 26,
        }}
        title="Layouts"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 1h8a1 1 0 0 1 1 1v10.5l-5-3-5 3V2a1 1 0 0 1 1-1z" />
        </svg>
      </button>

      {open && (
        <div
          className="dropdown-surface"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 200,
            maxWidth: 280,
            overflow: "hidden",
            zIndex: 100,
          }}
        >
          {layouts.length > 0 && (
            <div
              role="menu"
              aria-label="Saved layouts"
              style={{ maxHeight: 240, overflowY: "auto", padding: "4px 0" }}
            >
              {layouts.map((layout) => (
                <div
                  key={layout.name}
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => handleRestore(layout)}
                  className="menu-row"
                  style={{ padding: "6px 12px", margin: 0 }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {layout.name}
                  </span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-faint)" }}>
                    {layout.tabs.length} tab{layout.tabs.length !== 1 && "s"}
                  </span>
                  <span
                    onClick={(e) => handleDelete(e, layout.name)}
                    className="layout-delete-btn"
                    style={{
                      marginLeft: 8,
                      fontSize: 11,
                      color: "var(--text-dim)",
                      cursor: "default",
                      padding: "0 2px",
                      borderRadius: 3,
                      transition: "color 0.1s",
                    }}
                  >
                    x
                  </span>
                </div>
              ))}
            </div>
          )}

          {layouts.length > 0 && <div className="menu-separator" />}

          <div style={{ padding: "4px 0" }}>
            {naming ? (
              <div style={{ padding: "4px 8px" }}>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") {
                      setNaming(false);
                      setDraft("");
                    }
                  }}
                  onBlur={() => {
                    if (!draft.trim()) {
                      setNaming(false);
                      setDraft("");
                    }
                  }}
                  placeholder="Layout name..."
                  style={{
                    all: "unset",
                    width: "100%",
                    fontSize: 12,
                    color: "var(--text-primary)",
                    background: "var(--bg-subtle)",
                    borderRadius: 4,
                    padding: "4px 8px",
                    outline: "1px solid var(--accent-outline-dim)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ) : (
              <div
                role="menuitem"
                tabIndex={-1}
                onClick={() => setNaming(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setNaming(true);
                  }
                }}
                className="menu-row"
                style={{ color: "var(--accent)", margin: 0, padding: "6px 12px" }}
              >
                + Save current layout
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
