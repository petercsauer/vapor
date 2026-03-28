import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { WebglAddon } from "@xterm/addon-webgl";
import { useTabPaneStore } from "../store/tabs";
import { useConfigStore } from "../store/config";
import { useNavigationStore } from "../store/navigation";
import { SearchBox } from "./SearchBox";
import { vapor } from "../api/vapor";
import { TERMINAL_SCROLLBACK } from "../constants";
import "@xterm/xterm/css/xterm.css";

const DEBUG_SCROLL = false;

const FALLBACK_THEME = {
  background: "#00000000",
  foreground: "#FFFFFF",
  cursor: "#0095FF",
  cursorAccent: "#000000",
  selectionBackground: "var(--accent-selection)",
  black: "#000000",
  red: "#FF3B30",
  green: "#4CD964",
  yellow: "#FFCC00",
  blue: "#0095FF",
  magenta: "#FF2D55",
  cyan: "#5AC8FA",
  white: "#FFFFFF",
  brightBlack: "#686868",
  brightRed: "#FF3B30",
  brightGreen: "#4CD964",
  brightYellow: "#FFCC00",
  brightBlue: "#0095FF",
  brightMagenta: "#FF2D55",
  brightCyan: "#5AC8FA",
  brightWhite: "#FFFFFF",
};

interface TerminalPaneProps {
  sessionId: string;
  paneId: string;
}

