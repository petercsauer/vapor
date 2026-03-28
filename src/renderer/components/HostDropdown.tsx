import React, { useEffect, useRef, useState, useCallback } from "react";
import { vapor } from "../api/vapor";
import { useTabPaneStore } from "../store/tabs";
import type { RecentHost } from "../../shared/types";

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export const HostDropdown = React.memo(function HostDropdown({
  open,
  onClose,
  anchorRef,
}: Props) {
  const [sshHosts, setSSHHosts] = useState<string[]>([]);
  const [dockerContainers, setDockerContainers] = useState<string[]>([]);
  const [recentHosts, setRecentHosts] = useState<RecentHost[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<"ssh" | "docker" | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setExpandedCategory(null);
      return;
    }
    const override = (window as any).__hostDropdownOverride as
      | { ssh: string[]; docker: string[]; recent: RecentHost[] }
      | undefined;
    if (override) {
      setSSHHosts(override.ssh);
      setDockerContainers(override.docker);
      setRecentHosts(override.recent);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      vapor.hosts.listSSHConfigHosts(),
      vapor.hosts.listDockerContainers(),
      vapor.hosts.getRecent(),
    ])
      .then(([ssh, docker, recent]) => {
        setSSHHosts(ssh);
        setDockerContainers(docker);
        setRecentHosts(recent);
      })
      .catch((err) => console.error("Failed to fetch hosts:", err))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleMouseDown, true);
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown, true);
      document.removeEventListener("keydown", handleKey, true);
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleSelect = useCallback(async (type: "ssh" | "docker", host: string) => {
    onClose();
    const { createTabWithHost } = useTabPaneStore.getState();
    await createTabWithHost({ type, host });
    await vapor.hosts.addRecent({ type, host });
  }, [onClose]);

  const handleRemoveRecent = useCallback(async (type: "ssh" | "docker", host: string) => {
    await vapor.hosts.removeRecent({ type, host });
    setRecentHosts((prev) => prev.filter((r) => !(r.type === type && r.host === host)));
  }, []);

  const handleCategoryEnter = useCallback((cat: "ssh" | "docker") => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setExpandedCategory(cat);
  }, []);

  const handleCategoryLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => setExpandedCategory(null), 200);
  }, []);

  const handleSubmenuEnter = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  }, []);

  const handleSubmenuLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => setExpandedCategory(null), 200);
  }, []);

  if (!open) return null;

  const anchorRect = anchorRef.current?.getBoundingClientRect();
  const fixedTop = anchorRect ? anchorRect.bottom + 4 : 40;
  const fixedLeft = anchorRect ? anchorRect.left : 0;

  const MAX_RECENT = 5;
  const visibleRecent = recentHosts.slice(0, MAX_RECENT);
  const hasRecent = visibleRecent.length > 0;
  const hasSSH = sshHosts.length > 0;
  const hasDocker = dockerContainers.length > 0;
  const isEmpty = false;

  return (
    <div ref={ref} style={{ position: "fixed", top: 0, left: 0, width: 0, height: 0, zIndex: 9999 }}>
      <div
        className="dropdown-surface"
        style={{ position: "fixed", top: fixedTop, left: fixedLeft, minWidth: 180, overflow: "hidden" }}
      >
        {loading && <EmptyMessage text="Loading..." />}
        {isEmpty && <EmptyMessage text="No hosts available" />}

        {!loading && hasRecent && (
          <div style={{ padding: "4px 0" }}>
            <SectionHeader label="Recent" />
            {visibleRecent.map((rh) => (
              <HostItem
                key={`recent-${rh.type}-${rh.host}`}
                type={rh.type}
                host={rh.host}
                showBadge
                onSelect={handleSelect}
                onRemove={handleRemoveRecent}
              />
            ))}
          </div>
        )}

        {!loading && hasRecent && <Separator />}

        {!loading && (
          <div style={{ padding: "4px 0" }}>
            <CategoryItem
              label="SSH Hosts"
              type="ssh"
              count={sshHosts.length}
              expanded={expandedCategory === "ssh"}
              disabled={!hasSSH}
              onMouseEnter={() => hasSSH && handleCategoryEnter("ssh")}
              onMouseLeave={handleCategoryLeave}
            />
            <CategoryItem
              label="Docker Containers"
              type="docker"
              count={dockerContainers.length}
              expanded={expandedCategory === "docker"}
              disabled={!hasDocker}
              onMouseEnter={() => hasDocker && handleCategoryEnter("docker")}
              onMouseLeave={handleCategoryLeave}
            />
          </div>
        )}
      </div>

      {expandedCategory === "ssh" && hasSSH && (
        <Submenu
          parentTop={fixedTop}
          parentLeft={fixedLeft}
          parentWidth={180}
          categoryIndex={0}
          recentOffset={hasRecent ? visibleRecent.length : 0}
          hasSeparator={hasRecent}
          hosts={sshHosts}
          type="ssh"
          onSelect={handleSelect}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        />
      )}

      {expandedCategory === "docker" && hasDocker && (
        <Submenu
          parentTop={fixedTop}
          parentLeft={fixedLeft}
          parentWidth={180}
          categoryIndex={hasSSH ? 1 : 0}
          recentOffset={hasRecent ? visibleRecent.length : 0}
          hasSeparator={hasRecent}
          hosts={dockerContainers}
          type="docker"
          onSelect={handleSelect}
          onMouseEnter={handleSubmenuEnter}
          onMouseLeave={handleSubmenuLeave}
        />
      )}
    </div>
  );
});

