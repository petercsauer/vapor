import React, { useEffect, useRef, useState } from "react";
import { useConfigStore } from "../store/config";
import { rgbaToHex } from "../utils/color";
import type { VaporConfig } from "../../shared/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = React.memo(function SettingsModal({
  isOpen,
  onClose,
}: SettingsModalProps) {
  const config = useConfigStore((s) => s.config);
  const saveConfig = useConfigStore((s) => s.saveConfig);
  const modalRef = useRef<HTMLDivElement>(null);

  const [fontFamily, setFontFamily] = useState("");
  const [fontSize, setFontSize] = useState(12);
  const [fontLigatures, setFontLigatures] = useState(true);
  const [shellPath, setShellPath] = useState("");
  const [shellArgs, setShellArgs] = useState("");
  const [themeBackground, setThemeBackground] = useState("");
  const [themeForeground, setThemeForeground] = useState("");
  const [themeCursor, setThemeCursor] = useState("");
  const [themeSelection, setThemeSelection] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config && isOpen) {
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
  }, [config, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    try {
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

      onClose();
    } catch (error) {
      console.error("Failed to save config:", error);
      alert("Failed to save settings. Please check the console for details.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !config) return null;

  return (
    <div className="modal-overlay">
      <div ref={modalRef} className="modal-panel">
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="icon-button"
            style={{ width: 28, height: 28, fontSize: 18 }}
            aria-label="Close settings"
          >
            x
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <section style={{ marginBottom: 24 }}>
            <h3 className="section-title">Font</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">Font Family</label>
                <input
                  type="text"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Font Size ({fontSize}px)</label>
                <input
                  type="range"
                  min="8"
                  max="24"
                  step="1"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  style={{
                    width: "100%",
                    height: 4,
                    borderRadius: 2,
                    outline: "none",
                    background: "var(--bg-subtle)",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="ligatures"
                  checked={fontLigatures}
                  onChange={(e) => setFontLigatures(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <label
                  htmlFor="ligatures"
                  style={{ fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  Enable font ligatures
                </label>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h3 className="section-title">Theme</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ColorInput label="Background" value={themeBackground} onChange={setThemeBackground} />
              <ColorInput label="Foreground" value={themeForeground} onChange={setThemeForeground} />
              <ColorInput label="Cursor" value={themeCursor} onChange={setThemeCursor} />
              <ColorInput label="Selection" value={themeSelection} onChange={setThemeSelection} />
            </div>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h3 className="section-title">Shell</h3>
            <div className="hint-box">
              <p>Shell changes will only apply to new tabs. Existing tabs will keep their current shell.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="form-label">Shell Path</label>
                <input
                  type="text"
                  value={shellPath}
                  onChange={(e) => setShellPath(e.target.value)}
                  placeholder="/bin/zsh"
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Shell Arguments</label>
                <input
                  type="text"
                  value={shellArgs}
                  onChange={(e) => setShellArgs(e.target.value)}
                  placeholder="-l"
                  className="form-input"
                />
              </div>
            </div>
          </section>
        </div>

        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="btn-primary">
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
});

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorInput = React.memo(function ColorInput({
  label,
  value,
  onChange,
}: ColorInputProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <input
        type="color"
        value={value.startsWith("rgba") ? rgbaToHex(value) : value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 40,
          height: 32,
          padding: 2,
          border: "1px solid var(--border-muted)",
          borderRadius: 6,
          cursor: "pointer",
          background: "var(--bg-input)",
        }}
      />
      <div style={{ flex: 1 }}>
        <label className="form-label" style={{ marginBottom: 4 }}>{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-input"
          style={{ padding: "6px 10px", fontSize: 11 }}
        />
      </div>
    </div>
  );
});
