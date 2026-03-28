# Changelog

## v0.2.0 - 2026-03-28

### Distribution and CI

- Electron Forge packaging with DMG and ZIP makers for arm64 and x64
- Code signing, notarization, and stapling for macOS distribution
- GitHub Actions CI/CD pipeline with build, test, and release jobs
- Automated GitHub Releases with versioned tags and a rolling `latest` alias
- Lint, typecheck, and coverage quality gates in CI
- ASAR fuses enabled for hardened runtime security
- Single-instance lock to prevent multiple app windows conflicting
- Window state persistence across sessions
- Structured logging via electron-log
- Auto-update support via update-electron-app

### Security

- Context isolation enforced via contextBridge in preload
- Node integration disabled in renderer
- WebSecurity, sandbox, and remote module restrictions applied

## v0.1.0 - 2026-03-20

### Initial Release

- Frosted-glass terminal emulator built on Electron and xterm.js
- Tabbed interface with split pane support via react-mosaic
- SSH remote connections with host management
- Integrated file explorer with local and remote filesystem support
- Monaco-based file editor
- WebGL-accelerated terminal rendering
- CLI tool (`vpr`) for opening files from the terminal
- Zustand state management for tabs, panes, and sidebar
