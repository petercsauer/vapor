import React, { useEffect, useRef, useState } from "react";
import type { SearchAddon } from "@xterm/addon-search";
import { SEARCH_INPUT_WIDTH } from "../constants";

interface SearchBoxProps {
  searchAddon: SearchAddon;
  onClose: () => void;
}

export const SearchBox = React.memo(function SearchBox({ searchAddon, onClose }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query) {
      searchAddon.findNext(query);
    } else {
      searchAddon.clearDecorations();
    }
  }, [query, searchAddon]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      searchAddon.clearDecorations();
      onClose();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      if (query) searchAddon.findPrevious(query);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (query) searchAddon.findNext(query);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 12,
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "var(--bg-surface-dim)",
        borderRadius: 6,
        padding: "4px 8px",
        boxShadow: "var(--shadow-small)",
        zIndex: 10,
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Search terminal"
        placeholder="Find..."
        style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border-highlight)",
          borderRadius: 4,
          color: "var(--text-primary)",
          fontSize: 12,
          padding: "3px 8px",
          outline: "none",
          width: SEARCH_INPUT_WIDTH,
        }}
      />
      <NavButton
        title="Previous (Shift+Enter)"
        onClick={() => query && searchAddon.findPrevious(query)}
      >
        &#x25B2;
      </NavButton>
      <NavButton
        title="Next (Enter)"
        onClick={() => query && searchAddon.findNext(query)}
      >
        &#x25BC;
      </NavButton>
      <NavButton
        title="Close (Escape)"
        onClick={() => {
          searchAddon.clearDecorations();
          onClose();
        }}
      >
        &times;
      </NavButton>
    </div>
  );
});

function NavButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="icon-button"
      style={{ fontSize: 11, padding: "2px 5px", borderRadius: 3, lineHeight: 1 }}
    >
      {children}
    </button>
  );
}
