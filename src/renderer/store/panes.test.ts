import { describe, it, expect } from "vitest";
import {
  findNode,
  updateNode,
  countTerminals,
  firstTerminalId,
  collectSessionIds,
  findAdjacentPane,
  paneNodeToMosaic,
  buildLeafMap,
  mosaicToPaneNode,
  PaneNode,
} from "./panes";

const termA: PaneNode = { type: "terminal", id: "a", sessionId: "s-a" };
const termB: PaneNode = { type: "terminal", id: "b", sessionId: "s-b" };
const termC: PaneNode = { type: "terminal", id: "c", sessionId: "s-c" };

const hSplit: PaneNode = {
  type: "split",
  id: "h1",
  direction: "horizontal",
  ratio: 0.5,
  children: [termA, termB],
};

const nested: PaneNode = {
  type: "split",
  id: "v1",
  direction: "vertical",
  ratio: 0.6,
  children: [hSplit, termC],
};

describe("findNode", () => {
  it("finds a terminal at root", () => {
    expect(findNode(termA, "a")).toBe(termA);
  });

  it("finds a terminal in a split", () => {
    expect(findNode(hSplit, "b")).toBe(termB);
  });

  it("finds a nested terminal", () => {
    expect(findNode(nested, "a")).toBe(termA);
  });

  it("finds the split node itself", () => {
    expect(findNode(nested, "h1")).toBe(hSplit);
  });

  it("returns null for missing id", () => {
    expect(findNode(nested, "missing")).toBeNull();
  });
});

describe("updateNode", () => {
  it("replaces a terminal node", () => {
    const replacement: PaneNode = { type: "terminal", id: "x", sessionId: "s-x" };
    const result = updateNode(hSplit, "a", () => replacement);
    expect(result).not.toBeNull();
    expect(findNode(result!, "x")).toBe(replacement);
  });

  it("removes a node when updater returns null", () => {
    const result = updateNode(hSplit, "a", () => null);
    expect(result).toBe(termB);
  });

  it("returns the same reference when target not found", () => {
    const result = updateNode(hSplit, "missing", () => null);
    expect(result).toBe(hSplit);
  });
});

describe("countTerminals", () => {
  it("counts 1 for a single terminal", () => {
    expect(countTerminals(termA)).toBe(1);
  });

  it("counts 2 for a horizontal split", () => {
    expect(countTerminals(hSplit)).toBe(2);
  });

  it("counts 3 for a nested split", () => {
    expect(countTerminals(nested)).toBe(3);
  });
});

describe("firstTerminalId", () => {
  it("returns the id of a terminal node", () => {
    expect(firstTerminalId(termA)).toBe("a");
  });

  it("returns leftmost terminal in a split", () => {
    expect(firstTerminalId(hSplit)).toBe("a");
  });

  it("returns leftmost terminal in a nested split", () => {
    expect(firstTerminalId(nested)).toBe("a");
  });
});

describe("collectSessionIds", () => {
  it("collects one session from a terminal", () => {
    expect(collectSessionIds(termA)).toEqual(["s-a"]);
  });

  it("collects all sessions from a split", () => {
    expect(collectSessionIds(hSplit)).toEqual(["s-a", "s-b"]);
  });

  it("collects all sessions from a nested split", () => {
    expect(collectSessionIds(nested)).toEqual(["s-a", "s-b", "s-c"]);
  });
});

describe("findAdjacentPane", () => {
  it("finds right neighbor in horizontal split", () => {
    expect(findAdjacentPane(hSplit, "a", "right")).toBe("b");
  });

  it("finds left neighbor in horizontal split", () => {
    expect(findAdjacentPane(hSplit, "b", "left")).toBe("a");
  });

  it("returns null when no neighbor in that direction", () => {
    expect(findAdjacentPane(hSplit, "a", "left")).toBeNull();
  });

  it("finds down neighbor in vertical split", () => {
    expect(findAdjacentPane(nested, "a", "down")).toBe("c");
  });

  it("finds up neighbor in vertical split", () => {
    expect(findAdjacentPane(nested, "c", "up")).toBe("b");
  });

  it("returns null for non-existent pane", () => {
    expect(findAdjacentPane(nested, "missing", "right")).toBeNull();
  });
});

const editorD: PaneNode = { type: "editor", id: "d", filePath: "/tmp/test.ts" };

const mixedTree: PaneNode = {
  type: "split",
  id: "m1",
  direction: "horizontal",
  ratio: 0.7,
  children: [termA, editorD],
};

describe("paneNodeToMosaic", () => {
  it("converts a single terminal to its id string", () => {
    expect(paneNodeToMosaic(termA)).toBe("a");
  });

  it("converts a single editor to its id string", () => {
    expect(paneNodeToMosaic(editorD)).toBe("d");
  });

  it("converts a horizontal split to row with splitPercentage", () => {
    expect(paneNodeToMosaic(hSplit)).toEqual({
      direction: "row",
      first: "a",
      second: "b",
      splitPercentage: 50,
    });
  });

  it("converts a vertical split with ratio 0.6 to column with splitPercentage 60", () => {
    const vSplit: PaneNode = {
      type: "split",
      id: "vs",
      direction: "vertical",
      ratio: 0.6,
      children: [termA, termB],
    };
    expect(paneNodeToMosaic(vSplit)).toEqual({
      direction: "column",
      first: "a",
      second: "b",
      splitPercentage: 60,
    });
  });

  it("converts a nested tree recursively", () => {
    expect(paneNodeToMosaic(nested)).toEqual({
      direction: "column",
      first: {
        direction: "row",
        first: "a",
        second: "b",
        splitPercentage: 50,
      },
      second: "c",
      splitPercentage: 60,
    });
  });
});

