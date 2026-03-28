import React from "react";

interface FileIconProps {
  fileName: string;
  size?: number;
}

function getExt(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile" || lower === "gnumakefile") return "makefile";
  if (lower === ".gitignore" || lower === ".gitattributes") return "git";
  if (lower === ".env" || lower.startsWith(".env.")) return "env";
  if (lower === "package.json") return "npm";
  if (lower === "tsconfig.json" || lower.startsWith("tsconfig.")) return "tsconfig";
  if (lower === "cargo.toml") return "rust";
  if (lower === "go.mod" || lower === "go.sum") return "go";
  return lower.split(".").pop() ?? "";
}

const S = 14;

function PythonIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <path d="M8 1C5.2 1 5.5 2.2 5.5 2.2L5.5 3.5H8.2V4H3.5S1 3.7 1 8s1.9 4 1.9 4h1.3V10.5S4 8.5 6 8.5h2.5S10 8.5 10 7V3S10.2 1 8 1zM6.2 2.2a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4z" fill="#3776AB"/>
      <path d="M8 15c2.8 0 2.5-1.2 2.5-1.2V12.5H7.8V12h4.7S15 12.3 15 8s-1.9-4-1.9-4H11.8v1.5S12 7.5 10 7.5H7.5S6 7.5 6 9v4S5.8 15 8 15zM9.8 13.8a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4z" fill="#FFD43B"/>
    </svg>
  );
}

function TypeScriptIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#3178C6"/>
      <path d="M5 7.5h4M7 7.5V12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M10.5 8C10.5 7.4 11 7 11.7 7c.7 0 1.3.3 1.3 1s-.5.9-1.3 1.2c-.8.3-1.3.5-1.3 1.3 0 .7.5 1 1.3 1 .7 0 1.3-.4 1.3-1" stroke="#fff" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

function JavaScriptIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#F7DF1E"/>
      <path d="M6.5 7v3.5c0 1-.5 1.5-1.2 1.5" stroke="#000" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M9.5 8C9.5 7.4 10 7 10.7 7c.7 0 1.3.3 1.3 1s-.5.9-1.3 1.2c-.8.3-1.3.5-1.3 1.3 0 .7.5 1 1.3 1 .7 0 1.3-.4 1.3-1" stroke="#000" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

function ReactIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <ellipse cx="8" cy="8" rx="6.5" ry="2.5" stroke="#61DAFB" strokeWidth="1" transform="rotate(0 8 8)"/>
      <ellipse cx="8" cy="8" rx="6.5" ry="2.5" stroke="#61DAFB" strokeWidth="1" transform="rotate(60 8 8)"/>
      <ellipse cx="8" cy="8" rx="6.5" ry="2.5" stroke="#61DAFB" strokeWidth="1" transform="rotate(120 8 8)"/>
      <circle cx="8" cy="8" r="1.2" fill="#61DAFB"/>
    </svg>
  );
}

function HtmlIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <path d="M3 2L4.2 13.2 8 14.5l3.8-1.3L13 2H3z" fill="#E44D26"/>
      <path d="M8 3.5v9.5l2.8-1 .9-8.5H8z" fill="#F16529"/>
      <path d="M6 6h4.5l-.2 2H6.3l.2 2h3.5l-.3 2.5L8 13l-1.7-.5-.1-1.5" stroke="#fff" strokeWidth=".8" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function CssIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <path d="M3 2L4.2 13.2 8 14.5l3.8-1.3L13 2H3z" fill="#1572B6"/>
      <path d="M8 3.5v9.5l2.8-1 .9-8.5H8z" fill="#33A9DC"/>
      <path d="M6 6h4.5l-.15 1.5H6.2l.15 1.5h3.8l-.3 3L8 13l-1.8-.5-.15-1.5" stroke="#fff" strokeWidth=".8" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function JsonIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <path d="M5 3C4 3 3.5 3.8 3.5 4.5V6c0 .8-.5 1.2-1 1.5v1c.5.3 1 .7 1 1.5v1.5c0 .7.5 1.5 1.5 1.5" stroke="#F7DF1E" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
      <path d="M11 3c1 0 1.5.8 1.5 1.5V6c0 .8.5 1.2 1 1.5v1c-.5.3-1 .7-1 1.5v1.5c0 .7-.5 1.5-1.5 1.5" stroke="#F7DF1E" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function MarkdownIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="#519ABA" strokeWidth="1.2" fill="none"/>
      <path d="M3.5 10V6l2 2.5L7.5 6v4" stroke="#519ABA" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 10V7l1.5 1.5M11 7l-1.5 1.5" stroke="#519ABA" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function GoIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#00ADD8"/>
      <text x="8" y="11.5" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="system-ui">Go</text>
    </svg>
  );
}

function RustIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="#DEA584" strokeWidth="1.2" fill="none"/>
      <circle cx="8" cy="8" r="3" stroke="#DEA584" strokeWidth="1.2" fill="none"/>
      <path d="M8 1.5V4M8 12v2.5M1.5 8H4M12 8h2.5M3.4 3.4l1.8 1.8M10.8 10.8l1.8 1.8M3.4 12.6l1.8-1.8M10.8 5.2l1.8-1.8" stroke="#DEA584" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

function ShellIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="#89E051" strokeWidth="1.2" fill="none"/>
      <path d="M4.5 6l2.5 2-2.5 2" stroke="#89E051" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.5 11h3" stroke="#89E051" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function YamlIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#CB171E"/>
      <text x="8" y="11.5" textAnchor="middle" fill="#fff" fontSize="6.5" fontWeight="700" fontFamily="system-ui">YML</text>
    </svg>
  );
}

function DockerIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <path d="M1 8.5h2.5v-2H1zM4 8.5h2.5v-2H4zM7 8.5h2.5v-2H7zM4 6h2.5V4H4zM7 6h2.5V4H7zM10 8.5h2.5v-2H10z" fill="#384D54"/>
      <path d="M14.5 8c-.3-.2-1-.3-1.5-.2-.1-.6-.5-1.1-1-1.5l-.3-.2-.2.3c-.3.4-.4 1-.3 1.5.1.4.2.7.5 1-1 .5-2.3.3-7.3.3C3 10.5 3.4 12 4 13c.5.8 1.5 1.5 3 1.5 3 0 5.2-1.4 6.3-4 .7 0 1.5 0 2-.8l.1-.3-.9-.4z" fill="#384D54"/>
    </svg>
  );
}

function GitIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <path d="M14.5 7.3L8.7 1.5a.8.8 0 0 0-1.1 0l-1.2 1.2 1.5 1.5a1 1 0 0 1 1.3 1.3l1.4 1.4a1 1 0 1 1-.6.6L8.7 6.1v3.7a1 1 0 1 1-.8 0V6a1 1 0 0 1-.5-1.3L6 3.2 1.8 7.3a.8.8 0 0 0 0 1.1l5.8 5.8a.8.8 0 0 0 1.1 0l5.8-5.8a.8.8 0 0 0 0-1.1z" fill="#F05032"/>
    </svg>
  );
}

function SqlIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <ellipse cx="8" cy="4" rx="5.5" ry="2" fill="none" stroke="#E38C00" strokeWidth="1.2"/>
      <path d="M2.5 4v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4" stroke="#E38C00" strokeWidth="1.2" fill="none"/>
      <path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" stroke="#E38C00" strokeWidth="1.2" fill="none"/>
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="#A074C4" strokeWidth="1.2" fill="none"/>
      <circle cx="5.5" cy="5.5" r="1.5" fill="#A074C4"/>
      <path d="M2 12l3-3.5 2.5 2 3-4L14 12" stroke="#A074C4" strokeWidth="1" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

function SvgIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="#FFB13B" strokeWidth="1.2" fill="none"/>
      <path d="M5 9.5L7.5 5 10 9.5" stroke="#FFB13B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="11" cy="6" r="1" fill="#FFB13B"/>
    </svg>
  );
}

function CppIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#659AD2"/>
      <text x="8" y="11.5" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700" fontFamily="system-ui">C+</text>
    </svg>
  );
}

function JavaIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="2" fill="#B07219"/>
      <text x="8" y="11.5" textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="700" fontFamily="system-ui">J</text>
    </svg>
  );
}

function VueIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <path d="M1 1.5h3.5L8 7.5l3.5-6H15L8 14.5z" fill="#41B883"/>
      <path d="M4.5 1.5L8 7.5l3.5-6H10L8 5 6 1.5z" fill="#34495E"/>
    </svg>
  );
}

function SvelteIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 16 16" fill="none">
      <path d="M13 3.5C11.5 1 8 .5 6 2.5L3.5 5c-1.5 1.5-1.5 3.5 0 4.5.5.5 1.5 1 2 1l-.5-1c-1-1-1-2 0-3l2.5-2.5c1-1 2.5-1 3.5 0s1 2.5 0 3.5" stroke="#FF3E00" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M3 12.5C4.5 15 8 15.5 10 13.5L12.5 11c1.5-1.5 1.5-3.5 0-4.5-.5-.5-1.5-1-2-1l.5 1c1 1 1 2 0 3L8.5 12c-1 1-2.5 1-3.5 0s-1-2.5 0-3.5" stroke="#FF3E00" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function DefaultFileIcon() {
  return (
    <svg width={S} height={S} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M8 1H3.5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4.5L8 1z" />
      <path d="M8 1v3.5h3.5" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.FC> = {
  py: PythonIcon,
  ts: TypeScriptIcon,
  tsx: ReactIcon,
  jsx: ReactIcon,
  js: JavaScriptIcon,
  mjs: JavaScriptIcon,
  cjs: JavaScriptIcon,
  html: HtmlIcon,
  htm: HtmlIcon,
  css: CssIcon,
  scss: CssIcon,
  less: CssIcon,
  json: JsonIcon,
  tsconfig: TypeScriptIcon,
  npm: JsonIcon,
  md: MarkdownIcon,
  mdx: MarkdownIcon,
  go: GoIcon,
  rs: RustIcon,
  rust: RustIcon,
  sh: ShellIcon,
  bash: ShellIcon,
  zsh: ShellIcon,
  fish: ShellIcon,
  yaml: YamlIcon,
  yml: YamlIcon,
  dockerfile: DockerIcon,
  git: GitIcon,
  gitignore: GitIcon,
  sql: SqlIcon,
  png: ImageIcon,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  gif: ImageIcon,
  webp: ImageIcon,
  ico: ImageIcon,
  svg: SvgIcon,
  cpp: CppIcon,
  c: CppIcon,
  h: CppIcon,
  hpp: CppIcon,
  java: JavaIcon,
  vue: VueIcon,
  svelte: SvelteIcon,
};

export const FileTypeIcon = React.memo(function FileTypeIcon({ fileName, size = 14 }: FileIconProps) {
  const ext = getExt(fileName);
  const IconComponent = ICON_MAP[ext];

  if (IconComponent) {
    return (
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, flexShrink: 0 }}>
        <IconComponent />
      </span>
    );
  }

  return <DefaultFileIcon />;
});
