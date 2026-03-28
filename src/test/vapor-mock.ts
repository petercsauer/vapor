import { vi } from "vitest";
import type { VaporAPI } from "../preload";

export function createVaporMock(): VaporAPI {
  return {
    ssh: {
      connect: vi.fn().mockResolvedValue({ success: true }),
      disconnect: vi.fn().mockResolvedValue({ success: true }),
      listConnections: vi.fn().mockResolvedValue({ connections: [] }),
    },
    pty: {
      create: vi.fn().mockResolvedValue({ sessionId: "mock-session-1" }),
      input: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn().mockResolvedValue(undefined),
      getInfo: vi.fn().mockResolvedValue(null),
      onOutput: vi.fn().mockReturnValue(() => {
        // Cleanup function
      }),
      onExit: vi.fn().mockReturnValue(() => {
        // Cleanup function
      }),
      onCommandStatus: vi.fn().mockReturnValue(() => {
        // Cleanup function
      }),
      getContext: vi.fn().mockResolvedValue(null),
      getState: vi.fn().mockResolvedValue(null),
      onStateUpdated: vi.fn().mockReturnValue(() => {}),
    },
    tabNamer: {
      available: vi.fn().mockResolvedValue(false),
      suggest: vi.fn().mockResolvedValue(null),
    },
    layouts: {
      list: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue([]),
    },
    config: {
      get: vi.fn().mockResolvedValue({}),
      getPath: vi.fn().mockResolvedValue("/tmp/mock-config"),
    },
    fs: {
      openFolder: vi.fn().mockResolvedValue(null),
      readdir: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue(""),
      writeFile: vi.fn().mockResolvedValue(undefined),
      stat: vi.fn().mockResolvedValue({ size: 0, modified: 0, isDirectory: false, isFile: true }),
      rename: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      gitRoot: vi.fn().mockResolvedValue(null),
      watch: vi.fn(),
      onChanged: vi.fn().mockReturnValue(() => {
        // Cleanup function
      }),
      showInFolder: vi.fn().mockResolvedValue(undefined),
      openPath: vi.fn().mockResolvedValue(undefined),
      copyTo: vi.fn().mockResolvedValue(undefined),
      clipboardCopyPath: vi.fn().mockResolvedValue(undefined),
      remote: {
        readdir: vi.fn().mockResolvedValue([]),
        readFile: vi.fn().mockResolvedValue(""),
        writeFile: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockResolvedValue({ size: 0, modified: 0, isDirectory: false, isFile: true }),
        rename: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
      },
    },
    openExternal: vi.fn(),
    onMenuAction: vi.fn().mockReturnValue(() => {
      // Cleanup function
    }),
    onSwipeTab: vi.fn().mockReturnValue(() => {
      // Cleanup function
    }),
    onCliOpenFile: vi.fn().mockReturnValue(() => {
      // Cleanup function
    }),
  };
}
