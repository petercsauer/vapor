# Configuration

Vapor is highly configurable through a JSON configuration file stored in the Electron user data directory.

## Configuration File Location

The config file is created automatically on first launch with sensible defaults:

- **macOS:** `~/Library/Application Support/Vapor/config.json`

The path is determined by Electron's `app.getPath("userData")`.

## Configuration Schema

```json
{
  "font": {
    "family": "SFMono Nerd Font, SF Mono, Monaco, monospace",
    "size": 12,
    "ligatures": true
  },
  "shell": {
    "path": "",
    "args": []
  },
  "theme": {
    "background": "rgba(0, 0, 0, 0.65)",
    "foreground": "#FFFFFF",
    "cursor": "#0095FF",
    "selectionBackground": "rgba(0, 149, 255, 0.65)",
    "black": "rgba(0, 0, 0, 0.65)",
    "red": "#FF3B30",
    "green": "#4CD964",
    "yellow": "#FFCC00",
    "blue": "#0095FF",
    "magenta": "#FF2D55",
    "cyan": "#5AC8FA",
    "white": "#FFFFFF",
    "brightBlack": "#686868",
    "brightRed": "#FF3B30",
    "brightGreen": "#4CD964",
    "brightYellow": "#FFCC00",
    "brightBlue": "#0095FF",
    "brightMagenta": "#FF2D55",
    "brightCyan": "#5AC8FA",
    "brightWhite": "#FFFFFF"
  },
  "vibrancy": "under-window",
  "background": {
    "transparent": true,
    "opaqueColor": "#121212"
  },
  "layouts": {
    "restoreReplacesExisting": false
  },
  "window": {
    "width": 800,
    "height": 600
  }
}
```

## Configuration Options

### Font Settings

#### `font.family`
- **Type:** `string`
- **Default:** `"SFMono Nerd Font, MesloLGS NF, MesloLGS Nerd Font, Hack Nerd Font, FiraCode Nerd Font, JetBrainsMono Nerd Font, SF Mono, Monaco, Inconsolata, Fira Mono, Droid Sans Mono, Source Code Pro, monospace"`
- **Description:** Font family name (CSS font stack, first available is used). Common monospace fonts:
  - `"Menlo"` - macOS default
  - `"Monaco"` - Classic macOS
  - `"SF Mono"` - Apple's modern monospace
  - `"Fira Code"` - Popular with ligature support
  - `"JetBrains Mono"` - IDE font with ligatures
  - `"Source Code Pro"` - Adobe's monospace
  - `"Cascadia Code"` - Microsoft's ligature font

**Example:**
```json
{
  "font": {
    "family": "Fira Code"
  }
}
```

#### `font.size`
- **Type:** `number`
- **Default:** `12`
- **Description:** Font size in pixels

#### `font.ligatures`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable font ligatures (if font supports them)
  - Converts `=>` to ⇒
  - Converts `!=` to ≠
  - Converts `>=` to ≥
  - And many more

### Shell Settings

#### `shell.path`
- **Type:** `string`
- **Default:** `""` (empty string; Vapor will use `$SHELL` or fall back to `/bin/zsh`)
- **Description:** Path to shell executable. Leave empty to auto-detect.

**Common values:**
```json
""               // Auto-detect (recommended)
"/bin/zsh"       // Z shell
"/bin/bash"      // Bash
"/bin/fish"      // Fish shell
"/usr/local/bin/fish"  // Homebrew-installed fish
```

#### `shell.args`
- **Type:** `string[]`
- **Default:** `[]`
- **Description:** Arguments passed to shell on startup

**Examples:**
```json
{
  "shell": {
    "path": "/bin/bash",
    "args": ["--login"]
  }
}
```

```json
{
  "shell": {
    "path": "/bin/zsh",
    "args": ["-l"]
  }
}
```

### Theme Settings

All color values support:
- Hex: `"#FF0000"`
- RGB: `"rgb(255, 0, 0)"`
- RGBA: `"rgba(255, 0, 0, 0.5)"`

#### `theme.background`
- **Type:** `string` (color)
- **Default:** `"#000000"`
- **Description:** Terminal background color

#### `theme.foreground`
- **Type:** `string` (color)
- **Default:** `"#FFFFFF"`
- **Description:** Default text color

#### `theme.cursor`
- **Type:** `string` (color)
- **Default:** `"#0095FF"`
- **Description:** Cursor color

