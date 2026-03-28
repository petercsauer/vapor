# Architecture

Vapor follows Electron's multi-process architecture with clear separation between main process, renderer process, and preload scripts.

## Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Main Process                               │
│  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌────────┐          │
│  │ PTY Manager│  │  Config  │  │   Layout   │  │  Menu  │          │
│  └────────────┘  └──────────┘  └────────────┘  └────────┘          │
│  ┌────────────┐  ┌──────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ Tab Namer  │  │FS Handler│  │Remote FS Hdl│  │Host Manager   │  │
│  └────────────┘  └──────────┘  └─────────────┘  └───────────────┘  │
│  ┌────────────┐  ┌──────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │SSH Handler │  │SSH Pool  │  │Remote Context│  │CLI Server    │  │
│  └────────────┘  └──────────┘  └─────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                            ↕ IPC
┌─────────────────────────────────────────────────────────────┐
│                      Preload Script                         │
│         Exposes secure API via contextBridge                │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    React App                         │  │
│  │  ┌──────────┐  ┌───────────┐  ┌─────────────────┐  │  │
│  │  │ Zustand  │  │Components │  │   Custom Hooks  │  │  │
│  │  │  Stores  │  │           │  │                 │  │  │
│  │  └──────────┘  └───────────┘  └─────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              xterm.js / Monaco Editor                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Main Process (src/index.ts)

The main process is responsible for:
- Creating and managing the BrowserWindow
- Setting up IPC handlers
- Managing application lifecycle
- Setting native window properties (vibrancy, transparency)

### Key Modules

#### PTY Manager (src/main/pty-manager.ts)

Manages pseudoterminal sessions using node-pty:

**Responsibilities:**
- Spawn shell processes with custom environments
- Handle shell integration (OSC sequences)
- Track process context (CWD, command, PID)
- Detect SSH connections and Docker containers
- Parse remote prompts for hostname/CWD
- Clean up temp files and timeouts

**Key Functions:**
- `setupPtyHandlers()` - Register IPC handlers
- `parseOsc7()` - Parse OSC 7 (directory change)
- `parseOsc133D()` - Parse OSC 133;D (command exit status)
- `parseRemotePrompt()` - Extract SSH host/CWD from prompt
- `parseContainerName()` - Extract Docker container name

#### Config Manager (src/main/config.ts)

Manages user configuration:

**Config Location:** `~/Library/Application Support/Vapor/config.json` (via Electron `app.getPath("userData")`)

**Features:**
- JSON-based configuration with deep-merge of user overrides onto defaults
- Default config generation on first launch
- In-memory cache with invalidation on `config:set` IPC
- `broadcastConfig()` pushes updates to all renderer windows
- Type-safe config interface (`VaporConfig`)

#### Layout Manager (src/main/layout-manager.ts)

Persists and restores window layouts:

**Storage:** `~/Library/Application Support/Vapor/layouts.json` (via Electron `app.getPath("userData")`)

**Capabilities:**
- Save multi-tab, multi-pane layouts
- Capture terminal CWD and commands
- Restore layouts on demand
- Named layouts for quick switching

#### Tab Namer (src/main/tab-namer.ts)

Generates smart tab names based on terminal context:

**Naming Strategy:**
- Extracts meaningful names from:
  - Current directory basename
  - Running process (git, vim, docker, etc.)
  - SSH hostname
  - Docker container name
- Falls back to default name if no context

#### FS Handler (src/main/fs-handler.ts)

Provides local file system operations for the sidebar:

**Operations:**
- `fs:open-folder` - Open folder picker dialog
- `fs:readdir` - List directory contents
- `fs:read-file` / `fs:write-file` - File I/O
- `fs:stat` - File metadata
- `fs:rename` / `fs:delete` / `fs:mkdir` - File operations
- `fs:git-root` - Find git repository root
- `fs:show-in-folder` - Reveal in Finder
- `fs:open-path` - Open file with system default
- `fs:copy-to` - Copy file to destination
- `fs:clipboard-copy-path` - Copy path to clipboard
- `fs:watch` / `fs:changed` - Directory watcher with recursive fs.watch

#### Remote FS Handler (src/main/remote-fs-handler.ts)

Provides remote file system operations over SSH:

**Strategy:** Prefers SFTP via ssh-connection-pool, falls back to shell commands via ssh-shell-executor. Maintains a capability cache with 5-minute TTL.

**Operations:** `fs:remote:readdir`, `fs:remote:read-file`, `fs:remote:write-file`, `fs:remote:stat`, `fs:remote:rename`, `fs:remote:delete`, `fs:remote:mkdir`

#### SSH Handler (src/main/ssh-handler.ts)

Manages SSH connections via the connection pool:
- `ssh:connect` - Connect to SSH host
- `ssh:disconnect` - Disconnect from host
- `ssh:list-connections` - List active connections

#### SSH Connection Pool (src/main/ssh-connection-pool.ts)

SFTP connection pooling with ssh2:
- Per-host SFTP connections with deduplication
- Health checking every 30 seconds
- Reconnect with exponential backoff (max 3 attempts)
- Reads `~/.ssh/config` for connection parameters
- Uses `SSH_AUTH_SOCK` or default key files

