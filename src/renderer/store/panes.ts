import type { MosaicNode } from "react-mosaic-component";

export type PaneNode =
  | { type: "terminal"; id: string; sessionId: string }
  | { type: "editor"; id: string; filePath: string }
  | {
      type: "split";
      id: string;
      direction: "horizontal" | "vertical";
      ratio: number;
      children: [PaneNode, PaneNode];
    };

let nextPaneId = 0;

export function genPaneId(): string {
  return `pane-${++nextPaneId}`;
}

export function findNode(
  root: PaneNode,
  targetId: string,
): PaneNode | null {
  if (root.id === targetId) return root;
  if (root.type === "split") {
    return (
      findNode(root.children[0], targetId) ??
      findNode(root.children[1], targetId)
    );
  }
  return null;
}

export function updateNode(
  root: PaneNode,
  targetId: string,
  updater: (node: PaneNode) => PaneNode | null,
): PaneNode | null {
  if (root.id === targetId) {
    return updater(root);
  }
  if (root.type === "split") {
    const left = updateNode(root.children[0], targetId, updater);
    const right = updateNode(root.children[1], targetId, updater);
    if (left !== root.children[0] || right !== root.children[1]) {
      if (left === null) return right;
      if (right === null) return left;
      return { ...root, children: [left, right] };
    }
  }
  return root;
}

export function countTerminals(node: PaneNode): number {
  if (node.type === "terminal") return 1;
  if (node.type === "editor") return 0;
  return countTerminals(node.children[0]) + countTerminals(node.children[1]);
}

export function firstLeafId(node: PaneNode): string {
  if (node.type === "terminal" || node.type === "editor") return node.id;
  return firstLeafId(node.children[0]);
}

export function firstTerminalId(node: PaneNode): string {
  if (node.type === "terminal") return node.id;
  if (node.type === "editor") return node.id;
  return firstTerminalId(node.children[0]);
}

export function collectSessionIds(node: PaneNode): string[] {
  if (node.type === "terminal") return [node.sessionId];
  if (node.type === "editor") return [];
  return [
    ...collectSessionIds(node.children[0]),
    ...collectSessionIds(node.children[1]),
  ];
}

export function findEditorPane(node: PaneNode): (PaneNode & { type: "editor" }) | null {
  if (node.type === "editor") return node;
  if (node.type === "split") {
    return findEditorPane(node.children[0]) ?? findEditorPane(node.children[1]);
  }
  return null;
}

export type Direction = "left" | "right" | "up" | "down";

function findPath(root: PaneNode, targetId: string): PaneNode[] | null {
  if (root.id === targetId) return [root];
  if (root.type === "split") {
    for (const child of root.children) {
      const sub = findPath(child, targetId);
      if (sub) return [root, ...sub];
    }
  }
  return null;
}

function firstLeaf(node: PaneNode): string {
  if (node.type === "terminal" || node.type === "editor") return node.id;
  return firstLeaf(node.children[0]);
}

function lastLeaf(node: PaneNode): string {
  if (node.type === "terminal" || node.type === "editor") return node.id;
  return lastLeaf(node.children[1]);
}

export function swapLeaves(
  root: PaneNode,
  id1: string,
  id2: string,
): PaneNode {
  const node1 = findNode(root, id1);
  const node2 = findNode(root, id2);
  if (!node1 || !node2) return root;

  function swap(node: PaneNode): PaneNode {
    if (node.id === id1) return node2!;
    if (node.id === id2) return node1!;
    if (node.type === "split") {
      const left = swap(node.children[0]);
      const right = swap(node.children[1]);
      if (left !== node.children[0] || right !== node.children[1]) {
        return { ...node, children: [left, right] };
      }
    }
    return node;
  }

  return swap(root);
}

export function findAdjacentPane(
  root: PaneNode,
  currentPaneId: string,
  direction: Direction,
): string | null {
  const path = findPath(root, currentPaneId);
  if (!path) return null;

  const isHorizontal = direction === "left" || direction === "right";
  const splitDir = isHorizontal ? "horizontal" : "vertical";
  const goingFirst = direction === "left" || direction === "up";

  for (let i = path.length - 2; i >= 0; i--) {
    const node = path[i];
    if (node.type !== "split" || node.direction !== splitDir) continue;

    const childInPath = path[i + 1];
    const childIndex = node.children[0].id === childInPath.id ? 0 : 1;

    if (goingFirst && childIndex === 1) {
      return lastLeaf(node.children[0]);
    }
    if (!goingFirst && childIndex === 0) {
      return firstLeaf(node.children[1]);
    }
  }

  return null;
}

export function paneNodeToMosaic(node: PaneNode): MosaicNode<string> {
  if (node.type === "terminal" || node.type === "editor") return node.id;
  return {
    direction: node.direction === "horizontal" ? "row" : "column",
    first: paneNodeToMosaic(node.children[0]),
    second: paneNodeToMosaic(node.children[1]),
    splitPercentage: node.ratio * 100,
  };
}

export function buildLeafMap(node: PaneNode): Map<string, PaneNode> {
  const map = new Map<string, PaneNode>();
  function walk(n: PaneNode): void {
    if (n.type === "terminal" || n.type === "editor") {
      map.set(n.id, n);
    } else {
      walk(n.children[0]);
      walk(n.children[1]);
    }
  }
  walk(node);
  return map;
}

export function mosaicToPaneNode(
  mosaic: MosaicNode<string>,
  leafMap: Map<string, PaneNode>,
): PaneNode {
  if (typeof mosaic === "string") {
    const leaf = leafMap.get(mosaic);
    if (!leaf) throw new Error(`Leaf not found in leafMap: "${mosaic}"`);
    return leaf;
  }
  return {
    type: "split",
    id: genPaneId(),
    direction: mosaic.direction === "row" ? "horizontal" : "vertical",
    ratio: (mosaic.splitPercentage ?? 50) / 100,
    children: [
      mosaicToPaneNode(mosaic.first, leafMap),
      mosaicToPaneNode(mosaic.second, leafMap),
    ],
  };
}
