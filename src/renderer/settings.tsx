import { createRoot } from "react-dom/client";
import React, { useEffect, useState } from "react";
import { create } from "zustand";
import type { VaporConfig } from "../shared/types";
import { vapor } from "./api/vapor";
import "./globals.css";

interface ConfigStore {
  config: VaporConfig | null;
  loadConfig: () => Promise<void>;
  saveConfig: (newConfig: VaporConfig) => Promise<VaporConfig>;
}

const useConfigStore = create<ConfigStore>((set) => ({
  config: null,

  loadConfig: async () => {
    const config = await vapor.config.get();
    set({ config });
  },

  saveConfig: async (newConfig: VaporConfig) => {
    const config = await vapor.config.set(newConfig as unknown as Record<string, unknown>);
    set({ config });
    return config;
  },
}));

type Section = "general" | "appearance" | "shell";

const SettingsApp = () => {
  const config = useConfigStore((s) => s.config);
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const saveConfig = useConfigStore((s) => s.saveConfig);

  const [section, setSection] = useState<Section>("general");
  const [fontFamily, setFontFamily] = useState("");
  const [fontSize, setFontSize] = useState(12);
  const [fontLigatures, setFontLigatures] = useState(true);
  const [shellPath, setShellPath] = useState("");
  const [shellArgs, setShellArgs] = useState("");
  const [themeBackground, setThemeBackground] = useState("");
  const [themeForeground, setThemeForeground] = useState("");
  const [themeCursor, setThemeCursor] = useState("");
  const [themeSelection, setThemeSelection] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (config) {
      setFontFamily(config.font.family);
      setFontSize(config.font.size);
      setFontLigatures(config.font.ligatures);
      setShellPath(config.shell.path);
      setShellArgs(config.shell.args.join(" "));
      setThemeBackground(config.theme.background);
      setThemeForeground(config.theme.foreground);
      setThemeCursor(config.theme.cursor);
      setThemeSelection(config.theme.selectionBackground);
    }
  }, [config]);

  const handleSave = async () => {
    if (!config) return;

    const newConfig: VaporConfig = {
      ...config,
      font: {
        family: fontFamily,
        size: Math.max(8, Math.min(24, fontSize)),
        ligatures: fontLigatures,
      },
      shell: {
        path: shellPath,
        args: shellArgs.trim() ? shellArgs.trim().split(/\s+/) : [],
      },
      theme: {
        ...config.theme,
        background: themeBackground,
        foreground: themeForeground,
        cursor: themeCursor,
        selectionBackground: themeSelection,
      },
    };

    await saveConfig(newConfig);
  };

  if (!config) {
    return (
      <div style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-secondary)"
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: "transparent" }}>
      <div
        className="drag-region"
        style={{
          height: 76,
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 12,
        }}
      >
        <div className="no-drag segmented-group">
          <button
            onClick={() => setSection("general")}
            className={`segmented-btn ${section === "general" ? "active" : ""}`}
          >
            General
          </button>
          <button
            onClick={() => setSection("appearance")}
            className={`segmented-btn ${section === "appearance" ? "active" : ""}`}
          >
            Appearance
          </button>
          <button
            onClick={() => setSection("shell")}
            className={`segmented-btn ${section === "shell" ? "active" : ""}`}
          >
            Shell
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "32px 48px", background: "var(--bg-overlay)" }}>
        {section === "general" && (
          <div style={{ maxWidth: 540 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <FormRow label="Font Family">
                <input
                  type="text"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  onBlur={handleSave}
                  className="settings-input"
                />
              </FormRow>

              <FormRow label="Font Size">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="range"
                    min="8"
                    max="24"
                    step="1"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    onMouseUp={handleSave}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 36, textAlign: "right" }}>
                    {fontSize}px
                  </span>
                </div>
              </FormRow>

              <FormRow label="Font Ligatures">
                <input
                  type="checkbox"
                  checked={fontLigatures}
                  onChange={(e) => {
                    setFontLigatures(e.target.checked);
                    handleSave();
                  }}
                  style={{ cursor: "pointer" }}
                />
              </FormRow>
            </div>
          </div>
        )}

        {section === "appearance" && (
          <div style={{ maxWidth: 540 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ColorRow label="Background" value={themeBackground} onChange={(val) => { setThemeBackground(val); handleSave(); }} />
              <ColorRow label="Foreground" value={themeForeground} onChange={(val) => { setThemeForeground(val); handleSave(); }} />
              <ColorRow label="Cursor" value={themeCursor} onChange={(val) => { setThemeCursor(val); handleSave(); }} />
              <ColorRow label="Selection" value={themeSelection} onChange={(val) => { setThemeSelection(val); handleSave(); }} />
            </div>
          </div>
        )}

        {section === "shell" && (
          <div style={{ maxWidth: 540 }}>
            <div className="hint-box" style={{ border: "1px solid var(--border-muted)", marginBottom: 20 }}>
              <p style={{ lineHeight: 1.4 }}>
                Changes will only apply to new tabs. Existing tabs will keep their current shell.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <FormRow label="Shell Path">
                <input
                  type="text"
                  value={shellPath}
                  onChange={(e) => setShellPath(e.target.value)}
                  onBlur={handleSave}
                  placeholder="/bin/zsh"
                  className="settings-input"
                />
              </FormRow>

              <FormRow label="Shell Arguments">
                <input
                  type="text"
                  value={shellArgs}
                  onChange={(e) => setShellArgs(e.target.value)}
                  onBlur={handleSave}
                  placeholder="-l"
                  className="settings-input"
                />
              </FormRow>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FormRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "160px 1fr",
      alignItems: "center",
      gap: 20,
      minHeight: 28,
    }}
  >
    <label style={{ fontSize: 13, color: "var(--text-primary)", textAlign: "right" }}>
      {label}
    </label>
    <div>{children}</div>
  </div>
);

const ColorRow = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <FormRow label={label}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <input
        type="color"
        value={value.startsWith("rgba") ? rgbaToHex(value) : value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 32,
          height: 32,
          padding: 2,
          border: "1px solid var(--border-muted)",
          borderRadius: 6,
          cursor: "pointer",
          background: "var(--bg-input)",
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="settings-input"
        style={{ flex: 1 }}
      />
    </div>
  </FormRow>
);

function rgbaToHex(rgba: string): string {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (!match) return rgba;
  const r = parseInt(match[1]).toString(16).padStart(2, "0");
  const g = parseInt(match[2]).toString(16).padStart(2, "0");
  const b = parseInt(match[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

const root = createRoot(document.getElementById("root")!);
root.render(<SettingsApp />);