const SECTION_HEADER_H = 22;
const ITEM_H = 28;
const SEPARATOR_H = 1;
const SECTION_PAD = 8;

function Submenu({
  parentTop,
  parentLeft,
  parentWidth,
  categoryIndex,
  recentOffset,
  hasSeparator,
  hosts,
  type,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: {
  parentTop: number;
  parentLeft: number;
  parentWidth: number;
  categoryIndex: number;
  recentOffset: number;
  hasSeparator: boolean;
  hosts: string[];
  type: "ssh" | "docker";
  onSelect: (type: "ssh" | "docker", host: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const subRef = useRef<HTMLDivElement>(null);

  const recentSectionH = recentOffset > 0
    ? SECTION_HEADER_H + (recentOffset * ITEM_H) + SECTION_PAD
    : 0;
  const separatorH = hasSeparator ? SEPARATOR_H : 0;
  const categorySectionPad = SECTION_PAD;
  const categoryItemOffset = categoryIndex * ITEM_H;

  const subTop = parentTop + recentSectionH + separatorH + categorySectionPad + categoryItemOffset;
  const subLeft = parentLeft + parentWidth + 4;

  useEffect(() => {
    const el = subRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw - 4) {
      el.style.left = `${parentLeft - rect.width - 4}px`;
    }
    if (rect.bottom > vh - 4) {
      el.style.top = `${vh - rect.height - 4}px`;
    }
  });

  return (
    <div
      ref={subRef}
      className="dropdown-surface dropdown-scroll"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        top: subTop,
        left: subLeft,
        minWidth: 180,
        maxWidth: 260,
        maxHeight: 240,
        overflow: "hidden auto",
        paddingRight: 3,
      }}
    >
      <div style={{ padding: "4px 0" }}>
        {hosts.map((host) => (
          <HostItem
            key={`${type}-${host}`}
            type={type}
            host={host}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: "var(--text-dim)",
        padding: "6px 12px 2px",
        userSelect: "none",
        height: SECTION_HEADER_H,
        boxSizing: "border-box",
      }}
    >
      {label}
    </div>
  );
}

function CategoryItem({
  label,
  type,
  count,
  expanded,
  disabled,
  onMouseEnter,
  onMouseLeave,
}: {
  label: string;
  type: "ssh" | "docker";
  count: number;
  expanded: boolean;
  disabled?: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const isSSH = type === "ssh";
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        height: ITEM_H,
        boxSizing: "border-box",
        fontSize: 12,
        color: disabled ? "var(--text-dim)" : "var(--text-secondary)",
        cursor: "default",
        transition: "background 0.1s",
        background: expanded ? "var(--bg-hover)" : "transparent",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <TypeBadge type={type} />
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, color: "var(--text-dim)", marginRight: 2 }}>{count}</span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, color: "var(--text-dim)" }}
      >
        <path d="M5 3l4 4-4 4" />
      </svg>
    </div>
  );
}

function TypeBadge({ type }: { type: "ssh" | "docker" }) {
  const isSSH = type === "ssh";
  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 700,
        color: isSSH ? "var(--ssh-text)" : "var(--container-text)",
        background: isSSH ? "var(--ssh-bg)" : "var(--container-bg)",
        border: `1px solid ${isSSH ? "var(--ssh-border)" : "var(--container-border)"}`,
        borderRadius: 2,
        padding: "0 3px",
        lineHeight: "12px",
        textTransform: "uppercase",
        flexShrink: 0,
      }}
    >
      {isSSH ? "SSH" : "Docker"}
    </span>
  );
}

function HostItem({
  type,
  host,
  showBadge,
  onSelect,
  onRemove,
}: {
  type: "ssh" | "docker";
  host: string;
  showBadge?: boolean;
  onSelect: (type: "ssh" | "docker", host: string) => void;
  onRemove?: (type: "ssh" | "docker", host: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(type, host)}
      className="host-row"
      style={{ height: ITEM_H, boxSizing: "border-box" }}
    >
      {showBadge && <TypeBadge type={type} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {host}
      </span>
      {onRemove && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove(type, host);
          }}
          className="remove-btn"
        >
          x
        </span>
      )}
    </div>
  );
}

function Separator() {
  return <div style={{ height: SEPARATOR_H, background: "var(--bg-hover)" }} />;
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div style={{ padding: "16px 12px", fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
      {text}
    </div>
  );
}
