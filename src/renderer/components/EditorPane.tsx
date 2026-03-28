import React, { useEffect, useRef, useCallback, useState } from "react";
import "monaco-editor/min/vs/editor/editor.main.css";
import { useEditorStore, parseFileKey } from "../store/editor";
import { useTabPaneStore } from "../store/tabs";
import { FileTypeIcon } from "./FileIcon";
import { TabChrome } from "./TabChrome";
import { HEADER_HEIGHT } from "../constants";
import { rgbaToHex } from "../utils/color";

type Monaco = typeof import("monaco-editor/esm/vs/editor/editor.api");
type IStandaloneCodeEditor = import("monaco-editor/esm/vs/editor/editor.api").editor.IStandaloneCodeEditor;

let monacoPromise: Promise<Monaco> | null = null;
let monacoInstance: Monaco | null = null;
let themeRegistered = false;

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    if (e.reason?.message === "Canceled" || e.reason?.name === "Canceled") {
      e.preventDefault();
    }
  });
}

function getMonaco(): Promise<Monaco> {
  if (!monacoPromise) {
    monacoPromise = import("monaco-editor/esm/vs/editor/editor.api").then((m) => {
      monacoInstance = m;
      return m;
    });
  }
  return monacoPromise;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function resolveColor(cssVarName: string): string {
  return rgbaToHex(cssVar(cssVarName));
}

function ensureVaporTheme(monaco: Monaco) {
  if (themeRegistered) return;
  themeRegistered = true;

  monaco.editor.defineTheme("vapor", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": resolveColor("--text-primary"),
      "editor.selectionBackground": resolveColor("--accent-selection"),
      "editorCursor.foreground": "#0095FF",
      "editor.lineHighlightBackground": resolveColor("--bg-subtle"),
      "editorWidget.background": resolveColor("--bg-surface"),
      "editorWidget.border": resolveColor("--border-muted"),
      "list.hoverBackground": resolveColor("--bg-hover"),
      "list.activeSelectionBackground": resolveColor("--bg-active"),
      "editorLineNumber.foreground": resolveColor("--text-dim"),
      "editorLineNumber.activeForeground": resolveColor("--text-muted"),
      "editorIndentGuide.background": resolveColor("--border-subtle"),
      "editorBracketMatch.background": resolveColor("--bg-highlight"),
      "editorBracketMatch.border": resolveColor("--border-highlight"),
      "scrollbarSlider.background": "rgba(255, 255, 255, 0.1)",
      "scrollbarSlider.hoverBackground": "rgba(255, 255, 255, 0.2)",
      "scrollbarSlider.activeBackground": "rgba(255, 255, 255, 0.25)",
      "minimap.background": "#00000000",
    },
  });

  monaco.editor.setTheme("vapor");
}

interface EditorFileTabProps {
  filePath: string;
  isActive: boolean;
  isDirty: boolean;
  onActivate: (filePath: string) => void;
  onClose: (filePath: string) => void;
}

const EditorFileTab = React.memo(function EditorFileTab({
  filePath, isActive, isDirty, onActivate, onClose,
}: EditorFileTabProps) {
  const { path } = parseFileKey(filePath);
  const fileName = path.split("/").pop() ?? path;

  return (
    <TabChrome
      isActive={isActive}
      onClick={() => onActivate(filePath)}
      onClose={() => onClose(filePath)}
    >
      <FileTypeIcon fileName={fileName} size={14} />
      {isDirty && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--accent)",
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 120,
        }}
      >
        {fileName}
      </span>
    </TabChrome>
  );
});

interface EditorPaneProps {
  paneId: string;
}