#### `theme.selectionBackground`
- **Type:** `string` (color)
- **Default:** `"rgba(0, 149, 255, 0.3)"`
- **Description:** Text selection background

#### ANSI Colors

Standard 16 ANSI colors:
- `theme.black` / `theme.brightBlack`
- `theme.red` / `theme.brightRed`
- `theme.green` / `theme.brightGreen`
- `theme.yellow` / `theme.brightYellow`
- `theme.blue` / `theme.brightBlue`
- `theme.magenta` / `theme.brightMagenta`
- `theme.cyan` / `theme.brightCyan`
- `theme.white` / `theme.brightWhite`

### Vibrancy Settings

#### `vibrancy`
- **Type:** `string`
- **Default:** `"under-window"`
- **Options:**
  - `"under-window"` - Background behind window (recommended)
  - `"fullscreen-ui"` - Fullscreen mode vibrancy
  - `"header"` - Header/toolbar style
  - `"sidebar"` - Sidebar style
- **Description:** macOS vibrancy effect type

**Note:** Vibrancy effects only work on macOS 10.10+

### Background Settings

#### `background.transparent`
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Enable transparent window background (required for vibrancy effect)

#### `background.opaqueColor`
- **Type:** `string` (color)
- **Default:** `"#121212"`
- **Description:** Background color when transparency is disabled

### Layout Settings

#### `layouts.restoreReplacesExisting`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Whether restoring a layout closes existing tabs

### Window Settings

#### `window.width`
- **Type:** `number`
- **Default:** `800`
- **Description:** Initial window width in pixels

#### `window.height`
- **Type:** `number`
- **Default:** `600`
- **Description:** Initial window height in pixels

## Example Configurations

### Light Theme

```json
{
  "theme": {
    "background": "#FFFFFF",
    "foreground": "#000000",
    "cursor": "#007AFF",
    "selectionBackground": "rgba(0, 122, 255, 0.2)",
    "black": "#000000",
    "red": "#C91B00",
    "green": "#00C200",
    "yellow": "#C7C400",
    "blue": "#0037DA",
    "magenta": "#C930C7",
    "cyan": "#00C5C7",
    "white": "#C7C7C7",
    "brightBlack": "#686868",
    "brightRed": "#FF6D67",
    "brightGreen": "#5FF967",
    "brightYellow": "#FEFB67",
    "brightBlue": "#6871FF",
    "brightMagenta": "#FF76FF",
    "brightCyan": "#5FFDFF",
    "brightWhite": "#FFFFFF"
  }
}
```

### Dracula Theme

```json
{
  "theme": {
    "background": "#282a36",
    "foreground": "#f8f8f2",
    "cursor": "#f8f8f0",
    "selectionBackground": "rgba(68, 71, 90, 0.5)",
    "black": "#21222c",
    "red": "#ff5555",
    "green": "#50fa7b",
    "yellow": "#f1fa8c",
    "blue": "#bd93f9",
    "magenta": "#ff79c6",
    "cyan": "#8be9fd",
    "white": "#f8f8f2",
    "brightBlack": "#6272a4",
    "brightRed": "#ff6e6e",
    "brightGreen": "#69ff94",
    "brightYellow": "#ffffa5",
    "brightBlue": "#d6acff",
    "brightMagenta": "#ff92df",
    "brightCyan": "#a4ffff",
    "brightWhite": "#ffffff"
  }
}
```

### Solarized Dark

```json
{
  "theme": {
    "background": "#002b36",
    "foreground": "#839496",
    "cursor": "#839496",
    "selectionBackground": "rgba(7, 54, 66, 0.5)",
    "black": "#073642",
    "red": "#dc322f",
    "green": "#859900",
    "yellow": "#b58900",
    "blue": "#268bd2",
    "magenta": "#d33682",
    "cyan": "#2aa198",
    "white": "#eee8d5",
    "brightBlack": "#002b36",
    "brightRed": "#cb4b16",
    "brightGreen": "#586e75",
    "brightYellow": "#657b83",
    "brightBlue": "#839496",
    "brightMagenta": "#6c71c4",
    "brightCyan": "#93a1a1",
    "brightWhite": "#fdf6e3"
  }
}
```

### Larger Font for Presentations

```json
{
  "font": {
    "family": "SF Mono",
    "size": 18,
    "ligatures": true
  }
}
```

### Custom Shell with Arguments