export const TerminalPane = React.memo(function TerminalPane({ sessionId, paneId }: TerminalPaneProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const userScrolledAwayFromBottomRef = useRef(false);

  const focusedPaneId = useTabPaneStore((s) => {
    const activeTab = s.tabs.find((t) => t.id === s.activeTabId);
    return activeTab?.focusedPaneId ?? null;
  });
  const setFocusedPane = useTabPaneStore((s) => s.setFocusedPane);
  const isFocused = focusedPaneId === paneId;

  const config = useConfigStore((s) => s.config);

  const isNavSelected = useNavigationStore((s) => {
    if (!s.isNavigating || !s.selectedTarget) return false;
    return s.selectedTarget.type === "pane" && s.selectedTarget.paneId === paneId;
  });

  useEffect(() => {
    if (!xtermRef.current) return;

    const fontFamily = config?.font.family ??
      '"SFMono Nerd Font", "MesloLGS NF", "MesloLGS Nerd Font", "Hack Nerd Font", "FiraCode Nerd Font", "JetBrainsMono Nerd Font", "SF Mono", "Monaco", "Inconsolata", "Fira Mono", "Droid Sans Mono", "Source Code Pro", monospace';
    const fontSize = config?.font.size ?? 12;

    const isOpaque = config?.background?.transparent === false;
    const opaqueColor = config?.background?.opaqueColor || "#121212";
    const theme = config?.theme
      ? { ...config.theme, background: isOpaque ? opaqueColor : "#00000000", cursorAccent: "#000000" }
      : FALLBACK_THEME;

    const terminal = new Terminal({
      fontFamily,
      fontSize,
      lineHeight: 1.05,
      allowTransparency: !isOpaque,
      theme,
      cursorBlink: true,
      scrollback: TERMINAL_SCROLLBACK,
      smoothScrollDuration: 0,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon((_event, url) => {
      vapor.openExternal(url);
    });
    const searchAddon = new SearchAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);

    terminal.open(xtermRef.current);

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      terminal.loadAddon(webglAddon);
    } catch {
      // WebGL2 not available — DOM renderer continues as fallback
    }

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    terminal.onData((data) => {
      try {
        vapor.pty.input(sessionId, data);
      } catch (error) {
        console.error(`[TerminalPane] Failed to send input to session ${sessionId}:`, error);
        terminal.write("\r\n\x1b[31mError: Failed to send input to terminal session\x1b[0m\r\n");
      }
    });

    terminal.onResize(({ cols, rows }) => {
      try {
        vapor.pty.resize(sessionId, cols, rows);
      } catch (error) {
        console.error(`[TerminalPane] Failed to resize session ${sessionId}:`, error);
      }
    });

    fitAddon.fit();

    // Force viewport sync on buffer change (xterm.js #5127)
    const bufferChangeDisposable = terminal.buffer.onBufferChange(() => {
      if (DEBUG_SCROLL) {
        console.log('[BufferChange] Calling fit() to sync viewport dimensions');
      }
      fitAddon.fit();
    });

    // Prevent viewport jump when TUI apps (e.g. Claude Code) redraw the screen
    const viewportEl = xtermRef.current.querySelector('.xterm-viewport') as HTMLElement | null;
    let preWriteViewportY = 0;
    let preWriteBaseY = 0;
    let lastUserScrollTime = 0;
    let isScrollingProgrammatically = false;
    let isWriteInProgress = false;

    const scrollGuardDisposable = terminal.onWriteParsed(() => {
      isScrollingProgrammatically = true;
      try {
        if (!userScrolledAwayFromBottomRef.current) {
          terminal.scrollToBottom();
        } else {
          terminal.scrollToLine(preWriteViewportY);
        }
      } finally {
        isScrollingProgrammatically = false;
      }

      try {
        (terminal as any)._core?._viewport?.syncScrollArea(true);
      } catch { /* internal API guard */ }

      const finalY = terminal.buffer.active.viewportY;
      const baseY = terminal.buffer.active.baseY;
      setIsAtBottom(finalY >= baseY - 1);
    });

    let writeBuf = "";
    let rafId: number | null = null;
    const flushWrites = () => {
      rafId = null;
      if (writeBuf) {
        const chunk = writeBuf;
        writeBuf = "";
        preWriteViewportY = terminal.buffer.active.viewportY;
        preWriteBaseY = terminal.buffer.active.baseY;
        isWriteInProgress = true;
        terminal.write(chunk, () => {
          isWriteInProgress = false;
        });
      }
    };
    const removeOutputListener = vapor.pty.onOutput(
      ({ sessionId: sid, data }) => {
        if (sid === sessionId) {
          writeBuf += data;
          if (rafId === null) {
            rafId = requestAnimationFrame(flushWrites);
          }
        }
      },
    );

    const removeExitListener = vapor.pty.onExit(({ sessionId: sid, exitCode }) => {
      if (sid === sessionId) {
        if (exitCode === 0 || exitCode === undefined) {
          terminal.write("\r\n\x1b[2m[Process exited]\x1b[0m\r\n");
        } else {
          terminal.write(`\r\n\x1b[31m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
        }
      }
    });

    const checkAtBottom = () => {
      if (isScrollingProgrammatically) return;
      const currentY = terminal.buffer.active.viewportY;
      const baseY = terminal.buffer.active.baseY;
      const newIsAtBottom = currentY >= baseY - 1;
      setIsAtBottom(newIsAtBottom);
      if (!isWriteInProgress) {
        userScrolledAwayFromBottomRef.current = !newIsAtBottom;
      }
    };
    const onScrollDisposable = terminal.onScroll(() => {
      if (isScrollingProgrammatically) return;
      lastUserScrollTime = Date.now();
      checkAtBottom();
    });
    const onNativeScroll = () => {
      if (isScrollingProgrammatically) return;
      lastUserScrollTime = Date.now();
      checkAtBottom();
    };
    if (viewportEl) {
      viewportEl.addEventListener('scroll', onNativeScroll, { passive: true });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      try {
        const entry = entries[0];
        if (!entry || entry.contentRect.width === 0 || entry.contentRect.height === 0) return;
        const viewportY = terminal.buffer.active.viewportY;
        // Use consistent baseY - 1 tolerance for isAtBottom check
        const wasAtBottom = viewportY >= terminal.buffer.active.baseY - 1;
        fitAddon.fit();
        isScrollingProgrammatically = true;
        try {
          if (wasAtBottom) {
            terminal.scrollToBottom();
          } else {
            terminal.scrollToLine(viewportY);
          }
        } finally {
          isScrollingProgrammatically = false;
        }
      } catch (error) {
        // Terminal may be mid-disposal during pane restructuring
        console.warn(`[TerminalPane] ResizeObserver error for session ${sessionId}:`, error);
      }
    });
    resizeObserver.observe(xtermRef.current);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      onScrollDisposable.dispose();
      scrollGuardDisposable.dispose();
      bufferChangeDisposable.dispose();
      if (viewportEl) viewportEl.removeEventListener('scroll', onNativeScroll);
      resizeObserver.disconnect();
      removeOutputListener();
      removeExitListener();
      terminal.dispose();
      searchAddonRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !config) return;

    const isOpaque = config.background?.transparent === false;
    const opaqueColor = config.background?.opaqueColor || "#121212";

    terminal.options.fontSize = config.font.size;
    terminal.options.fontFamily = config.font.family ??
      '"SFMono Nerd Font", "MesloLGS NF", "MesloLGS Nerd Font", "Hack Nerd Font", "FiraCode Nerd Font", "JetBrainsMono Nerd Font", "SF Mono", "Monaco", "Inconsolata", "Fira Mono", "Droid Sans Mono", "Source Code Pro", monospace';
    (terminal.options as any).fontLigatures = config.font.ligatures ?? true;
    terminal.options.theme = {
      ...config.theme,
      background: isOpaque ? opaqueColor : "#00000000",
      cursorAccent: "#000000",
    };

    if (fitAddon) {
      try { fitAddon.fit(); } catch { /* terminal may be mid-disposal */ }
    }
  }, [config]);

  useEffect(() => {
    if (isFocused && terminalRef.current) {
      terminalRef.current.focus();
    }
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) return;

    const cleanupMenu = vapor.onMenuAction((action: string) => {
      if (action === "menu:find") {
        setShowSearch((prev) => !prev);
      }
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      cleanupMenu();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFocused]);

  const handleClick = () => {
    setFocusedPane(paneId);
    terminalRef.current?.focus();
  };

  const handleScrollToBottom = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.scrollToBottom();
      terminal.focus();
    }
  }, []);

  return (
    <div
      ref={outerRef}
      onClick={handleClick}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        padding: "12px 12px 12px 12px",
      }}
    >
      {isNavSelected && (
        <div
          style={{
            position: "absolute",
            inset: 2,
            borderRadius: 14,
            border: "2px solid var(--accent-border)",
            boxShadow: "0 0 12px var(--accent-glow)",
            pointerEvents: "none",
            transition: "border 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
          }}
        />
      )}
      <div
        ref={xtermRef}
        style={{ width: "100%", height: "100%", position: "relative" }}
      />
      {showSearch && searchAddonRef.current && (
        <SearchBox
          searchAddon={searchAddonRef.current}
          onClose={() => setShowSearch(false)}
        />
      )}
      <button
        aria-label="Scroll to bottom"
        className="scroll-to-bottom-btn"
        onClick={handleScrollToBottom}
        onMouseDown={(e) => e.preventDefault()}
        style={{
          opacity: isAtBottom ? 0 : 0.9,
          pointerEvents: isAtBottom ? "none" : "auto",
        }}
      >
        <ArrowDownToLine size={14} />
      </button>
    </div>
  );
});
