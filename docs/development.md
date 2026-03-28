# Development Guide

This guide covers setting up your development environment, building, testing, and contributing to Vapor.

## Prerequisites

### Required

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **macOS** 10.15+ (for vibrancy features)
- **Xcode Command Line Tools** (for native module compilation)
- **Python 3** (for node-gyp)

### Recommended

- **Visual Studio Code** or similar IDE with TypeScript support
- **Git** for version control

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd vapor
npm install
```

The `postinstall` script will automatically rebuild native modules (node-pty) for Electron.

### 2. Verify Installation

```bash
# Should complete without errors
npm run postinstall

# Run tests to verify setup
npm test
```

### 3. Start Development Server

```bash
npm start
```

This launches Electron with webpack dev server and hot module reloading enabled.

## Project Structure

```
vapor/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── config.ts            # Configuration management
│   │   ├── pty-manager.ts       # PTY session handling
│   │   ├── tab-namer.ts         # Smart tab naming
│   │   ├── layout-manager.ts    # Layout save/restore
│   │   ├── fs-handler.ts        # Local file system operations
│   │   ├── remote-fs-handler.ts # Remote FS (SFTP/shell fallback)
│   │   ├── ssh-handler.ts       # SSH connection management
│   │   ├── ssh-connection-pool.ts # SFTP connection pooling
│   │   ├── ssh-shell-executor.ts  # Remote shell commands
│   │   ├── host-manager.ts      # SSH/Docker host discovery
│   │   ├── remote-context.ts    # Remote FS abstraction
│   │   ├── menu.ts              # Application menu
│   │   ├── cli-server.ts        # CLI socket server
│   │   ├── settings-window.ts   # Settings window
│   │   └── *.test.ts            # Co-located tests
│   │
│   ├── renderer/                # React application
│   │   ├── App.tsx              # Root component
│   │   ├── components/          # UI components
│   │   │   ├── Header.tsx
│   │   │   ├── TabChrome.tsx
│   │   │   ├── Tab.tsx
│   │   │   ├── SplitView.tsx
│   │   │   ├── TerminalPane.tsx
│   │   │   ├── EditorPane.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── FileTree.tsx
│   │   │   ├── FileIcon.tsx
│   │   │   ├── FileTreeContextMenu.tsx
│   │   │   ├── SearchBox.tsx
│   │   │   ├── HostDropdown.tsx
│   │   │   ├── LayoutDropdown.tsx
│   │   │   ├── SettingsModal.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── *.test.tsx
│   │   │
│   │   ├── store/               # Zustand state stores
│   │   │   ├── tabs.ts          # useTabPaneStore
│   │   │   ├── panes.ts         # Pane tree utilities
│   │   │   ├── editor.ts        # useEditorStore
│   │   │   ├── sidebar.ts       # useSidebarStore
│   │   │   ├── navigation.ts    # useNavigationStore
│   │   │   ├── config.ts        # useConfigStore
│   │   │   └── *.test.ts
│   │   │
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── usePtyEvents.ts
│   │   │   ├── useTabNaming.ts
│   │   │   ├── useMenuActions.ts
│   │   │   └── useKeyboardNavigation.ts
│   │   │
│   │   ├── api/                 # API abstractions
│   │   │   └── vapor.ts
│   │   │
│   │   ├── utils/               # Utility functions
│   │   │   └── color.ts
│   │   │
│   │   ├── index.tsx            # React entry point
│   │   ├── settings.tsx         # Settings window entry point
│   │   ├── screenshot-mode.ts   # Screenshot automation API
│   │   └── globals.css          # Global styles
│   │
│   ├── shared/                  # Shared types/constants
│   │   ├── types.ts
│   │   └── constants.ts
│   │
│   ├── test/                    # Test utilities
│   │   ├── setup.ts
│   │   ├── vapor-mock.ts
│   │   └── infrastructure.test.ts
│   │
│   ├── preload.ts               # IPC bridge
│   ├── index.ts                 # Electron entry point
│   ├── index.html               # Main window HTML
│   └── settings.html            # Settings window HTML
│
├── assets/                      # Icons and images
│   ├── icon.png
│   ├── icon.icns
│   ├── dmg-background.png
│   └── dmg-background@2x.png
│
├── bin/                         # CLI tool
│   └── vpr                      # Command-line interface
│
├── docs/                        # Documentation
│
├── marketing/                   # Website and screenshots
│
├── forge.config.ts              # Electron Forge config
├── webpack.main.config.ts       # Main process webpack
├── webpack.renderer.config.ts   # Renderer webpack
├── webpack.plugins.ts           # Shared webpack plugins
├── webpack.rules.ts             # Shared webpack rules
├── tsconfig.json                # TypeScript config
├── vitest.config.ts             # Vitest config
├── .eslintrc.json               # ESLint config
└── package.json
```

## Development Workflow

### Running in Development

```bash
# Start with hot reload
npm start

# The app will launch automatically
# Changes to src/ will trigger hot reload
```

### Building

```bash
# Package for current platform
npm run package

# Create distributable (DMG on macOS)
npm run make

# Build for specific architecture
npm run make -- --arch=arm64
npm run make -- --arch=x64
```

### Testing

```bash
# Run all tests once
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Run specific test file
npm test -- src/main/pty-manager.test.ts

# Run with coverage
npm test -- --coverage
```

### Linting

```bash
# Lint all TypeScript files
npm run lint