#### Host Manager (src/main/host-manager.ts)

Discovers and manages SSH/Docker hosts:
- Reads `~/.ssh/config` for SSH hosts
- Lists Docker containers via `docker ps`
- Maintains recent hosts list (max 20, persisted in user data)

#### Remote Context (src/main/remote-context.ts)

Abstraction for remote FS operations:
- `SSHRemoteContext` - Uses ssh-shell-executor
- `DockerRemoteContext` - Uses `docker exec` commands

#### CLI Server (src/main/cli-server.ts)

Unix domain socket server at `~/.vapor/cli.sock` for the `vpr` CLI tool:
- Accepts JSON messages over socket
- Supports `open` action to open files in editor panes

#### Settings Window (src/main/settings-window.ts)

Opens a dedicated settings window for GUI configuration editing.

#### Menu (src/main/menu.ts)

Native application menu with:
- File operations (New Tab, Close Tab, etc.)
- Edit operations (Copy, Paste, etc.)
- View operations (Split Pane, Toggle Sidebar)
- Window operations (Minimize, Zoom)
- Keyboard shortcuts

## Preload Script (src/preload.ts)

Acts as a secure bridge between main and renderer processes:

**Security:**
- Uses `contextBridge.exposeInMainWorld()`
- No direct Node.js access in renderer
- Type-safe API contract

**Exposed API:**
```typescript
window.vapor = {
  pty: {
    create, input, resize, kill, getInfo,
    onOutput, onExit, onCommandStatus,
    getContext, getState, onStateUpdated,
  },
  ssh: { connect, disconnect, listConnections },
  tabNamer: { available, suggest },
  hosts: {
    listSSHConfigHosts, listDockerContainers,
    getRecent, addRecent, removeRecent,
  },
  layouts: { list, save, delete },
  config: { get, getPath, set, onUpdated },
  fs: {
    openFolder, readdir, readFile, writeFile, stat,
    rename, delete, mkdir, gitRoot, watch, onChanged,
    showInFolder, openPath, copyTo, clipboardCopyPath,
    remote: { readdir, readFile, writeFile, stat, rename, delete, mkdir },
  },
  openExternal: (url) => void,
  onMenuAction: (callback) => unsubscribe,
  onSwipeTab: (callback) => unsubscribe,
  onCliOpenFile: (callback) => unsubscribe,
}
```

## Renderer Process (src/renderer/)

React-based UI with functional components and hooks.

### State Management (src/renderer/store/)

Zustand stores provide lightweight state management:

#### Tabs Store (tabs.ts)

Store hook: `useTabPaneStore`

**State:**
- `tabs: Tab[]` - All tabs
- `activeTabId: string` - Currently active tab
- `moveMode: boolean` - Pane move/swap mode
- `commandStatuses` - Exit codes for commands
- `sshHosts` - SSH hostnames per tab
- `containerNames` - Docker container names per tab
- `pinnedHosts` - Pinned SSH/Docker hosts per tab
- `paneCwds` - Working directories per pane
- `paneGitRoots` - Git roots per pane
- `paneRemoteCwds` - Remote working directories per pane
- `sessionStates` - Session state tracking

**Actions:**
- `createTab()` / `createTabWithHost()` - Create new tab
- `closeTab()` - Close tab and kill PTY sessions
- `activateTab()` - Switch active tab
- `setTabTitle()` / `renameTab()` - Set tab name
- `reorderTabs()` - Drag-to-reorder tabs
- `splitPane()` - Split terminal pane
- `closePane()` - Close pane
- `resizePane()` - Adjust split ratio
- `setFocusedPane()` - Focus a pane
- `openEditorPane()` - Open Monaco editor
- `swapPanes()` / `toggleMoveMode()` - Pane move mode
- `captureLayout()` / `restoreLayout()` - Layout persistence

#### Panes Store (panes.ts)

**Data Structure:**
```typescript
type PaneNode =
  | { type: "terminal"; id: string; sessionId: string }
  | { type: "editor"; id: string; filePath: string }
  | { type: "split"; id: string; direction: "horizontal" | "vertical";
      ratio: number; children: [PaneNode, PaneNode] }
```

**Functions:**
- `findNode()` - Traverse tree to find pane
- `updateNode()` - Update pane and propagate changes
- `firstLeafId()` - Find first terminal/editor
- `collectSessionIds()` - Get all PTY sessions
- `findAdjacentPane()` - Keyboard navigation
- `paneNodeToMosaic()` / `mosaicToPaneNode()` - Convert to/from react-mosaic format

#### Editor Store (editor.ts)

Multi-file Monaco editor state:
- `openFiles: Map` - Open files with content and dirty state
- `tabOrder: string[]` - Editor tab ordering
- `activeFile: string | null` - Currently focused file
- Per-file `dirty: boolean` - Unsaved changes tracking

#### Sidebar Store (sidebar.ts)

