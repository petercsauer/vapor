# Testing

Vapor uses Vitest for fast, modern unit testing with comprehensive coverage of core functionality.

## Testing Stack

- **Vitest** - Test runner and assertions
- **React Testing Library** - Component testing
- **jsdom** - Browser environment simulation
- **@testing-library/jest-dom** - Custom matchers

## Running Tests

### All Tests

```bash
npm test
```

Runs all tests once and exits.

### Watch Mode

```bash
npm run test:watch
```

Watches files and re-runs tests on changes. Recommended for TDD.

### Specific Test File

```bash
npm test -- src/main/pty-manager.test.ts
```

### With Coverage

```bash
npm test -- --coverage
```

Generates coverage report in `coverage/` directory.

### UI Mode

```bash
npm test -- --ui
```

Opens browser-based test UI for interactive debugging.

## Test Organization

Tests are co-located with source files:

```
src/
├── main/
│   ├── pty-manager.ts
│   ├── pty-manager.test.ts      <- Tests here
│   ├── config.ts
│   └── config.test.ts           <- Tests here
├── renderer/
│   ├── components/
│   │   ├── TabChrome.tsx
│   │   └── TabChrome.test.tsx   <- Tests here
│   └── store/
│       ├── tabs.ts
│       └── tabs.test.ts         <- Tests here
```

## Writing Tests

### Unit Test Example

```typescript
// src/main/pty-manager.test.ts
import { describe, it, expect } from 'vitest';
import { parseOsc7, parseOsc133D } from './pty-manager';

describe('parseOsc7', () => {
  it('parses basic OSC 7 sequence', () => {
    const input = '\x1b]7;file://hostname/path\x07';
    const result = parseOsc7(input);

    expect(result).toEqual({
      hostname: 'hostname',
      cwd: '/path'
    });
  });

  it('handles URL encoding', () => {
    const input = '\x1b]7;file://host/path%20with%20spaces\x07';
    const result = parseOsc7(input);

    expect(result?.cwd).toBe('/path with spaces');
  });

  it('returns null for invalid input', () => {
    expect(parseOsc7('no osc sequence')).toBeNull();
  });
});

describe('parseOsc133D', () => {
  it('extracts exit code', () => {
    const input = '\x1b]133;D;0\x07';
    expect(parseOsc133D(input)).toBe(0);
  });

  it('handles non-zero exit codes', () => {
    const input = '\x1b]133;D;127\x07';
    expect(parseOsc133D(input)).toBe(127);
  });
});
```

### Component Test Example

```typescript
// src/renderer/components/Tab.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Tab } from './Tab';

describe('Tab', () => {
  const defaultProps = {
    tabId: 'tab-1',
    title: 'Terminal',
    isActive: false,
    isNavSelected: false,
    index: 0,
    onActivate: vi.fn(),
    onClose: vi.fn(),
    onRename: vi.fn(),
    onReorder: vi.fn(),
  };

  it('renders tab title', () => {
    render(<Tab {...defaultProps} />);
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('calls onActivate when clicked', () => {
    const handleActivate = vi.fn();
    render(<Tab {...defaultProps} onActivate={handleActivate} />);

    fireEvent.click(screen.getByText('Terminal'));
    expect(handleActivate).toHaveBeenCalledWith('tab-1');
  });
});
```

### Store Test Example

```typescript
// src/renderer/store/tabs.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useTabPaneStore, resetNextTabId } from './tabs';

describe('useTabPaneStore', () => {
  beforeEach(() => {
    // Reset store state
    useTabPaneStore.setState({
      tabs: [],
      activeTabId: '',
    });
    resetNextTabId();
  });

  it('creates new tab', async () => {
    const store = useTabPaneStore.getState();
    await store.createTab();

    const { tabs, activeTabId } = useTabPaneStore.getState();

    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe('tab-1');
    expect(activeTabId).toBe('tab-1');
  });

  it('closes tab', async () => {
    const store = useTabPaneStore.getState();
    await store.createTab();
    await store.createTab();

    const firstId = useTabPaneStore.getState().tabs[0].id;
    store.closeTab(firstId);

    const { tabs } = useTabPaneStore.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).not.toBe(firstId);
  });

  it('activates tab', async () => {
    const store = useTabPaneStore.getState();
    await store.createTab();
    await store.createTab();

    const tabs = useTabPaneStore.getState().tabs;
    store.activateTab(tabs[0].id);

    expect(useTabPaneStore.getState().activeTabId).toBe(tabs[0].id);
  });
});
```

## Test Utilities

### Setup File (src/test/setup.ts)

Global test setup:

```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});
```

### Vapor API Mock (src/test/vapor-mock.ts)

Mock Electron IPC for renderer tests:

