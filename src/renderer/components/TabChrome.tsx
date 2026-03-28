import React, { useState } from "react";
import { TAB_HEIGHT } from "../constants";

interface TabChromeProps {
  isActive: boolean;
  onClose: () => void;
  onClick: () => void;
  onDoubleClick?: () => void;
  highlighted?: boolean;
  hideClose?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const TabChrome = React.memo(
  React.forwardRef<HTMLDivElement, TabChromeProps>(function TabChrome(
    {
      isActive,
      onClose,
      onClick,
      onDoubleClick,
      highlighted,
      hideClose,
      style,
      children,
    },
    ref,
  ) {
  const [hovered, setHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const showClose = !hideClose && (hovered || isActive);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      ref={ref}
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
      className="no-drag"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "0 8px",
        height: TAB_HEIGHT,
        margin: "0 1px",
        cursor: "default",
        userSelect: "none",
        fontSize: 11,
        fontWeight: isActive ? 500 : 400,
        letterSpacing: 0.1,
        color: highlighted
          ? "var(--text-primary)"
          : isActive
            ? "var(--text-primary)"
            : hovered
              ? "var(--text-tab-hover)"
              : "var(--text-tab-idle)",
        background: highlighted
          ? "var(--accent-bg)"
          : isActive
            ? "var(--bg-strong)"
            : hovered
              ? "var(--bg-subtle)"
              : "transparent",
        borderRadius: 5,
        outline: highlighted
          ? "1.5px solid var(--accent-border)"
          : "none",
        outlineOffset: -1,
        transition:
          "background 0.12s ease, color 0.12s ease, outline 0.12s ease, opacity 0.12s ease",
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
      <span
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onMouseEnter={() => setCloseHovered(true)}
        onMouseLeave={() => setCloseHovered(false)}
        className="no-drag"
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          lineHeight: 1,
          color: "var(--text-muted)",
          background: closeHovered
            ? "var(--bg-highlight)"
            : "transparent",
          opacity: showClose ? 1 : 0,
          transition: "opacity 0.1s, background 0.1s",
          flexShrink: 0,
          cursor: "default",
        }}
      >
        ×
      </span>
    </div>
  );
  }),
);
