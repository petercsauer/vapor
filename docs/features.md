# Features

Vapor provides a rich set of features for an enhanced terminal experience.

## Table of Contents

- [Tab Management](#tab-management)
- [Split Panes](#split-panes)
- [File Sidebar](#file-sidebar)
- [Monaco Editor](#monaco-editor)
- [Smart Context Detection](#smart-context-detection)
- [Layout Management](#layout-management)
- [Shell Integration](#shell-integration)
- [Keyboard Navigation](#keyboard-navigation)
- [Search](#search)
- [Customization](#customization)

## Tab Management

### Creating Tabs

- **Keyboard:** `Cmd+T`
- **Menu:** File → New Tab
- **Click:** + button in tab bar

Each tab starts with a single terminal pane running your default shell.

### Switching Tabs

- **Keyboard:**
  - `Cmd+[` / `Cmd+]` - Previous/Next tab
  - `Cmd+1` through `Cmd+9` - Jump to specific tab
- **Mouse:** Click tab in tab bar
- **Trackpad:** Two-finger swipe left/right

### Closing Tabs

- **Keyboard:** `Cmd+W`
- **Menu:** File → Close Tab
- **Click:** × button on tab
- **Close All PTYs:** All terminal sessions in the tab are terminated

### Renaming Tabs

1. **Double-click** tab title
2. Type new name
3. Press **Enter** to save
4. Press **Escape** to cancel

**Smart Naming:**
- Tabs auto-update based on context (current directory, running process)
- Custom names persist and override auto-naming
- Clear custom name by entering blank name

### Reordering Tabs

**Drag and drop** tabs to reorder them in the tab bar.

## Split Panes

### Creating Splits

- **Horizontal Split:** `Cmd+D`
  - Splits pane side-by-side
  - New pane on right
- **Vertical Split:** `Cmd+Shift+D`
  - Splits pane top-to-bottom
  - New pane on bottom

### Resizing Panes

**Drag** the divider between panes to resize.

**Constraints:**
- Minimum size: 10% of parent
- Maximum size: 90% of parent

### Closing Panes

- **Keyboard:** `Cmd+W` (closes focused pane)
- **Click:** × button in pane corner
- **Last Pane:** Closing the last pane closes the tab

### Navigating Panes

- **Mouse:** Click in pane to focus
- **Keyboard:** `Option+Shift+Arrow` to move focus
  - `Option+Shift+Left` - Focus left pane
  - `Option+Shift+Right` - Focus right pane
  - `Option+Shift+Up` - Focus upper pane
  - `Option+Shift+Down` - Focus lower pane

## File Sidebar

### Opening Sidebar

- **Keyboard:** `Cmd+B`
- **Menu:** View → Toggle Sidebar

### Selecting Root Folder

1. Click folder icon in sidebar header
2. Choose directory in system dialog
3. Sidebar shows file tree

### Navigation

- **Expand/Collapse:** Click folder name or arrow icon
- **Open File:** Double-click file name
- **Select:** Single-click to select (shows in editor)

### File Operations

- **Create File:** Right-click → New File
- **Create Folder:** Right-click → New Folder
- **Rename:** Right-click → Rename
- **Delete:** Right-click → Delete
- **Reveal in Finder:** Right-click → Show in Finder

### Git Integration

- **Git Root Detection:** Automatically finds `.git` directory
- **Status Indicators:** (planned)
  - Modified files
  - Untracked files
  - Staged changes

## Monaco Editor

### Opening Files

**From Sidebar:** Double-click file in file tree

**From Terminal:**
```bash
# Not yet implemented - planned feature
vapor /path/to/file
```

### Editor Features

- **Syntax Highlighting:** Auto-detected by file extension
- **Line Numbers:** Always visible
- **Minimap:** Code overview on right
- **Find/Replace:** `Cmd+F` to find, `Cmd+Option+F` to replace
- **Multi-cursor:** `Cmd+D` to select next occurrence
- **Go to Definition:** `Cmd+Click` or `F12`

### Saving Files

- **Keyboard:** `Cmd+S`
- **Auto-save:** (planned) Optional auto-save on focus loss

### Closing Editor

- **Keyboard:** `Cmd+W`
- **Click:** × button in editor pane

**Note:** Only one editor pane allowed per tab (opens in existing if present)

## Smart Context Detection

### SSH Detection

Vapor automatically detects SSH connections:

**Detection Methods:**
1. **OSC 7 Sequence:** `hostname` in sequence
2. **Prompt Parsing:** Debian/RHEL-style prompts
3. **SSH Config:** Reads `~/.ssh/config` for known hosts

**Visual Indicators:**
- Green badge with hostname in tab

**Tab Naming:**
- Tabs auto-update with SSH hostname
- Example: "example.com:/home/user"

### Docker Container Detection

Detects when running inside Docker container:

**Detection Methods:**
1. **Container Name:** Parsed from `docker exec` command
2. **Process Tree:** Identifies Docker process

**Visual Indicators:**
- Blue badge with container name in tab

### Remote Directory Tracking

Tracks working directory on remote systems:

**OSC 7 Support:**
- Remote shells send directory updates
- Displayed in tab title
- Used for layout restore

**Fallback:**
- Parses prompt for CWD if OSC 7 unavailable

### Command Status

Shows command exit status:

**Visual Indicators:**
- Green indicator for success (exit 0)
- Red indicator for failure (exit non-zero)
- Appears briefly after command completes

**Implementation:**
- OSC 133;D sequence from shell integration
- Fades after 3 seconds (`COMMAND_STATUS_DISPLAY_MS = 3000`)

## Layout Management

### Saving Layouts

**Method 1: Named Layout**
1. Menu → View → Save Layout...
2. Enter layout name
3. Click Save

**Method 2: Auto-save** (planned)
- Layouts auto-saved on quit
- Restored on launch

### What's Saved

Per Tab:
- Tab name
- Pane structure (splits, ratios)
- Terminal CWDs
- Running commands (for restore)
- Sidebar visibility

Not Saved:
- Terminal scrollback history
- Editor content (files saved separately)
- Temporary state

### Restoring Layouts

**From Menu:**
1. Menu → View → Restore Layout
2. Select saved layout
3. Current tabs closed
4. Layout restored

**Restore Behavior:**
- Creates PTY sessions with saved CWDs
- Re-runs saved commands (if any)
- Restores split ratios
- Sets tab names

### Managing Layouts

**List Layouts:**
- Menu → View → Manage Layouts

**Delete Layout:**
- Select layout → Delete

**Storage:**
- Layouts saved in `~/.vapor/layouts.json`

## Shell Integration

Vapor provides enhanced terminal features through shell integration.

### Supported Shells

- **zsh** - Full support
- **bash** - Full support
- **fish** - Partial support (planned)

### Features Provided

#### Command Tracking

**OSC 133 Sequences:**
- `OSC 133;A` - Prompt start
- `OSC 133;B` - Command start
- `OSC 133;C` - Command executed
- `OSC 133;D;exitcode` - Command completed

**Use Cases:**
- Command status indicators
- Jump to command (planned)
- Command history (planned)

#### Directory Tracking

**OSC 7 Sequence:**
```
\e]7;file://hostname/path\e\\
```

**Benefits:**
- Tab names reflect current directory
- New splits inherit CWD
- Layout restore preserves CWD

### Setup

**Automatic:**
- Vapor automatically injects shell integration
- No manual setup required

**Manual (if needed):**

**zsh:**
```zsh
# Add to ~/.zshrc
__vapor_precmd() {
  local e=$?
  print -Pn "\e]133;D;${e}\a"
  return $e
}
__vapor_preexec() {
  print -Pn "\e]133;C\a"
}
precmd_functions+=(__vapor_precmd)
preexec_functions+=(__vapor_preexec)
```

**bash:**
```bash
# Add to ~/.bashrc
__vapor_prompt() {
  local e=$?
  printf "\e]133;D;%d\a" "$e"
  return $e
}
PROMPT_COMMAND="__vapor_prompt${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
```

## Keyboard Navigation

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+T` | New tab |
| `Cmd+N` | New window |
| `Cmd+W` | Close tab/pane |
| `Cmd+Q` | Quit application |
| `Cmd+,` | Settings |
| `Cmd+K` | Clear terminal |
| `Cmd+F` | Find in terminal |
| `Cmd+Shift+O` | Open folder |

### Tab Navigation

| Shortcut | Action |
|----------|--------|
| `Cmd+[` | Previous tab |
| `Cmd+]` | Next tab |
| `Cmd+1-9` | Jump to tab 1-9 |
| `Cmd+Shift+[` | Move tab left |
| `Cmd+Shift+]` | Move tab right |

### Pane Navigation

| Shortcut | Action |
|----------|--------|
| `Cmd+D` | Split horizontal |
| `Cmd+Shift+D` | Split vertical |
| `Option+Shift+Left` | Focus left pane |
| `Option+Shift+Right` | Focus right pane |
| `Option+Shift+Up` | Focus up pane |
| `Option+Shift+Down` | Focus down pane |

### Terminal Operations

| Shortcut | Action |
|----------|--------|
| `Cmd+C` | Copy (with selection) |
| `Cmd+V` | Paste |
| `Cmd+K` | Clear scrollback |
| `Cmd+F` | Search |
| `Cmd++` | Increase font size |
| `Cmd+-` | Decrease font size |
| `Cmd+0` | Reset font size |

### Editor Operations

| Shortcut | Action |
|----------|--------|
| `Cmd+S` | Save file |
| `Cmd+F` | Find |
| `Cmd+H` | Replace |
| `Cmd+G` | Find next |
| `Cmd+Shift+G` | Find previous |
| `Cmd+/` | Toggle comment |

## Search

### Terminal Search

**Open Search:** `Cmd+F`

**Features:**
- **Case Sensitive:** Toggle with button
- **Whole Word:** Match entire words only
- **Regex:** Use regular expressions
- **Navigate Results:** Enter to find next, Shift+Enter to find previous

### Editor Search

**Open Search:** `Cmd+F` (in editor)

**Features:**
- Find and replace
- Match case
- Whole word
- Regular expression
- Multi-file search (planned)

## Customization

### Appearance

**Vibrancy:**
- Frosted glass effect (requires `background.transparent: true`)
- Configurable in settings or config file
- Options: `under-window`, `fullscreen-ui`, `header`, `sidebar`

**Transparency:**
- Adjust background alpha in theme
- Example: `"background": "rgba(0, 0, 0, 0.7)"`

**Colors:**
- Full 16-color ANSI palette
- Cursor, selection, foreground, background
- See [Configuration](configuration.md)

### Fonts

**Font Family:**
- Any installed monospace font
- Ligature support (if font provides)

**Font Size:**
- 8-32 pixels
- `Cmd++` / `Cmd+-` to adjust on-the-fly

### Shell

**Custom Shell:**
- Configure path and arguments
- Example: fish, dash, custom shell

**Environment:**
- Inherits parent environment
- Vapor adds `VAPOR_SHELL_INTEGRATION=1`

## Advanced Features

### Move Mode (Experimental)

Reorganize panes by moving them:

1. Enable move mode (planned feature)
2. Click pane to select
3. Click destination to move
4. Exit move mode

### Command Palette (Planned)

Quick access to all commands:
- `Cmd+Shift+P` to open
- Type to filter
- Enter to execute

### Profiles (Planned)

Save terminal configurations:
- Shell settings
- Environment variables
- Starting directory
- Window size