describe("buildLeafMap", () => {
  it("returns a map with one entry for a single leaf", () => {
    const map = buildLeafMap(termA);
    expect(map.size).toBe(1);
    expect(map.get("a")).toBe(termA);
  });

  it("returns all leaves from a split", () => {
    const map = buildLeafMap(hSplit);
    expect(map.size).toBe(2);
    expect(map.get("a")).toBe(termA);
    expect(map.get("b")).toBe(termB);
  });

  it("returns all leaves from a nested tree without split nodes", () => {
    const map = buildLeafMap(nested);
    expect(map.size).toBe(3);
    expect(map.get("a")).toBe(termA);
    expect(map.get("b")).toBe(termB);
    expect(map.get("c")).toBe(termC);
    expect(map.has("h1")).toBe(false);
    expect(map.has("v1")).toBe(false);
  });

  it("includes editor leaves", () => {
    const map = buildLeafMap(mixedTree);
    expect(map.size).toBe(2);
    expect(map.get("d")).toBe(editorD);
  });
});

describe("mosaicToPaneNode", () => {
  it("converts a string leaf back to its PaneNode via leafMap", () => {
    const leafMap = new Map<string, PaneNode>([["a", termA]]);
    const result = mosaicToPaneNode("a", leafMap);
    expect(result).toBe(termA);
  });

  it("throws when leaf is not in leafMap", () => {
    const leafMap = new Map<string, PaneNode>();
    expect(() => mosaicToPaneNode("missing", leafMap)).toThrow(
      'Leaf not found in leafMap: "missing"',
    );
  });

  it("converts a MosaicParent to a split node", () => {
    const leafMap = buildLeafMap(hSplit);
    const mosaic = { direction: "row" as const, first: "a", second: "b", splitPercentage: 50 };
    const result = mosaicToPaneNode(mosaic, leafMap);
    expect(result.type).toBe("split");
    if (result.type === "split") {
      expect(result.direction).toBe("horizontal");
      expect(result.ratio).toBe(0.5);
      expect(result.children[0]).toBe(termA);
      expect(result.children[1]).toBe(termB);
    }
  });

  it("defaults to 50% split when splitPercentage is undefined", () => {
    const leafMap = buildLeafMap(hSplit);
    const mosaic = { direction: "row" as const, first: "a", second: "b" };
    const result = mosaicToPaneNode(mosaic, leafMap);
    if (result.type === "split") {
      expect(result.ratio).toBe(0.5);
    }
  });
});

function compareTreeStructure(a: PaneNode, b: PaneNode): void {
  expect(a.type).toBe(b.type);
  if (a.type === "terminal" && b.type === "terminal") {
    expect(a.id).toBe(b.id);
    expect(a.sessionId).toBe(b.sessionId);
  } else if (a.type === "editor" && b.type === "editor") {
    expect(a.id).toBe(b.id);
    expect(a.filePath).toBe(b.filePath);
  } else if (a.type === "split" && b.type === "split") {
    expect(a.direction).toBe(b.direction);
    expect(a.ratio).toBeCloseTo(b.ratio, 10);
    compareTreeStructure(a.children[0], b.children[0]);
    compareTreeStructure(a.children[1], b.children[1]);
  }
}

describe("round-trip conversion", () => {
  it("round-trips a single terminal", () => {
    const mosaic = paneNodeToMosaic(termA);
    const leafMap = buildLeafMap(termA);
    const result = mosaicToPaneNode(mosaic, leafMap);
    compareTreeStructure(result, termA);
  });

  it("round-trips a horizontal split", () => {
    const mosaic = paneNodeToMosaic(hSplit);
    const leafMap = buildLeafMap(hSplit);
    const result = mosaicToPaneNode(mosaic, leafMap);
    compareTreeStructure(result, hSplit);
  });

  it("round-trips a nested tree", () => {
    const mosaic = paneNodeToMosaic(nested);
    const leafMap = buildLeafMap(nested);
    const result = mosaicToPaneNode(mosaic, leafMap);
    compareTreeStructure(result, nested);
  });

  it("round-trips a tree with an editor node", () => {
    const mosaic = paneNodeToMosaic(mixedTree);
    const leafMap = buildLeafMap(mixedTree);
    const result = mosaicToPaneNode(mosaic, leafMap);
    compareTreeStructure(result, mixedTree);
  });

  it("round-trip split ids differ but structure matches", () => {
    const mosaic = paneNodeToMosaic(nested);
    const leafMap = buildLeafMap(nested);
    const result = mosaicToPaneNode(mosaic, leafMap);
    if (result.type === "split") {
      expect(result.id).not.toBe(nested.id);
    }
    compareTreeStructure(result, nested);
  });
});