```json
{
  "shell": {
    "path": "/usr/local/bin/fish",
    "args": ["--login", "--interactive"]
  }
}
```

## Editing Configuration

### Method 1: Settings UI

1. Open Vapor
2. Press `Cmd+,` (or `Vapor -> Settings...`)
3. Edit font, theme, and shell settings
4. Changes apply immediately via IPC broadcast

### Method 2: Direct Edit

1. Open the config file in your editor:
   ```bash
   open ~/Library/Application\ Support/Vapor/config.json
   ```
2. Save changes
3. Restart Vapor (direct edits require restart)

### Method 3: From Vapor Menu

1. Open Vapor
2. Go to `Vapor -> Settings...` (or press `Cmd+,`)
3. The config file opens in your default editor

## Configuration Validation

Vapor validates the configuration on load. If the config file is missing or contains invalid JSON:
1. Falls back to defaults
2. Creates the config file with default values

## Advanced Configuration

### Shell Integration

Vapor automatically sets up shell integration for:
- **zsh** - Injects `.zshenv` with hooks
- **bash** - Uses `--rcfile` with integration script

Shell integration provides:
- Command status tracking (OSC 133)
- Directory tracking (OSC 7)
- Exit code indicators

To disable shell integration:
```bash
# Add to your shell rc file
unset VAPOR_SHELL_INTEGRATION
```

### Environment Variables

Vapor sets these environment variables:
- `VAPOR_SHELL_INTEGRATION=1` - Indicates Vapor terminal
- `COLORTERM=truecolor` - 24-bit color support
- `TERM=xterm-256color` - Terminal type

### Custom Vibrancy

For more control over appearance:
```json
{
  "vibrancy": "under-window",
  "background": {
    "transparent": true
  },
  "theme": {
    "background": "rgba(0, 0, 0, 0.7)"
  }
}
```

Adjust the theme background alpha (0.0 - 1.0) to control transparency level. The `background.transparent` flag must be `true` for vibrancy to work.

## Troubleshooting

### Config Not Loading

```bash
# Check if config file exists
ls -la ~/Library/Application\ Support/Vapor/config.json

# Check for JSON syntax errors
cat ~/Library/Application\ Support/Vapor/config.json | python3 -m json.tool
```

### Font Not Applying

1. Verify font is installed:
   ```bash
   # List available fonts
   fc-list | grep "FontName"
   ```
2. Use exact font name from Font Book app
3. Restart Vapor after changing font

### Shell Not Starting

1. Check shell path is correct:
   ```bash
   which zsh
   which bash
   ```
2. Verify shell has execute permissions
3. Check shell args are valid

### Colors Look Wrong

1. Verify hex color format: `#RRGGBB`
2. Check for typos in color names
3. Ensure all 16 ANSI colors are defined
4. Test in another terminal to isolate issue

## Default Configuration

If configuration file is deleted or corrupted, Vapor creates this default:

```json
{
  "font": {
    "family": "SFMono Nerd Font, MesloLGS NF, MesloLGS Nerd Font, Hack Nerd Font, FiraCode Nerd Font, JetBrainsMono Nerd Font, SF Mono, Monaco, Inconsolata, Fira Mono, Droid Sans Mono, Source Code Pro, monospace",
    "size": 12,
    "ligatures": true
  },
  "shell": {
    "path": "",
    "args": []
  },
  "theme": {
    "background": "rgba(0, 0, 0, 0.65)",
    "foreground": "#FFFFFF",
    "cursor": "#0095FF",
    "selectionBackground": "rgba(0, 149, 255, 0.65)",
    "black": "rgba(0, 0, 0, 0.65)",
    "red": "#FF3B30",
    "green": "#4CD964",
    "yellow": "#FFCC00",
    "blue": "#0095FF",
    "magenta": "#FF2D55",
    "cyan": "#5AC8FA",
    "white": "#FFFFFF",
    "brightBlack": "#686868",
    "brightRed": "#FF3B30",
    "brightGreen": "#4CD964",
    "brightYellow": "#FFCC00",
    "brightBlue": "#0095FF",
    "brightMagenta": "#FF2D55",
    "brightCyan": "#5AC8FA",
    "brightWhite": "#FFFFFF"
  },
  "vibrancy": "under-window",
  "background": {
    "transparent": true,
    "opaqueColor": "#121212"
  },
  "layouts": {
    "restoreReplacesExisting": false
  },
  "window": {
    "width": 800,
    "height": 600
  }
}
```