export const EditorPane = React.memo(function EditorPane({ paneId }: EditorPaneProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<IStandaloneCodeEditor | null>(null);
  const currentFileRef = useRef<string>("");
  const contentListenerRef = useRef<{ dispose: () => void } | null>(null);

  const tabOrder = useEditorStore((s) => s.tabOrder);
  const activeFile = useEditorStore((s) => s.activeFile);
  const openFiles = useEditorStore((s) => s.openFiles);
  const activeFileReady = useEditorStore((s) => s.activeFile != null && s.activeFile in s.openFiles);
  const activateFile = useEditorStore((s) => s.activateFile);
  const closeTab = useEditorStore((s) => s.closeTab);
  const setContent = useEditorStore((s) => s.setContent);
  const setFocusedPane = useTabPaneStore((s) => s.setFocusedPane);

  const focusedPaneId = useTabPaneStore((s) => {
    const activeTab = s.tabs.find((t) => t.id === s.activeTabId);
    return activeTab?.focusedPaneId ?? null;
  });
  const isFocused = focusedPaneId === paneId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editorContainerRef.current) return;

    let disposed = false;

    getMonaco().then((monaco) => {
      if (disposed || !editorContainerRef.current) return;

      ensureVaporTheme(monaco);

      const editor = monaco.editor.create(editorContainerRef.current, {
        value: "",
        theme: "vapor",
        minimap: { enabled: false },
        fontSize: 12,
        fontFamily: '"SFMono Nerd Font", "MesloLGS NF", "SF Mono", "Monaco", "Inconsolata", monospace',
        lineHeight: 18,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        renderWhitespace: "selection",
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        padding: { top: 8, bottom: 8 },
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        stickyScroll: { enabled: false },
        scrollbar: {
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6,
        },
      });

      editorRef.current = editor;

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const fp = currentFileRef.current;
        if (fp) useEditorStore.getState().saveFile(fp);
      });

      editor.onDidFocusEditorWidget(() => {
        setFocusedPane(paneId);
      });

      setLoading(false);
    }).catch((err) => {
      console.error("Monaco init failed:", err);
      setError("Editor failed to load");
      setLoading(false);
    });

    return () => {
      disposed = true;
      contentListenerRef.current?.dispose();
      contentListenerRef.current = null;
      if (editorRef.current) {
        editorRef.current.setModel(null);
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!activeFile || !activeFileReady) return;
    currentFileRef.current = activeFile;

    const editor = editorRef.current;
    if (!editor || !monacoInstance) return;

    const file = openFiles[activeFile];
    if (!file) return;

    contentListenerRef.current?.dispose();

    const parsed = parseFileKey(activeFile);
    const uri = parsed.remoteHost
      ? monacoInstance.Uri.parse("remote://" + parsed.remoteHost + parsed.path)
      : monacoInstance.Uri.parse("file://" + parsed.path);
    let model = monacoInstance.editor.getModel(uri);
    if (model) {
      if (model.getValue() !== file.content) {
        model.setValue(file.content);
      }
    } else {
      model = monacoInstance.editor.createModel(file.content, file.language, uri);
    }
    editor.setModel(model);

    contentListenerRef.current = editor.onDidChangeModelContent(() => {
      setContent(activeFile, editor.getValue());
    });
  }, [activeFile, activeFileReady, loading]);

  useEffect(() => {
    if (isFocused && editorRef.current) {
      editorRef.current.focus();
    }
  }, [isFocused]);

  const handleClick = useCallback(() => {
    setFocusedPane(paneId);
  }, [setFocusedPane, paneId]);

  if (tabOrder.length === 0) {
    return (
      <div onClick={handleClick} style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8,
      }}>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>No files open</span>
        <span style={{ fontSize: 11, color: "var(--text-dim)", opacity: 0.6 }}>
          Open a file from the sidebar
        </span>
      </div>
    );
  }

  return (
    <div onClick={handleClick} style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        role="tablist"
        aria-label="Editor file tabs"
        style={{
          display: "flex",
          alignItems: "center",
          height: HEADER_HEIGHT,
          flexShrink: 0,
          padding: "0 4px",
          gap: 2,
          borderBottom: "1px solid var(--border-subtle)",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
        }}
      >
        {tabOrder.map((filePath) => (
          <EditorFileTab
            key={filePath}
            filePath={filePath}
            isActive={filePath === activeFile}
            isDirty={openFiles[filePath]?.dirty ?? false}
            onActivate={activateFile}
            onClose={closeTab}
          />
        ))}
      </div>

      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {loading && !error && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "var(--text-dim)",
          }}>
            Loading...
          </div>
        )}
        {error && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: "var(--text-danger, #f87171)",
          }}>
            {error}
          </div>
        )}
        <div ref={editorContainerRef} style={{ width: "100%", height: "100%" }} />
      </div>
    </div>
  );
});