File tree state:
- `pinnedPath: string | null` - Pinned root directory
- `expandedDirs: Set<string>` - Expanded directories
- `dirCache: Map` - Cached directory listings
- `width: number` - Sidebar width
- `currentRemoteHost: string | null` - Remote host for remote file browsing

#### Navigation Store (navigation.ts)

Keyboard navigation state for pane switching.

#### Config Store (config.ts)

Application configuration state loaded from main process.

### Components

#### App.tsx (src/renderer/App.tsx)

Root component that:
- Loads configuration on mount
- Creates initial tab
- Sets up event listeners (PTY events, menu actions, keyboard)
- Applies background transparency/opacity CSS variables
- Renders Header, Sidebar, and SplitView within DndProvider

#### Header.tsx

Top bar with:
- Tab list with drag-to-reorder
- New tab button
- Layout dropdown

#### TabChrome.tsx / Tab.tsx

Individual tab UI:
- Tab title (editable on double-click)
- Close button
- SSH/Docker badges
- Command status indicator
- Active/inactive styling

#### SplitView.tsx

Recursive component for split panes:
- Uses react-mosaic-component
- Renders terminals and editors as leaves
- Handles drag-to-resize
- Provides split/close controls

#### TerminalPane.tsx

xterm.js integration:
- Creates terminal instance
- Handles PTY I/O
- Implements search, copy, paste
- Manages fit-to-size
- WebGL renderer for performance

#### EditorPane.tsx

Monaco editor integration:
- Syntax highlighting
- File save
- Close editor

#### Sidebar.tsx

File tree sidebar:
- Recursive directory rendering
- File/folder icons
- Expand/collapse
- Open file in editor

#### FileTree.tsx

Tree view component with recursive directory rendering.

#### FileTreeContextMenu.tsx

Right-click context menu for file tree (create, rename, delete, reveal).

#### FileIcon.tsx

File type icon component (`FileTypeIcon`) based on file extension.

#### SearchBox.tsx

Terminal search UI wrapping xterm.js SearchAddon.

#### HostDropdown.tsx

Dropdown for connecting to SSH hosts and Docker containers.

#### LayoutDropdown.tsx

Dropdown for saving and restoring window layouts.

#### SettingsModal.tsx

Modal dialog for editing application settings.

#### ErrorBoundary.tsx

React error boundary (`PaneErrorBoundary` / `AppErrorBoundary`) for graceful error handling.

### Custom Hooks (src/renderer/hooks/)

#### usePtyEvents.ts

Subscribes to PTY output/exit events and updates state.

#### useTabNaming.ts

Automatically updates tab names based on terminal context.

#### useMenuActions.ts

Handles menu actions from main process.

#### useKeyboardNavigation.ts

Implements keyboard shortcuts for pane navigation.

## Data Flow

### Terminal Creation Flow

1. User clicks "New Tab" → `createTab()` in store
2. Store calls `vapor.pty.create()` → IPC to main
3. Main process spawns PTY → returns sessionId
4. Store updates `tabs` with new terminal pane
5. React renders `TerminalPane` component
6. Component creates xterm.js instance
7. xterm.js sends input → `vapor.pty.input()`
8. PTY output → IPC event → `usePtyEvents` hook → xterm.js

### Split Pane Flow

1. User presses `Cmd+D` → `splitPane(paneId, direction)`
2. Find target pane in tree
3. Create new PTY session
4. Replace target with split node containing [target, newTerminal]
5. Update tree in store
6. React re-renders `SplitView` with new structure

### Layout Save/Restore Flow

**Save:**
1. `captureLayout()` traverses pane tree
2. For each terminal: get context (CWD, command)
3. Build `SavedPaneNode` tree
4. Send to main → save to `~/.vapor/layouts.json`

**Restore:**
1. Load layout from main
2. `restoreLayout(savedTabs)` kills existing sessions
3. Recursively build pane tree
4. For each terminal: create PTY with saved CWD/command
5. Update store with restored tabs

## Security Considerations

- **Context Isolation:** Enabled - renderer has no direct Node.js access
- **Node Integration:** Disabled in renderer
- **Context Bridge:** All IPC goes through typed API
- **External Links:** Validated before opening
- **File Operations:** Sandboxed to user-selected directories

## Performance Optimizations

- **WebGL Renderer:** xterm.js uses WebGL for fast rendering (DOM fallback)
- **Lazy Rendering:** Hidden tabs use `display: none`, only active tab renders
- **Memoization:** React.memo on expensive components
- **SFTP Capability Cache:** 5-minute TTL for remote FS capability detection
- **SSH Config Cache:** In-memory cache for `~/.ssh/config` parsing
- **Debouncing:** File tree updates debounced
- **Virtual Scrolling:** Terminal buffer managed by xterm.js (10,000 line scrollback)

## Testing Strategy

- **Unit Tests:** Vitest for stores, utilities, handlers
- **Component Tests:** React Testing Library with jsdom
- **Test Environment:** jsdom via vitest.config.ts
- **Mock Infrastructure:** `src/test/vapor-mock.ts` provides `window.vapor` mock

See [Testing Guide](testing.md) for details.
