import React, { useMemo, useCallback } from "react";
import { useDrag, useDrop } from "react-dnd";
import { MosaicWithoutDragDropContext, MosaicWindow } from "react-mosaic-component";
import type { MosaicNode, MosaicBranch } from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";
import { PaneNode, paneNodeToMosaic, buildLeafMap, mosaicToPaneNode } from "../store/panes";
import { useTabPaneStore } from "../store/tabs";
import { TerminalPane } from "./TerminalPane";
import { EditorPane } from "./EditorPane";
import { PaneErrorBoundary } from "./ErrorBoundary";

const PANE_SWAP_TYPE = "PANE_SWAP";

interface PaneSwapItem {
  paneId: string;
}

/**
 * When move mode is active, renders a transparent overlay that acts as both
 * a drag source and drop target for pane swapping. Uses react-dnd directly
 * to avoid react-mosaic-component's internal updateTree race condition.
 */
function DragHandle({ children, paneId }: { children: React.ReactNode; paneId: string }) {
  const moveMode = useTabPaneStore((s) => s.moveMode);
  const swapPanes = useTabPaneStore((s) => s.swapPanes);

  const [{ isDragging }, dragRef] = useDrag<PaneSwapItem, void, { isDragging: boolean }>({
    type: PANE_SWAP_TYPE,
    item: { paneId },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    canDrag: () => moveMode,
  });

  const [{ isOver }, dropRef] = useDrop<PaneSwapItem, void, { isOver: boolean }>({
    accept: PANE_SWAP_TYPE,
    drop: (item) => {
      if (item.paneId !== paneId) {
        swapPanes(item.paneId, paneId);
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver() }),
  });

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      dragRef(node);
      dropRef(node);
    },
    [dragRef, dropRef],
  );

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", position: "relative" }}>
      {children}
      {moveMode && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            cursor: isDragging ? "grabbing" : "grab",
            background: isOver ? "rgba(0, 149, 255, 0.12)" : "rgba(0, 149, 255, 0.04)",
            border: "1.5px dashed var(--accent-border)",
            borderRadius: 6,
            margin: 4,
          }}
        />
      )}
    </div>
  );
}

interface SplitViewProps {
  node: PaneNode;
  tabId: string;
}

export const SplitView = React.memo(function SplitView({ node, tabId }: SplitViewProps) {
  const setPaneRoot = useTabPaneStore((s) => s.setPaneRoot);
  const mosaicValue = useMemo(() => paneNodeToMosaic(node), [node]);
  const leafMap = useMemo(() => buildLeafMap(node), [node]);

  const onChange = useCallback(
    (newMosaic: MosaicNode<string> | null) => {
      if (!newMosaic) return;
      const newRoot = mosaicToPaneNode(newMosaic, leafMap);
      setPaneRoot(tabId, newRoot);
    },
    [tabId, leafMap, setPaneRoot],
  );

  const renderTile = useCallback(
    (id: string, path: MosaicBranch[]) => {
      const leaf = leafMap.get(id);
      if (!leaf) return <div />;
      return (
        <MosaicWindow<string>
          path={path}
          title=""
          draggable={false}
          renderToolbar={() => <div />}
          renderPreview={() => <div />}
        >
          <DragHandle paneId={id}>
            <PaneErrorBoundary>
              {leaf.type === "terminal" ? (
                <TerminalPane sessionId={leaf.sessionId} paneId={leaf.id} />
              ) : (
                <EditorPane paneId={leaf.id} />
              )}
            </PaneErrorBoundary>
          </DragHandle>
        </MosaicWindow>
      );
    },
    [leafMap],
  );

  return (
    <MosaicWithoutDragDropContext<string>
      value={mosaicValue}
      onChange={onChange}
      renderTile={renderTile}
      className=""
    />
  );
});