# Auto-fix linting issues
npm run lint -- --fix
```

## Code Style

### TypeScript

- Use `noImplicitAny: true` (enabled in tsconfig.json)
- Prefer **interfaces** for public APIs, **types** for unions/intersections
- Use **functional components** with hooks in React
- Avoid **any** - use proper types or **unknown**
- Export **types** alongside implementations

### React

- Use **functional components** only (no class components)
- Use **hooks** for state and effects
- Keep components **small and focused**
- Extract **custom hooks** for reusable logic
- Use **TypeScript** for props (no PropTypes)

### Naming Conventions

- **PascalCase** for components, types, interfaces
- **camelCase** for variables, functions, hooks
- **SCREAMING_SNAKE_CASE** for constants
- Prefix custom hooks with `use` (e.g., `usePtyEvents`)
- Prefix test files with `.test.ts` or `.test.tsx`

### File Organization

- Co-locate tests with source files (`foo.ts` → `foo.test.ts`)
- Group related functionality in directories
- Use `index.ts` for barrel exports sparingly
- Keep files under 500 lines (split if larger)

## Common Development Tasks

### Adding a New Feature

1. **Plan the feature** - Update docs if needed
2. **Write tests first** (TDD approach)
3. **Implement the feature**
4. **Update tests** to cover edge cases
5. **Update documentation**
6. **Create PR** with description

### Adding a New IPC Handler

1. **Define types** in `src/shared/types.ts`
2. **Add handler** in appropriate main process file
3. **Expose in preload** in `src/preload.ts`
4. **Update VaporAPI type** in `src/renderer/api/vapor.ts`
5. **Write tests** for the handler
6. **Use in renderer** via `window.vapor.*`

### Adding a New Component

1. **Create component file** in `src/renderer/components/`
2. **Define props interface** with TypeScript
3. **Write component** with functional style
4. **Create test file** alongside component
5. **Add to parent** component
6. **Update styles** if needed

### Adding a New Store

1. **Create store file** in `src/renderer/store/`
2. **Define state interface** with TypeScript
3. **Implement with Zustand** `create<Interface>()`
4. **Export typed hook** (e.g., `useTabStore`)
5. **Write unit tests** for actions
6. **Use in components** via hook

### Debugging

#### Main Process

```bash
# Enable DevTools in main process
export ELECTRON_ENABLE_LOGGING=1
npm start
```

Check console output for main process logs.

#### Renderer Process

- Open DevTools: `Cmd+Option+I` or `View → Toggle Developer Tools`
- Use React DevTools browser extension
- Check console for errors
- Use breakpoints in Sources tab

#### IPC Communication

Add logging in preload and handlers:

```typescript
// In handler
console.log('[pty:create] Called with:', options);

// In renderer
console.log('[vapor.pty.create] Sending:', options);
```

#### PTY Issues

Enable PTY debug logging:

```typescript
// In pty-manager.ts
console.log('[pty] data:', data);
console.log('[pty] exit:', exitCode);
```

### Native Module Issues

If node-pty fails to build:

```bash
# Clean and rebuild
rm -rf node_modules
npm install

# Manually rebuild
npm run postinstall

# Check node-gyp setup
npm install -g node-gyp
node-gyp configure
```

## Testing

### Unit Tests

Located alongside source files with `.test.ts` extension.

**Example:**
```typescript
// src/main/pty-manager.test.ts
import { describe, it, expect } from 'vitest';
import { parseOsc7 } from './pty-manager';

describe('parseOsc7', () => {
  it('parses OSC 7 sequence', () => {
    const result = parseOsc7('\x1b]7;file://host/path\x07');
    expect(result).toEqual({ hostname: 'host', cwd: '/path' });
  });
});
```

### Component Tests

Use React Testing Library:

```typescript
// src/renderer/components/Tab.test.tsx
import { render, screen } from '@testing-library/react';
import { Tab } from './Tab';

test('renders tab title', () => {
  render(<Tab id="1" title="Terminal" />);
  expect(screen.getByText('Terminal')).toBeInTheDocument();
});
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Specific file
npm test -- pty-manager.test.ts

# With coverage
npm test -- --coverage

# Update snapshots
npm test -- -u
```

## Continuous Integration

Tests run via `.github/workflows/build.yml`:
- Every pull request
- Main branch pushes

CI checks:
- Tests pass
- Build succeeds

## Contributing

### Pull Request Process

1. **Fork** the repository
2. **Create branch** from `main`
   ```bash
   git checkout -b feature/my-feature
   ```
3. **Make changes** with tests
4. **Run tests** locally
   ```bash
   npm test
   npm run lint
   ```
5. **Commit** with clear messages
   ```bash
   git commit -m "feat: add new feature"
   ```
6. **Push** to your fork
   ```bash
   git push origin feature/my-feature
   ```
7. **Create PR** on GitHub
8. **Address review** feedback
9. **Merge** when approved

### Commit Message Convention

Follow conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance

**Example:**
```
feat(sidebar): add git status indicators

- Show modified files in orange
- Show untracked files in green
- Add refresh button
```

## Troubleshooting

### Electron Won't Start

```bash
# Clear webpack cache
rm -rf .webpack

# Reinstall
rm -rf node_modules
npm install

# Try again
npm start
```

### Hot Reload Not Working

- Check console for webpack errors
- Restart dev server
- Clear browser cache in DevTools

### Types Not Updating

```bash
# Restart TypeScript server in VSCode
Cmd+Shift+P → "TypeScript: Restart TS Server"
```

### Native Module Errors

```bash
# Rebuild for Electron
npm run postinstall

# Check Python is available
python3 --version

# Check Xcode tools
xcode-select --install
```

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [xterm.js Guide](https://xtermjs.org/docs/)
- [Zustand Documentation](https://zustand.docs.pmnd.rs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Vitest Documentation](https://vitest.dev/)