```typescript
import { vi } from 'vitest';

export const mockVaporAPI = {
  pty: {
    create: vi.fn().mockResolvedValue({ sessionId: 'test-session' }),
    input: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn().mockResolvedValue(undefined),
    getInfo: vi.fn().mockResolvedValue(null),
    onOutput: vi.fn().mockReturnValue(() => {}),
    onExit: vi.fn().mockReturnValue(() => {}),
    onCommandStatus: vi.fn().mockReturnValue(() => {}),
    getContext: vi.fn().mockResolvedValue(null),
  },
  // ... other API methods
};

// Make available globally
(global as any).window = {
  vapor: mockVaporAPI,
};
```

### Test Helpers

```typescript
// Helper to create test tab
export function createTestTab(overrides = {}) {
  return {
    id: 'test-tab',
    title: 'Test',
    hasCustomTitle: false,
    paneRoot: {
      type: 'terminal' as const,
      id: 'pane-1',
      sessionId: 'session-1',
    },
    focusedPaneId: 'pane-1',
    sidebarVisible: false,
    ...overrides,
  };
}

// Helper to create test pane
export function createTestPane(type: 'terminal' | 'editor' = 'terminal') {
  if (type === 'terminal') {
    return {
      type: 'terminal' as const,
      id: 'pane-1',
      sessionId: 'session-1',
    };
  }
  return {
    type: 'editor' as const,
    id: 'pane-1',
    filePath: '/test/file.txt',
  };
}
```

## Coverage Goals

Target coverage by module:

- **Main Process Handlers:** >80%
  - pty-manager.ts
  - config.ts
  - layout-manager.ts
  - tab-namer.ts
  - fs-handler.ts

- **Stores:** >90%
  - tabs.ts
  - panes.ts
  - editor.ts
  - sidebar.ts
  - navigation.ts

- **Components:** >70%
  - Tab.tsx
  - TabChrome.tsx
  - SplitView.tsx
  - ErrorBoundary.tsx

- **Utilities:** >95%
  - Parsing functions
  - Tree operations
  - Type guards

## Testing Patterns

### Arrange-Act-Assert

```typescript
it('renames tab', () => {
  // Arrange
  const store = useTabPaneStore.getState();
  store.createTab();
  const tabId = store.tabs[0].id;

  // Act
  store.renameTab(tabId, 'New Name');

  // Assert
  const tab = store.tabs.find(t => t.id === tabId);
  expect(tab?.title).toBe('New Name');
  expect(tab?.hasCustomTitle).toBe(true);
});
```

### Testing Async Operations

```typescript
it('creates PTY session', async () => {
  const store = useTabPaneStore.getState();

  await store.createTab();

  expect(mockVaporAPI.pty.create).toHaveBeenCalled();
  expect(store.tabs).toHaveLength(1);
});
```

### Testing Error Handling

```typescript
it('handles PTY creation failure', async () => {
  mockVaporAPI.pty.create.mockRejectedValueOnce(
    new Error('Failed to spawn')
  );

  const store = useTabPaneStore.getState();
  await store.createTab();

  // Should not crash, logs error
  expect(store.tabs).toHaveLength(0);
});
```

### Testing React Hooks

```typescript
import { renderHook, act } from '@testing-library/react';

it('updates on PTY output', () => {
  const { result } = renderHook(() => usePtyEvents());

  act(() => {
    // Simulate PTY output event
    const callback = mockVaporAPI.pty.onOutput.mock.calls[0][0];
    callback({ sessionId: 'test', data: 'hello' });
  });

  // Assert state updated
});
```

## Debugging Tests

### Run Single Test

```bash
npm test -- --grep "creates new tab"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "--inspect-brk"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Console Output

```typescript
it('debug test', () => {
  const data = { foo: 'bar' };
  console.log('Debug:', data);
  expect(data.foo).toBe('bar');
});
```

### Snapshot Testing

```typescript
it('matches snapshot', () => {
  const { container } = render(<Tab title="Test" />);
  expect(container).toMatchSnapshot();
});

// Update snapshots:
// npm test -- -u
```

## Continuous Integration

Tests run automatically via `.github/workflows/build.yml`:
- Pull requests
- Main branch pushes

The workflow includes a `test` job that runs `npm test` alongside build and release jobs.

## Best Practices

### Do's

- **Write tests first** (TDD approach)
- **Test behavior, not implementation**
- **Use descriptive test names**
- **Keep tests isolated and independent**
- **Mock external dependencies**
- **Test edge cases and error paths**
- **Maintain high coverage on critical paths**

### Don'ts

- **Don't test implementation details**
- **Don't use timers without good reason**
- **Don't test third-party libraries**
- **Don't share state between tests**
- **Don't ignore flaky tests**
- **Don't test UI pixels**

## Common Issues

### Test Timeout

```typescript
// Increase timeout for slow operations
it('loads large file', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Async State Updates

```typescript
// Use waitFor for async updates
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### Cleanup Issues

```typescript
// Ensure cleanup in afterEach
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
```

### Module Mocking

```typescript
// Mock entire module
vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
